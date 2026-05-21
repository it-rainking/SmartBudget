'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

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

  const [currency, setCurrency] = useState('EUR')
  const [locale, setLocale] = useState('it-IT')
  const [initialBalance, setInitialBalance] = useState('0')
  const [isDirty, setIsDirty] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (settings) {
      setCurrency(settings.currency)
      setLocale(settings.locale)
      setInitialBalance(String(settings.initial_balance ?? 0))
      setIsDirty(false)
    }
  }, [settings])

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
    setIsExporting(true)
    try {
      const { data: transactions } = await supabase.from('transactions').select('*').order('date', { ascending: false })
      const { data: invoices } = await supabase.from('invoices').select('*')
      const { data: goals } = await supabase.from('goals').select('*')
      const { data: budgets } = await supabase.from('monthly_budgets').select('*, monthly_budget_items(*)')

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

  async function handleDeleteAccount() {
    if (deleteInput !== 'ELIMINA') return
    try {
      await supabase.from('transactions').delete().neq('id', '')
      await supabase.from('invoices').delete().neq('id', '')
      await supabase.from('goals').delete().neq('id', '')
      await supabase.from('monthly_budget_items').delete().neq('id', '')
      await supabase.from('monthly_budgets').delete().neq('id', '')
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

        {/* GDPR / Export */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1 uppercase tracking-wide">Privacy & Dati</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Hai il diritto di esportare tutti i tuoi dati (GDPR Art. 20)</p>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            <span>📥</span>
            {isExporting ? 'Esportazione...' : 'Esporta tutti i dati (JSON)'}
          </button>
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
