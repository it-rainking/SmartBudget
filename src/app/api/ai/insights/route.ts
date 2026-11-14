import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rateLimit'
import { callClaudeTool, MODEL_ANALYSIS, type ClaudeTool } from '@/lib/ai/claude'
import { buildFacts, type AiCategory, type AiRecurringModel, type AiTx } from '@/lib/ai/facts'

const RATE_LIMIT = 20
const RATE_WINDOW_MS = 10 * 60 * 1000
const HISTORY_MONTHS = 3
const PAGE_SIZE = 1000
const MAX_PAGES = 6 // l'API Supabase limita a 1000 righe per richiesta

const MONTHS_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

const SYSTEM = `Sei l'analista finanziario di SmartBudget, un'app italiana di gestione delle finanze personali.
Ricevi un elenco di FATTI già calcolati sui dati reali dell'utente. Il tuo compito è scegliere i più utili, spiegarli in modo chiaro e dire cosa fare.

Regole:
- Usa SOLO i numeri presenti nei fatti. Non inventare cifre, non fare calcoli nuovi, non citare dati che non ci sono.
- Scegli da 1 a 3 fatti, in ordine di importanza per il portafoglio dell'utente. Meno è meglio: se i fatti sono poco rilevanti, restituisci meno insight o nessuno.
- Mai consigli generici ("spendi meno", "controlla le spese", "risparmia di più"). Ogni azione deve riferirsi a una voce concreta citata nel fatto e poter essere fatta oggi.
- Se un fatto è una buona notizia (positive: true) dillo in modo sobrio, senza esagerare; l'azione può essere assente.
- Se il mese è in corso, parla di proiezione e ritmo, non di totali finali. Se le entrate sono stimate, dillo.
- Tono diretto e concreto, in italiano, dando del tu. Niente emoji, niente premesse, niente ripetizione dei dati già evidenti.
- Gli importi sono già formattati nei fatti: riportali identici.`

const TOOL: ClaudeTool = {
  name: 'report_insights',
  description: "Restituisce gli insight scelti, ognuno basato su uno o più fatti dell'elenco.",
  input_schema: {
    type: 'object',
    properties: {
      insights: {
        type: 'array',
        maxItems: 3,
        items: {
          type: 'object',
          properties: {
            fact_ids: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'ID dei fatti su cui si basa (es. F1)' },
            title: { type: 'string', description: 'Titolo di massimo 6 parole' },
            text: { type: 'string', description: 'Spiegazione in 1-2 frasi con i numeri dei fatti' },
            action: { type: 'string', description: "Azione concreta da fare, 1 frase. Stringa vuota se è una buona notizia senza nulla da fare" },
            tone: { type: 'string', enum: ['alert', 'warning', 'info', 'positive'] },
          },
          required: ['fact_ids', 'title', 'text', 'action', 'tone'],
        },
      },
    },
    required: ['insights'],
  },
}

interface RawInsight {
  fact_ids: string[]
  title: string
  text: string
  action: string
  tone: 'alert' | 'warning' | 'info' | 'positive'
}

// POST /api/ai/insights   body: { month, year }
// Carica i dati dell'utente, calcola i fatti rilevanti (src/lib/ai/facts.ts) e
// chiede a Claude di sceglierli e formularli. Richiede sessione e ANTHROPIC_API_KEY.
export async function POST(req: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  if (!checkRateLimit(`ai:insights:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: 'Troppe richieste, riprova più tardi' }, { status: 429 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI non configurata (manca ANTHROPIC_API_KEY)' }, { status: 503 })
  }

  let body: { month?: number; year?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }
  const month = Number(body.month)
  const year = Number(body.year)
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Mese o anno non validi' }, { status: 400 })
  }

  // Intervallo: primo giorno di (mese − 3) → ultimo giorno del mese richiesto
  const start = new Date(year, month - 1 - HISTORY_MONTHS, 1)
  const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`

  const [settingsRes, catsRes, recurringRes] = await Promise.all([
    supabase.from('settings').select('currency').eq('user_id', user.id).maybeSingle(),
    supabase.from('expense_categories').select('id, name, spending_group').eq('user_id', user.id),
    supabase.from('recurring_expenses').select('id, name, amount, start_date, is_active').eq('user_id', user.id),
  ])

  const txs: AiTx[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from('transactions')
      .select('type, amount, date, category_id, description, payment_method, is_exceptional, is_recurring, recurring_expense_id, installment_plan_id')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (error) return NextResponse.json({ error: 'Errore lettura dati' }, { status: 500 })
    for (const t of data ?? []) {
      txs.push({
        type: t.type,
        amount: Number(t.amount),
        date: t.date,
        category_id: t.category_id,
        description: t.description,
        payment_method: t.payment_method,
        is_exceptional: !!t.is_exceptional,
        is_recurring: !!t.is_recurring,
        recurring_expense_id: t.recurring_expense_id ?? null,
        installment_plan_id: t.installment_plan_id ?? null,
      })
    }
    if ((data?.length ?? 0) < PAGE_SIZE) break
  }

  const currency = settingsRes.data?.currency || 'EUR'
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })
  const { facts, context } = buildFacts({
    month,
    year,
    today,
    currency,
    txs,
    categories: (catsRes.data ?? []) as AiCategory[],
    recurring: (recurringRes.data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as AiRecurringModel[],
  })

  // Niente di rilevante: meglio dirlo che far inventare osservazioni al modello
  if (facts.length === 0) {
    return NextResponse.json({ insights: [], factCount: 0, baselineMonths: context.baselineMonths })
  }

  const prompt = [
    `Oggi è ${today}. Analisi di ${MONTHS_IT[month - 1]} ${year} (valuta: ${currency}).`,
    context.isCurrentMonth
      ? `Il mese è in corso: giorno ${context.elapsedDays} di ${context.daysInMonth}.`
      : 'Il mese è concluso.',
    context.baselineMonths === 0
      ? 'Non ci sono mesi precedenti con cui confrontare.'
      : `Termine di confronto: media dei ${context.baselineMonths} mesi precedenti.`,
    context.incomeEstimated ? 'Le entrate del mese non sono ancora registrate: i valori usano la media storica.' : null,
    '',
    'FATTI (ordinati per importanza decrescente):',
    ...facts.map((f) => `${f.id} [${f.kind}${f.positive ? ', positive: true' : ''}] ${f.text}`),
  ].filter((l): l is string => l !== null).join('\n')

  try {
    const result = await callClaudeTool<{ insights: RawInsight[] }>({
      apiKey,
      model: MODEL_ANALYSIS,
      system: SYSTEM,
      prompt,
      tool: TOOL,
      maxTokens: 1024,
    })
    if (!result.ok) return NextResponse.json({ error: 'Errore API AI' }, { status: 502 })

    const validIds = new Set(facts.map((f) => f.id))
    const insights = (result.input.insights ?? [])
      .filter((i) => i.title && i.text && i.fact_ids?.some((id) => validIds.has(id)))
      .slice(0, 3)
      .map((i) => ({
        title: i.title.trim(),
        text: i.text.trim(),
        action: i.action?.trim() || null,
        tone: i.tone,
      }))

    return NextResponse.json({
      insights,
      factCount: facts.length,
      baselineMonths: context.baselineMonths,
      usage: result.usage,
    })
  } catch {
    return NextResponse.json({ error: 'Errore interno AI' }, { status: 500 })
  }
}
