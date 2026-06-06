import { NextResponse } from 'next/server'

// POST /api/ai/insights
// Genera 3 insight personalizzati sui dati finanziari del mese usando Claude.
// Richiede ANTHROPIC_API_KEY nell'ambiente server.
export async function POST(req: Request) {
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
        model: 'claude-haiku-4-5-20251001',
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

    return NextResponse.json({ insights })
  } catch {
    return NextResponse.json({ error: 'Errore interno AI' }, { status: 500 })
  }
}
