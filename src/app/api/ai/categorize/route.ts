import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const MAX_DESCRIPTIONS = 100
const MAX_DESC_LENGTH = 200

// POST /api/ai/categorize
// Usa Claude per suggerire categorie di spesa/entrata a partire dalle descrizioni.
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

  let body: { descriptions: string[]; categories: { id: string; name: string }[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  let { descriptions, categories } = body
  if (!descriptions?.length || !categories?.length) {
    return NextResponse.json({ suggestions: [] })
  }
  descriptions = descriptions.slice(0, MAX_DESCRIPTIONS).map(d => String(d).slice(0, MAX_DESC_LENGTH))

  const catList = categories.map(c => c.name).join(', ')
  const descList = descriptions.map((d, i) => `${i + 1}. "${d}"`).join('\n')

  const prompt = `Hai le seguenti categorie disponibili: ${catList}

Per ognuna delle seguenti descrizioni di transazioni, scegli la categoria più appropriata. Se nessuna si adatta, rispondi "Non categorizzato".

Rispondi SOLO con un array JSON della stessa lunghezza dell'input, dove ogni elemento è il nome esatto della categoria (o "Non categorizzato"). Nessun testo aggiuntivo.

Esempio output: ["Alimentari", "Trasporti", "Non categorizzato"]

Descrizioni:
${descList}`

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

    let names: string[] = []
    const match = text.match(/\[[\s\S]*?\]/)
    if (match) {
      try { names = JSON.parse(match[0]) } catch { /* fallback below */ }
    }
    if (names.length !== descriptions.length) {
      names = descriptions.map(() => 'Non categorizzato')
    }

    const suggestions = descriptions.map((desc, i) => {
      const catName = names[i] ?? 'Non categorizzato'
      const cat = categories.find(c => c.name === catName)
      return { description: desc, category_id: cat?.id ?? null, category_name: catName }
    })

    return NextResponse.json({ suggestions })
  } catch {
    return NextResponse.json({ error: 'Errore interno AI' }, { status: 500 })
  }
}
