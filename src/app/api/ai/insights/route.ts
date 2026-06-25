import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Modello Claude da usare. Sovrascrivi con la variabile d'ambiente ANTHROPIC_MODEL.
// claude-haiku-4-5-20251001  — veloce, economico ($0.80/$4.00 per MTok in/out)
// claude-sonnet-4-6           — bilanciato ($3.00/$15.00 per MTok in/out)
// claude-opus-4-8             — più capace ($15.00/$75.00 per MTok in/out)
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

// POST /api/ai/insights
// Genera 3 insight personalizzati sui dati finanziari del mese usando Claude.
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

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI non configurata (manca ANTHROPIC_API_KEY)' }, { status: 503 })
  }

  let body: {
    month: number
    year: number
    kpis: {
      totalIncome: number
      totalExpenses: number
      totalSavings: number
      balance: number
      savingsPercent: number
      dailyAverage: number
      deltaExpensePercent: number | null
      prevMonthExpenses: number
    }
    categoryBreakdown: Record<string, number>
    categoryNames: Record<string, string>
    currency: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const { month, year, kpis, categoryBreakdown, categoryNames, currency } = body
  if (!month || !year || !kpis) {
    return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
  }
  const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
  const monthName = MONTHS_IT[month - 1] ?? `Mese ${month}`

  // Prepara il top 3 categorie per spesa
  const topCats = Object.entries(categoryBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([id, amt]) => `${categoryNames[id] ?? 'Altro'}: ${amt.toFixed(2)} ${currency}`)
    .join(', ')

  const prompt = `Sei un consulente finanziario personale che analizza i dati finanziari di un utente.

Dati di ${monthName} ${year}:
- Entrate totali: ${kpis.totalIncome.toFixed(2)} ${currency}
- Spese totali: ${kpis.totalExpenses.toFixed(2)} ${currency}
- Risparmi: ${kpis.totalSavings.toFixed(2)} ${currency}
- Saldo netto: ${kpis.balance.toFixed(2)} ${currency}
- Tasso di risparmio: ${kpis.savingsPercent}%
- Spesa giornaliera media: ${kpis.dailyAverage.toFixed(2)} ${currency}
- Variazione spese vs mese precedente: ${kpis.deltaExpensePercent !== null ? `${kpis.deltaExpensePercent > 0 ? '+' : ''}${kpis.deltaExpensePercent}%` : 'N/D'}
- Top 3 categorie di spesa: ${topCats || 'nessuna'}

Genera esattamente 3 insight finanziari in italiano, concisi (max 2 frasi ciascuno), pratici e personalizzati su questi dati.
Sii specifico sui numeri, non generico.
Rispondi SOLO con un array JSON di 3 stringhe, nessun testo aggiuntivo.
Esempio: ["Insight 1", "Insight 2", "Insight 3"]`

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
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Errore API AI' }, { status: 502 })
    }

    const data = await res.json()
    const text: string = data.content?.[0]?.text ?? '[]'

    let insights: string[] = []
    const match = text.match(/\[[\s\S]*?\]/)
    if (match) {
      try { insights = JSON.parse(match[0]) } catch { /* fallback */ }
    }
    if (!insights.length) {
      insights = [text.trim()]
    }

    const usage = data.usage ?? {}
    return NextResponse.json({ insights, usage })
  } catch {
    return NextResponse.json({ error: 'Errore interno AI' }, { status: 500 })
  }
}
