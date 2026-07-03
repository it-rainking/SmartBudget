import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { secretsMatch } from '@/lib/security'
import type { Database } from '@/types/database'

// Cron worker server-side: calcola notifiche automatiche, deduplica, persiste e invia
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!cronSecret || !authHeader || !secretsMatch(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Recupera utenti con almeno un canale di notifica abilitato
  const { data: usersSettings } = await supabase
    .from('settings')
    .select('user_id, notify_email, notify_telegram')
    .or('notify_email.eq.true,notify_telegram.eq.true')

  if (!usersSettings?.length) return NextResponse.json({ ok: true, processed: 0 })

  const today = new Date().toISOString().split('T')[0]
  const results = await Promise.allSettled(
    usersSettings.map((s) => processUserNotifications(supabase, s.user_id as string, today))
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length
  return NextResponse.json({ ok: true, processed: sent })
}

async function processUserNotifications(
  supabase: SupabaseClient<Database>,
  userId: string,
  today: string
) {
  // 1. Recupera i dati necessari per il calcolo delle notifiche
  const [invoicesRes, goalsRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('id,name,amount,due_date,status')
      .eq('user_id', userId),
    supabase
      .from('goals')
      .select('id,name,target_amount,current_amount,deadline,is_completed')
      .eq('user_id', userId)
      .eq('is_completed', false),
  ])

  const notifications: Array<{
    type: 'bill_due' | 'goal_progress'
    title: string
    message: string
    data: Record<string, unknown>
  }> = []

  // Fatture in scadenza nei prossimi 3 giorni (escluse pagate/annullate)
  // Confronto su stringhe YYYY-MM-DD per evitare problemi di timezone con new Date('YYYY-MM-DD')
  const in3DaysStr = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toISOString().split('T')[0]
  })()
  for (const inv of (invoicesRes.data ?? []) as Array<Record<string, unknown>>) {
    if (inv.status === 'paid' || inv.status === 'cancelled') continue
    const dueStr = inv.due_date as string
    if (dueStr >= today && dueStr <= in3DaysStr) {
      // Normalizza a mezzogiorno per calcolare daysLeft senza edge case DST
      const dueNoon = new Date(`${dueStr}T12:00:00`)
      const daysLeft = Math.round((dueNoon.getTime() - Date.now()) / 86400000)
      notifications.push({
        type: 'bill_due',
        title: `Fattura in scadenza: ${inv.name}`,
        message: daysLeft <= 0 ? 'Scade oggi!' : `Scade tra ${daysLeft} giorno${daysLeft > 1 ? 'i' : ''}`,
        data: { source_id: inv.id },
      })
    }
  }

  // Obiettivi al 90% o più di completamento
  for (const goal of (goalsRes.data ?? []) as Array<Record<string, unknown>>) {
    const target = Number(goal.target_amount) || 0
    const current = Number(goal.current_amount) || 0
    const pct = target > 0 ? current / target : 0
    if (pct >= 0.9) {
      notifications.push({
        type: 'goal_progress',
        title: `Obiettivo quasi raggiunto: ${goal.name}`,
        message: `Sei al ${Math.round(pct * 100)}% del tuo obiettivo!`,
        data: { source_id: goal.id },
      })
    }
  }

  if (!notifications.length) return

  // 2. Deduplicazione: scarta notifiche già generate nelle ultime 24h (stesso type + source_id)
  const since = new Date(Date.now() - 86400000).toISOString()
  const { data: recent } = await supabase
    .from('notifications')
    .select('type, data')
    .eq('user_id', userId)
    .gte('created_at', since)

  const recentKeys = new Set(
    (recent ?? []).map(
      (n) => `${n.type}:${(n.data as Record<string, unknown> | null)?.source_id ?? ''}`
    )
  )

  const newNotifs = notifications.filter(
    (n) => !recentKeys.has(`${n.type}:${n.data.source_id ?? ''}`)
  )
  if (!newNotifs.length) return

  // 3. Persisti le nuove notifiche
  await supabase
    .from('notifications')
    .insert(newNotifs.map((n) => ({ ...n, user_id: userId })))

  // 4. Invia ogni notifica tramite i canali configurati (email/Telegram)
  const origin = process.env.NEXT_PUBLIC_APP_URL
  if (!origin) return
  const secret = process.env.CRON_SECRET!
  await Promise.allSettled(
    newNotifs.map((n) =>
      fetch(`${origin}/api/notifications/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ user_id: userId, title: n.title, message: n.message }),
      })
    )
  )
}
