import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rateLimit'

const MAX_DESCS_PER_CAT = 8
const LOOKBACK_DAYS = 90
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 10 * 60 * 1000

// POST /api/ai/simplify-categories
// Analizza le categorie e le transazioni recenti dell'utente e restituisce
// suggerimenti strutturati per semplificare/migliorare le categorie.
// Richiede sessione autenticata e ANTHROPIC_API_KEY nell'ambiente server.
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

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI non configurata (manca ANTHROPIC_API_KEY)' }, { status: 503 })
  }

  const [expRes, incRes, savRes] = await Promise.all([
    supabase.from('expense_categories').select('id, name, icon').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
    supabase.from('income_categories').select('id, name, icon').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
    supabase.from('saving_categories').select('id, name, icon').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
  ])

  const expenseCats = expRes.data ?? []
  const incomeCats = incRes.data ?? []
  const savingCats = savRes.data ?? []
  const allCats = [...expenseCats, ...incomeCats, ...savingCats]

  if (allCats.length === 0) {
    return NextResponse.json({ suggestions: [], analyzed_transactions: 0, analyzed_categories: 0 })
  }

  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - LOOKBACK_DAYS)

  const { data: transactions } = await supabase
    .from('transactions')
    .select('type, category_id, description')
    .eq('user_id', user.id)
    .gte('date', lookbackDate.toISOString().split('T')[0])
    .not('description', 'is', null)
    .order('date', { ascending: false })
    .limit(500)

  const txList = transactions ?? []

  const descsByCategory: Record<string, string[]> = {}
  const txCountByCategory: Record<string, number> = {}

  for (const tx of txList) {
    const catId = tx.category_id ?? '__none__'
    txCountByCategory[catId] = (txCountByCategory[catId] ?? 0) + 1
    if (!descsByCategory[catId]) descsByCategory[catId] = []
    if (tx.description && descsByCategory[catId].length < MAX_DESCS_PER_CAT) {
      descsByCategory[catId].push(tx.description)
    }
  }

  function buildSection(
    cats: Array<{ id: string; name: string; icon?: string | null }>,
    label: string
  ): string {
    if (!cats.length) return ''
    const lines = cats.map(c => {
      const count = txCountByCategory[c.id] ?? 0
      const descs = descsByCategory[c.id] ?? []
      const descStr = descs.length
        ? ` → es: ${descs.map(d => `"${d}"`).join(', ')}`
        : ' → nessuna transazione recente'
      return `- ID:${c.id} | "${c.name}"${c.icon ? ` ${c.icon}` : ''} | ${count} tx${descStr}`
    })
    return `### ${label}:\n${lines.join('\n')}`
  }

  const uncategorized = descsByCategory['__none__'] ?? []
  const uncatSection = uncategorized.length
    ? `\n### Non categorizzate (${txCountByCategory['__none__'] ?? 0} transazioni):\n${uncategorized.slice(0, 10).map(d => `- "${d}"`).join('\n')}`
    : ''

  const prompt = `Sei un assistente finanziario per l'app SmartBudget (italiano).

Analizza le categorie dell'utente e le transazioni recenti (ultimi ${LOOKBACK_DAYS} giorni).
Suggerisci AL MASSIMO 5 miglioramenti concreti e rilevanti.

## Categorie con transazioni recenti:

${buildSection(expenseCats, 'Spese')}

${buildSection(incomeCats, 'Entrate')}

${buildSection(savingCats, 'Risparmi')}
${uncatSection}

## Tipi di suggerimento:
- "merge": unire 2+ categorie con contenuto simile
- "rename": rinominare categoria con nome ambiguo o poco chiaro
- "split": dividere categoria troppo generica con transazioni eterogenee
- "create": creare nuova categoria per transazioni ricorrenti non categorizzate

Rispondi SOLO con un array JSON valido, senza testo aggiuntivo.
Se non ci sono miglioramenti significativi, restituisci [].

Schema (includi solo i campi pertinenti al tipo):
[
  {
    "type": "merge" | "rename" | "split" | "create",
    "category_type": "expense" | "income" | "saving",
    "priority": "high" | "medium" | "low",
    "reason": "motivazione breve (max 100 caratteri)",
    "category_ids": ["id1","id2"],
    "category_names": ["Nome1","Nome2"],
    "category_id": "id",
    "current_name": "Nome Attuale",
    "suggested_name": "Nuovo Nome",
    "suggested_icon": "emoji",
    "suggested_names": [{"name":"Nome","icon":"emoji"}],
    "example_descriptions": ["desc1","desc2"]
  }
]`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Errore API AI' }, { status: 502 })
    }

    const aiData = await res.json()
    const text: string = aiData.content?.[0]?.text ?? '[]'

    let suggestions: unknown[] = []
    const match = text.match(/\[[\s\S]*\]/)
    if (match) {
      try { suggestions = JSON.parse(match[0]) } catch { /* restituisce [] */ }
    }

    return NextResponse.json({
      suggestions,
      analyzed_transactions: txList.length,
      analyzed_categories: allCats.length,
    })
  } catch {
    return NextResponse.json({ error: 'Errore interno AI' }, { status: 500 })
  }
}
