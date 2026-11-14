import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rateLimit'
import { callClaudeTool, MODEL_ANALYSIS, type ClaudeTool } from '@/lib/ai/claude'
import { makeFormatter } from '@/lib/ai/facts'

const MAX_DESCS_PER_CAT = 6
const LOOKBACK_DAYS = 180
const TX_LIMIT = 1000
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 10 * 60 * 1000

type CatType = 'expense' | 'income' | 'saving'

const SYSTEM = `Aiuti un utente italiano a tenere in ordine le categorie di SmartBudget, la sua app di finanze personali.
Ricevi per ogni categoria: numero di movimenti, importo totale, ultimo utilizzo ed esempi di descrizioni degli ultimi mesi.
Proponi SOLO miglioramenti che si giustificano con i dati:
- merge: due o più categorie dello stesso tipo che raccolgono movimenti dello stesso genere (es. "Bar" e "Caffè"), soprattutto se poco usate.
- split: una categoria che pesa molto sul totale e contiene movimenti chiaramente eterogenei (cita 2-3 esempi reali).
- rename: nome ambiguo rispetto agli esempi che contiene.
- create: movimenti non categorizzati che si ripetono e meritano una categoria propria.
Non proporre ritocchi estetici, non toccare categorie con pochi movimenti solo per "ordine", non suggerire più di 5 interventi e usa solo ID presenti nell'elenco.
Se i dati non giustificano nulla restituisci un elenco vuoto: è una risposta valida e preferibile a suggerimenti deboli.
La motivazione (reason) cita un numero o un esempio concreto, max 100 caratteri.`

const TOOL: ClaudeTool = {
  name: 'suggest_improvements',
  description: 'Restituisce i miglioramenti proposti alle categorie.',
  input_schema: {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['merge', 'rename', 'split', 'create'] },
            category_type: { type: 'string', enum: ['expense', 'income', 'saving'] },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            reason: { type: 'string' },
            category_ids: { type: 'array', items: { type: 'string' }, description: 'merge: ID delle categorie da unire' },
            category_names: { type: 'array', items: { type: 'string' } },
            category_id: { type: 'string', description: 'rename/split: ID della categoria' },
            current_name: { type: 'string' },
            suggested_name: { type: 'string', description: 'merge/rename/create: nome proposto' },
            suggested_icon: { type: 'string', description: 'emoji' },
            suggested_names: {
              type: 'array',
              description: 'split: le nuove categorie',
              items: {
                type: 'object',
                properties: { name: { type: 'string' }, icon: { type: 'string' } },
                required: ['name'],
              },
            },
            example_descriptions: { type: 'array', items: { type: 'string' } },
          },
          required: ['type', 'category_type', 'priority', 'reason'],
        },
      },
    },
    required: ['suggestions'],
  },
}

interface Suggestion {
  type: 'merge' | 'rename' | 'split' | 'create'
  category_type: CatType
  category_ids?: string[]
  category_id?: string
  [k: string]: unknown
}

// POST /api/ai/simplify-categories
// Analizza categorie e movimenti recenti dell'utente e restituisce suggerimenti
// strutturati per semplificarle. Richiede sessione e ANTHROPIC_API_KEY.
export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  if (!checkRateLimit(`ai:simplify-categories:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: 'Troppe richieste, riprova più tardi' }, { status: 429 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI non configurata (manca ANTHROPIC_API_KEY)' }, { status: 503 })
  }

  const [expRes, incRes, savRes, settingsRes] = await Promise.all([
    supabase.from('expense_categories').select('id, name, icon').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
    supabase.from('income_categories').select('id, name, icon').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
    supabase.from('saving_categories').select('id, name, icon').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
    supabase.from('settings').select('currency').eq('user_id', user.id).maybeSingle(),
  ])
  const fmt = makeFormatter(settingsRes.data?.currency || 'EUR')

  type Cat = { id: string; name: string; icon: string | null }
  const groups: { type: CatType; label: string; cats: Cat[] }[] = [
    { type: 'expense', label: 'Spese', cats: (expRes.data ?? []) as Cat[] },
    { type: 'income', label: 'Entrate', cats: (incRes.data ?? []) as Cat[] },
    { type: 'saving', label: 'Risparmi', cats: (savRes.data ?? []) as Cat[] },
  ]
  const allIds = new Map<string, CatType>()
  for (const g of groups) for (const c of g.cats) allIds.set(c.id, g.type)

  if (allIds.size === 0) {
    return NextResponse.json({ suggestions: [], analyzed_transactions: 0, analyzed_categories: 0 })
  }

  const since = new Date()
  since.setDate(since.getDate() - LOOKBACK_DAYS)
  const { data: transactions } = await supabase
    .from('transactions')
    .select('type, category_id, description, amount, date')
    .eq('user_id', user.id)
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: false })
    .limit(TX_LIMIT)
  const txList = transactions ?? []

  // Statistiche per categoria: volume, importo, ultimo uso, esempi distinti
  type Stat = { count: number; total: number; last: string; descs: string[] }
  const stats = new Map<string, Stat>()
  for (const t of txList) {
    const key = t.category_id ?? '__none__'
    const s: Stat = stats.get(key) ?? { count: 0, total: 0, last: t.date, descs: [] }
    s.count++
    s.total += Number(t.amount)
    if (t.date > s.last) s.last = t.date
    if (t.description && s.descs.length < MAX_DESCS_PER_CAT && !s.descs.includes(t.description)) s.descs.push(t.description.slice(0, 50))
    stats.set(key, s)
  }

  const section = (g: (typeof groups)[number]) => {
    if (!g.cats.length) return ''
    const typeTotal = g.cats.reduce((sum, c) => sum + (stats.get(c.id)?.total ?? 0), 0)
    const lines = g.cats.map((c) => {
      const s = stats.get(c.id)
      if (!s) return `- ID:${c.id} | "${c.name}"${c.icon ? ` ${c.icon}` : ''} | nessun movimento negli ultimi ${LOOKBACK_DAYS} giorni`
      const share = typeTotal > 0 ? ` (${Math.round((s.total / typeTotal) * 100)}%)` : ''
      const ex = s.descs.length ? ` | es: ${s.descs.map((d) => `"${d}"`).join(', ')}` : ''
      return `- ID:${c.id} | "${c.name}"${c.icon ? ` ${c.icon}` : ''} | ${s.count} mov., ${fmt(s.total)}${share}, ultimo ${s.last}${ex}`
    })
    return `### ${g.label} (category_type: ${g.type})\n${lines.join('\n')}`
  }

  const none = stats.get('__none__')
  const uncategorized = none
    ? `### Movimenti senza categoria: ${none.count}, ${fmt(none.total)}\nEsempi: ${none.descs.map((d) => `"${d}"`).join(', ')}`
    : ''

  const prompt = `Ultimi ${LOOKBACK_DAYS} giorni, ${txList.length} movimenti analizzati.\n\n${groups.map(section).filter(Boolean).join('\n\n')}\n\n${uncategorized}`

  try {
    const result = await callClaudeTool<{ suggestions: Suggestion[] }>({
      apiKey,
      model: MODEL_ANALYSIS,
      system: SYSTEM,
      prompt,
      tool: TOOL,
      maxTokens: 2048,
    })
    if (!result.ok) return NextResponse.json({ error: 'Errore API AI' }, { status: 502 })

    // Scarta i suggerimenti che citano ID inesistenti o di tipo diverso
    const ok = (id: string | undefined, type: CatType) => !!id && allIds.get(id) === type
    const suggestions = (result.input.suggestions ?? []).filter((s) => {
      if (s.type === 'merge') return (s.category_ids?.length ?? 0) >= 2 && s.category_ids!.every((id) => ok(id, s.category_type))
      if (s.type === 'rename' || s.type === 'split') return ok(s.category_id, s.category_type)
      return s.type === 'create'
    })

    return NextResponse.json({
      suggestions,
      analyzed_transactions: txList.length,
      analyzed_categories: allIds.size,
    })
  } catch {
    return NextResponse.json({ error: 'Errore interno AI' }, { status: 500 })
  }
}
