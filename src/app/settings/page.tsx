'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeProvider'

const CURRENCIES = [
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'CHF', label: 'Swiss Franc (CHF)' },
  { code: 'JPY', label: 'Japanese Yen (¥)' },
  { code: 'CAD', label: 'Canadian Dollar (CA$)' },
]

const LOCALES = [
  { code: 'it-IT', label: 'Italiano' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'de-DE', label: 'Deutsch' },
]

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const { user, signOut } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  const [currency, setCurrency] = useState('EUR')
  const [locale, setLocale] = useState('it-IT')
  const [initialBalance, setInitialBalance] = useState('0')
  const [isDirty, setIsDirty] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingCSV, setIsExportingCSV] = useState(false)
  const [isSendingTest, setIsSendingTest] = useState(false)

  // Stato locale preferenze notifiche
  const [notifyEmail, setNotifyEmail] = useState(settings?.notify_email ?? false)
  const [notifyTelegram, setNotifyTelegram] = useState(settings?.notify_telegram ?? false)
  const [telegramChatId, setTelegramChatId] = useState(settings?.telegram_chat_id ?? '')
  const [notificationEmail, setNotificationEmail] = useState(settings?.notification_email ?? '')

  useEffect(() => {
    if (settings) {
      setCurrency(settings.currency)
      setLocale(settings.locale)
      setInitialBalance(String(settings.initial_balance ?? 0))
      setNotifyEmail(settings.notify_email ?? false)
      setNotifyTelegram(settings.notify_telegram ?? false)
      setTelegramChatId(settings.telegram_chat_id ?? '')
      setNotificationEmail(settings.notification_email ?? '')
      setIsDirty(false)
    }
  }, [settings])

  // Salva preferenze notifiche
  async function saveNotificationSettings() {
    try {
      await updateSettings.mutateAsync({
        notify_email: notifyEmail,
        notify_telegram: notifyTelegram,
        telegram_chat_id: telegramChatId || null,
        notification_email: notificationEmail || null,
      })
      showToast('Preferenze notifiche salvate', 'success')
    } catch {
      showToast('Errore nel salvataggio', 'error')
    }
  }

  // Invia una notifica di test tramite la route server-side
  // Salva prima le preferenze correnti, così il test usa sempre la configurazione visualizzata
  async function handleSendTest() {
    setIsSendingTest(true)
    try {
      await updateSettings.mutateAsync({
        notify_email: notifyEmail,
        notify_telegram: notifyTelegram,
        telegram_chat_id: telegramChatId || null,
        notification_email: notificationEmail || null,
      })

      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data?.error || 'Errore nell\'invio della notifica di test', 'error')
        return
      }

      const results = (data?.results ?? {}) as Record<string, { ok?: boolean } | undefined>
      const failed: string[] = []
      if (notifyTelegram && !results.telegram?.ok) failed.push('Telegram')
      if (notifyEmail && !results.email?.ok) failed.push('Email')

      if (failed.length > 0) {
        showToast(`Invio non riuscito (${failed.join(', ')}). Verifica token/chat ID e che tu abbia avviato una chat con il bot.`, 'error')
      } else if (!notifyTelegram && !notifyEmail) {
        showToast('Attiva almeno un canale di notifica prima di testare', 'info')
      } else {
        showToast('Notifica di test inviata', 'success')
      }
    } catch {
      showToast('Errore nell\'invio della notifica di test', 'error')
    } finally {
      setIsSendingTest(false)
    }
  }

  function markDirty() { setIsDirty(true) }

  async function handleSave() {
    try {
      await updateSettings.mutateAsync({
        currency,
        locale,
        initial_balance: parseFloat(initialBalance) || 0,
      })
      showToast('Impostazioni salvate', 'success')
      setIsDirty(false)
    } catch {
      showToast('Errore nel salvataggio', 'error')
    }
  }

  async function handleExport() {
    if (!user) return
    setIsExporting(true)
    try {
      const uid = user.id
      const { data: transactions } = await supabase.from('transactions').select('*').eq('user_id', uid).order('date', { ascending: false })
      const { data: invoices } = await supabase.from('invoices').select('*').eq('user_id', uid)
      const { data: goals } = await supabase.from('goals').select('*').eq('user_id', uid)
      const { data: budgets } = await supabase.from('monthly_budgets').select('*, monthly_budget_items(*)').eq('user_id', uid)

      const exportData = {
        exported_at: new Date().toISOString(),
        user_email: user?.email,
        settings,
        transactions: transactions ?? [],
        invoices: invoices ?? [],
        goals: goals ?? [],
        budgets: budgets ?? [],
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `smartbudget-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Dati esportati', 'success')
    } catch {
      showToast('Errore durante l\'esportazione', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleExportCSV() {
    setIsExportingCSV(true)
    try {
      const [{ data: transactions }, { data: expCats }, { data: incCats }, { data: savCats }] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('expense_categories').select('id, name'),
        supabase.from('income_categories').select('id, name'),
        supabase.from('saving_categories').select('id, name'),
      ])

      const catMap: Record<string, string> = {}
      ;[...(expCats ?? []), ...(incCats ?? []), ...(savCats ?? [])].forEach(c => { catMap[c.id] = c.name })

      const TYPE_IT: Record<string, string> = {
        income: 'Entrata', expense: 'Spesa', saving: 'Risparmio', debt: 'Debito',
      }

      const rows = [
        ['Data', 'Tipo', 'Categoria', 'Importo', 'Descrizione', 'Metodo di pagamento'].join(';'),
        ...(transactions ?? []).map(t => [
          t.date,
          TYPE_IT[t.type] ?? t.type,
          t.category_id ? (catMap[t.category_id] ?? '') : 'Non categorizzato',
          String(t.amount).replace('.', ','),
          (t.description ?? '').replace(/;/g, ','),
          t.payment_method ?? '',
        ].join(';')),
      ]

      const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transazioni-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showToast('CSV esportato', 'success')
    } catch {
      showToast('Errore durante l\'esportazione CSV', 'error')
    } finally {
      setIsExportingCSV(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteInput !== 'ELIMINA' || !user) return
    try {
      const uid = user.id
      await supabase.from('transactions').delete().eq('user_id', uid)
      await supabase.from('invoices').delete().eq('user_id', uid)
      await supabase.from('goals').delete().eq('user_id', uid)
      await supabase.from('monthly_budget_items').delete().eq('user_id', uid)
      await supabase.from('monthly_budgets').delete().eq('user_id', uid)
      await signOut()
      router.push('/login')
    } catch {
      showToast('Errore durante l\'eliminazione', 'error')
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Impostazioni</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Gestisci il tuo account e le preferenze</p>
        </div>

        {/* Account info */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4 uppercase tracking-wide">Account</h2>
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xl font-bold">
              {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-white">
                {user?.user_metadata?.full_name || 'Utente'}
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{user?.email}</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                Account creato il {user?.created_at ? new Date(user.created_at).toLocaleDateString('it-IT') : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4 uppercase tracking-wide">Preferenze</h2>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-zinc-100 dark:bg-zinc-700 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Valuta</label>
                <select
                  value={currency}
                  onChange={e => { setCurrency(e.target.value); markDirty() }}
                  className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Lingua / Formato numeri</label>
                <select
                  value={locale}
                  onChange={e => { setLocale(e.target.value); markDirty() }}
                  className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {LOCALES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Saldo iniziale ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  value={initialBalance}
                  onChange={e => { setInitialBalance(e.target.value); markDirty() }}
                  className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Saldo di partenza usato come base per i calcoli</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Tema</label>
                <div className="flex gap-2">
                  {([
                    { value: 'light', label: '☀️ Chiaro' },
                    { value: 'dark', label: '🌙 Scuro' },
                    { value: 'system', label: '💻 Sistema' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTheme(opt.value)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        theme === opt.value
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                          : 'border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {isDirty && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSave}
                    disabled={updateSettings.isPending}
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {updateSettings.isPending ? 'Salvataggio...' : 'Salva modifiche'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notifiche */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4 uppercase tracking-wide">Notifiche</h2>

          <div className="space-y-4">
            {/* Toggle Email */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Notifiche Email</span>
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={e => setNotifyEmail(e.target.checked)}
                className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-600 text-emerald-500 focus:ring-emerald-500"
              />
            </label>

            {notifyEmail && (
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Indirizzo email per le notifiche</label>
                <input
                  type="email"
                  value={notificationEmail}
                  onChange={e => setNotificationEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

            {/* Toggle Telegram */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Notifiche Telegram</span>
              <input
                type="checkbox"
                checked={notifyTelegram}
                onChange={e => setNotifyTelegram(e.target.checked)}
                className="h-5 w-5 rounded border-zinc-300 dark:border-zinc-600 text-emerald-500 focus:ring-emerald-500"
              />
            </label>

            {notifyTelegram && (
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Chat ID Telegram</label>
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={e => setTelegramChatId(e.target.value)}
                  placeholder="123456789"
                  className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                  Apri prima una chat con il tuo bot (creato su @BotFather) e invia /start, altrimenti Telegram blocca i messaggi.
                  Poi scrivi a @userinfobot per ottenere il tuo Chat ID.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
              <button
                onClick={handleSendTest}
                disabled={isSendingTest}
                className="px-5 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {isSendingTest ? 'Invio...' : 'Invia notifica di test'}
              </button>
              <button
                onClick={saveNotificationSettings}
                disabled={updateSettings.isPending}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {updateSettings.isPending ? 'Salvataggio...' : 'Salva preferenze notifiche'}
              </button>
            </div>
          </div>
        </div>

        {/* GDPR / Export */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1 uppercase tracking-wide">Privacy & Dati</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Hai il diritto di esportare tutti i tuoi dati (GDPR Art. 20)</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              <span>📥</span>
              {isExporting ? 'Esportazione...' : 'Esporta tutti i dati (JSON)'}
            </button>
            <button
              onClick={handleExportCSV}
              disabled={isExportingCSV}
              className="flex items-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              <span>📊</span>
              {isExportingCSV ? 'Esportazione...' : 'Esporta transazioni (CSV)'}
            </button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm border border-red-200 dark:border-red-900/40">
          <h2 className="text-sm font-semibold text-red-600 mb-1 uppercase tracking-wide">Zona Pericolosa</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Queste azioni sono irreversibili</p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              <span>🚪</span> Esci dall&apos;account
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <span>🗑️</span> Elimina tutti i dati
            </button>
          </div>
        </div>

      </div>

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">⚠️</div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Eliminare tutti i dati?</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Questa azione eliminerà permanentemente tutte le tue transazioni, fatture, obiettivi e budget.
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Scrivi <strong>ELIMINA</strong> per confermare
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                className="w-full px-3 py-2 border border-red-300 dark:border-red-600 rounded-lg text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="ELIMINA"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput('') }}
                className="flex-1 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteInput !== 'ELIMINA'}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
