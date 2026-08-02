import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { Database } from '@/types/database'

// GET /api/investments/tickers
// Ritorna la lista (testo incollabile, un ticker per riga) dei ticker Google
// Finance dell'utente, da incollare nella colonna A del Sheet ponte.
export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { data } = await supabase
    .from('assets')
    .select('ticker_gf')
    .eq('user_id', user.id)
    .neq('ticker_gf', '')
    .order('ticker_gf')

  const text = [...new Set((data ?? []).map((a) => a.ticker_gf))].join('\n')
  return new NextResponse(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
