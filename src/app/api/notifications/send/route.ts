import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// POST /api/notifications/send
// Invia una notifica (email via Resend e/o Telegram) in base alle preferenze utente.
// Endpoint server-side: usa la service role key, mai esposta al client.
export async function POST(req: Request) {
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

// Invio email tramite Resend
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
        subject,
        html: `<p>${text}</p>`,
      }),
    })
    return { status: res.status, ok: res.ok }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Email send failed' }
  }
}

// Invio messaggio tramite Telegram Bot API
async function sendTelegram(chat_id: string, title: string, text: string) {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id,
          text: `*${title}*\n${text}`,
          parse_mode: 'Markdown',
        }),
      }
    )
    return { status: res.status, ok: res.ok }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Telegram send failed' }
  }
}
