import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// POST /api/notifications/test
// Invia una notifica di test all'utente autenticato.
// L'utente viene identificato dalla sessione Supabase (cookie), non dal body.
export async function POST() {
  // Identifica l'utente dalla sessione corrente
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          // No-op: in una route handler non scriviamo i cookie di sessione
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Inoltra a /api/notifications/send con un messaggio di test fisso
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  try {
    const res = await fetch(`${origin}/api/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        title: 'Test SmartBudget',
        message: 'Le notifiche sono configurate correttamente! 🎉',
      }),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Test send failed' },
      { status: 500 }
    )
  }
}
