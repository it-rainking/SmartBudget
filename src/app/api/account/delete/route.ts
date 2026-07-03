import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// POST /api/account/delete
// Elimina tutti i dati dell'utente autenticato e l'account Auth stesso
// (diritto all'oblio GDPR Art. 17). Richiede la service role key perché
// l'eliminazione dell'utente Auth non è possibile dal client.
export async function POST() {
  const cookieStore = await cookies()
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const uid = user.id
  try {
    await Promise.all([
      supabase.from('transactions').delete().eq('user_id', uid),
      supabase.from('invoices').delete().eq('user_id', uid),
      supabase.from('goals').delete().eq('user_id', uid),
      supabase.from('notifications').delete().eq('user_id', uid),
      supabase.from('debt_items').delete().eq('user_id', uid),
    ])
    await supabase.from('monthly_budget_items').delete().eq('user_id', uid)
    await supabase.from('monthly_budgets').delete().eq('user_id', uid)
    await Promise.all([
      supabase.from('expense_subcategories').delete().eq('user_id', uid),
      supabase.from('income_categories').delete().eq('user_id', uid),
      supabase.from('expense_categories').delete().eq('user_id', uid),
      supabase.from('saving_categories').delete().eq('user_id', uid),
    ])
    await supabase.from('settings').delete().eq('user_id', uid)
    await supabase.from('profiles').delete().eq('id', uid)

    const { error: authError } = await supabase.auth.admin.deleteUser(uid)
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Errore durante l\'eliminazione' },
      { status: 500 }
    )
  }
}
