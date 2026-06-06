import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// POST /api/notifications/send
// Invia una notifica (email via Resend e/o Telegram) in base alle preferenze utente.
// Endpoint server-side: usa la service role key, mai esposta al client.
export async function POST(req: Request) {
  // Autenticazione a due livelli:
  // 1. Chiamate server-to-server (cron/test): Bearer CRON_SECRET
  // 2. Chiamate dal client autenticato: verifica SSR session e user_id
  const authHeader = req.headers.get('authorization')
  const isServerCall = authHeader === `Bearer ${process.env.CRON_SECRET}`

  let body: { user_id?: string; title?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { user_id, title, message } = body
  if (!user_id || !title || !message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (!isServerCall) {
    // Verifica sessione SSR e che l'utente corrisponda al user_id nel body
    const cookieStore = await cookies()
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user: authUser } } = await authClient.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (authUser.id !== user_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Recupera le preferenze di notifica dell'utente
  const { data: settings, error } = await supabase
    .from('settings')
    .select('notify_email, notify_telegram, notification_email, telegram_chat_id')
    .eq('user_id', user_id)
    .single()

  if (error) {
    return NextResponse.json({ error: 'Settings not found' }, { status: 404 })
  }

  const results: Record<string, unknown> = {}

  // Invio email se abilitato e indirizzo configurato
  if (settings?.notify_email && settings?.notification_email) {
    results.email = await sendEmail(settings.notification_email, title, message)
  }
  // Invio Telegram se abilitato e chat_id configurato
  if (settings?.notify_telegram && settings?.telegram_chat_id) {
    results.telegram = await sendTelegram(settings.telegram_chat_id, title, message)
  }

  return NextResponse.json({ ok: true, results })
}

// Invio email tramite Resend con contenuto HTML escapato
async function sendEmail(to: string, subject: string, text: string) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SmartBudget <onboarding@resend.dev>',
        to,
        subject: escapeHtml(subject),
        html: `<p>${escapeHtml(text)}</p>`,
      }),
    })
    return { status: res.status, ok: res.ok }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Email send failed' }
  }
}

// Invio messaggio tramite Telegram Bot API — senza parse_mode per evitare markdown injection
async function sendTelegram(chat_id: string, title: string, text: string) {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id,
          text: `${title}\n${text}`,
        }),
      }
    )
    return { status: res.status, ok: res.ok }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Telegram send failed' }
  }
}
