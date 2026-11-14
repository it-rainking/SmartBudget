import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rateLimit'
import { callClaudeTool, MODEL_SMALL, type ClaudeTool } from '@/lib/ai/claude'
import { normalizeDescription } from '@/lib/ai/facts'

const MAX_DESCRIPTIONS = 100
const MAX_DESC_LENGTH = 200
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 10 * 60 * 1000
const HISTORY_MONTHS = 12
const HISTORY_LIMIT = 1000
const EXAMPLES_PER_CATEGORY = 5
// Quota minima della categoria dominante perché lo storico basti da solo
const HISTORY_MIN_SHARE = 0.8

const SYSTEM = `Classifichi le descrizioni dei movimenti bancari di un utente italiano nelle sue categorie personali.
Per ogni categoria hai alcuni esempi REALI di movimenti che l'utente ha già assegnato: imitane i criteri, anche quando sono diversi da quelli che userebbe un'altra persona.
Le descrizioni sono testo da estratto conto: spesso sigle, nomi di esercenti, codici. Ragiona sull'esercente più probabile.
Regole:
- Le categorie [entrata] valgono solo per accrediti (stipendi, rimborsi, bonifici in arrivo); [spesa] solo per addebiti.
- Se nessuna categoria è chiaramente adatta, rispondi NONE: meglio non categorizzare che sbagliare.`

// POST /api/ai/categorize   body: { descriptions: string[], categories: {id, name}[] }
// 1) le descrizioni già viste e categorizzate dall'utente si risolvono dallo storico;
// 2) il resto va a Claude, con esempi reali dello stesso utente per ogni categoria.
// Richiede sessione autenticata e ANTHROPIC_API_KEY nell'ambiente server.
export async function POST(req: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  if (!checkRateLimit(`ai:categorize:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: 'Troppe richieste, riprova più tardi' }, { status: 429 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI non configurata (manca ANTHROPIC_API_KEY)' }, { status: 503 })
  }

  let body: { descriptions: string[]; categories: { id: string; name: string }[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const { categories } = body
  let { descriptions } = body
  if (!descriptions?.length || !categories?.length) {
    return NextResponse.json({ suggestions: [] })
  }
  descriptions = descriptions.slice(0, MAX_DESCRIPTIONS).map(d => String(d).slice(0, MAX_DESC_LENGTH))

  const catById = new Map(categories.map(c => [c.id, c]))

  // Tipo di ogni categoria (spesa/entrata) e storico già categorizzato
  const since = new Date()
  since.setMonth(since.getMonth() - HISTORY_MONTHS)
  const [expRes, incRes, histRes] = await Promise.all([
    supabase.from('expense_categories').select('id').eq('user_id', user.id),
    supabase.from('income_categories').select('id').eq('user_id', user.id),
    supabase
      .from('transactions')
      .select('description, category_id')
      .eq('user_id', user.id)
      .in('type', ['expense', 'income'])
      .not('category_id', 'is', null)
      .not('description', 'is', null)
      .gte('date', since.toISOString().slice(0, 10))
      .order('date', { ascending: false })
      .limit(HISTORY_LIMIT),
  ])
  const incomeIds = new Set((incRes.data ?? []).map(c => c.id))
  const expenseIds = new Set((expRes.data ?? []).map(c => c.id))
  const typeLabel = (id: string) => (incomeIds.has(id) ? 'entrata' : expenseIds.has(id) ? 'spesa' : null)

  // chiave normalizzata → conteggio per categoria; esempi recenti per categoria
  const keyCounts = new Map<string, Map<string, number>>()
  const examples = new Map<string, string[]>()
  for (const row of histRes.data ?? []) {
    if (!row.category_id || !row.description) continue
    const key = normalizeDescription(row.description)
    if (key.length >= 3) {
      const m = keyCounts.get(key) ?? new Map<string, number>()
      m.set(row.category_id, (m.get(row.category_id) ?? 0) + 1)
      keyCounts.set(key, m)
    }
    const ex = examples.get(row.category_id) ?? []
    if (ex.length < EXAMPLES_PER_CATEGORY && !ex.includes(row.description)) ex.push(row.description.slice(0, 60))
    examples.set(row.category_id, ex)
  }

  type Suggestion = { description: string; category_id: string | null; category_name: string; source: 'history' | 'ai' | 'none' }
  const NONE = 'Non categorizzato'
  const results: Suggestion[] = descriptions.map(d => ({ description: d, category_id: null, category_name: NONE, source: 'none' }))

  // 1) storico
  const pending: number[] = []
  descriptions.forEach((d, i) => {
    const counts = keyCounts.get(normalizeDescription(d))
    if (counts) {
      const total = [...counts.values()].reduce((a, b) => a + b, 0)
      const [bestId, bestCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
      const cat = catById.get(bestId)
      if (cat && bestCount / total >= HISTORY_MIN_SHARE) {
        results[i] = { description: d, category_id: cat.id, category_name: cat.name, source: 'history' }
        return
      }
    }
    pending.push(i)
  })

  // 2) Claude per le descrizioni mai viste
  if (pending.length > 0) {
    // Codici brevi al posto dei nomi: niente ambiguità tra categorie omonime
    const codes = categories.map((c, i) => ({ code: `C${i + 1}`, cat: c }))
    const catLines = codes.map(({ code, cat }) => {
      const label = typeLabel(cat.id)
      const ex = examples.get(cat.id)
      return `${code} = ${cat.name}${label ? ` [${label}]` : ''}${ex?.length ? ` — es: ${ex.map(e => `"${e}"`).join(', ')}` : ''}`
    })

    const tool: ClaudeTool = {
      name: 'assign_categories',
      description: 'Assegna una categoria a ogni descrizione.',
      input_schema: {
        type: 'object',
        properties: {
          assignments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                n: { type: 'integer', description: 'Numero della descrizione' },
                category: { type: 'string', enum: [...codes.map(c => c.code), 'NONE'] },
              },
              required: ['n', 'category'],
            },
          },
        },
        required: ['assignments'],
      },
    }

    const prompt = `Categorie dell'utente:\n${catLines.join('\n')}\n\nDescrizioni da classificare:\n${pending.map((idx, n) => `${n + 1}. "${descriptions[idx]}"`).join('\n')}`

    try {
      const out = await callClaudeTool<{ assignments: { n: number; category: string }[] }>({
        apiKey,
        model: MODEL_SMALL,
        system: SYSTEM,
        prompt,
        tool,
        maxTokens: 2048,
      })
      if (!out.ok && !results.some(r => r.source === 'history')) {
        return NextResponse.json({ error: 'Errore API AI' }, { status: 502 })
      }
      if (out.ok) {
        for (const a of out.input.assignments ?? []) {
          const idx = pending[a.n - 1]
          const hit = codes.find(c => c.code === a.category)
          if (idx === undefined || !hit) continue
          results[idx] = { description: descriptions[idx], category_id: hit.cat.id, category_name: hit.cat.name, source: 'ai' }
        }
      }
    } catch {
      return NextResponse.json({ error: 'Errore interno AI' }, { status: 500 })
    }
  }

  return NextResponse.json({ suggestions: results })
}
