'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSettings, useCompleteOnboarding } from '@/hooks/useSettings'

const CURRENCIES = [
  { code: 'EUR', label: 'Euro (€)', symbol: '€' },
  { code: 'USD', label: 'Dollaro ($)', symbol: '$' },
  { code: 'GBP', label: 'Sterlina (£)', symbol: '£' },
  { code: 'CHF', label: 'Franco Svizzero (CHF)', symbol: 'CHF' },
]

const DEFAULT_CATEGORIES = {
  income: ['💼 Stipendio', '💻 Freelance', '📈 Investimenti', '🎁 Bonus', '💰 Altro Reddito'],
  expense: ['🏠 Casa', '🚗 Trasporti', '🛒 Alimentari', '💡 Utenze', '🏥 Salute', '🎬 Intrattenimento', '🛍️ Shopping', '🍽️ Ristoranti', '📚 Istruzione', '✈️ Viaggi', '📱 Abbonamenti', '📦 Altro'],
  saving: ['🆘 Fondo Emergenza', '🏖️ Vacanze', '🏡 Casa', '👴 Pensione', '📊 Investimenti', '🎯 Altro'],
}

export default function OnboardingPage() {
  const router = useRouter()
  const { data: settings, isLoading } = useSettings()
  const completeOnboarding = useCompleteOnboarding()

  const [step, setStep] = useState(1)
  const [currency, setCurrency] = useState('EUR')
  const [initialBalance, setInitialBalance] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && settings?.onboarding_completed) {
      router.replace('/dashboard/mensile')
    }
  }, [isLoading, settings, router])

  const handleComplete = async () => {
    setError(null)
    try {
      await completeOnboarding.mutateAsync({
        initialBalance: parseFloat(initialBalance) || 0,
        currency,
      })
      router.push('/dashboard/mensile')
    } catch {
      setError('Si è verificato un errore. Riprova.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-zinc-900 dark:to-zinc-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-zinc-900 dark:to-zinc-800 p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    s < step
                      ? 'bg-emerald-500 text-white'
                      : s === step
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-200 dark:ring-emerald-900'
                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
                  }`}
                >
                  {s < step ? '✓' : s}
                </div>
                {s < 3 && (
                  <div
                    className={`h-1 w-24 sm:w-40 mx-1 rounded transition-colors ${
                      s < step ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 px-1">
            <span>Impostazioni</span>
            <span>Categorie</span>
            <span>Pronto!</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Step 1: Settings */}
          {step === 1 && (
            <div className="p-8">
              <div className="text-center mb-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-3xl text-white shadow-lg mx-auto mb-4">
                  💰
                </div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                  Benvenuto in SmartBudget!
                </h1>
                <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                  Configuriamo il tuo account in pochi passi
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Valuta principale
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Saldo iniziale (opzionale)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400 font-medium">
                      {CURRENCIES.find(c => c.code === currency)?.symbol}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Il saldo attuale dei tuoi conti. Puoi modificarlo in seguito.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full mt-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Continua →
              </button>
            </div>
          )}

          {/* Step 2: Categories preview */}
          {step === 2 && (
            <div className="p-8">
              <div className="text-center mb-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500 text-3xl text-white shadow-lg mx-auto mb-4">
                  🗂️
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                  Categorie predefinite
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                  Creeremo queste categorie per iniziare. Potrai personalizzarle in seguito.
                </p>
              </div>

              <div className="space-y-4 max-h-64 overflow-y-auto">
                {Object.entries(DEFAULT_CATEGORIES).map(([type, cats]) => {
                  const labels: Record<string, string> = { income: 'Entrate', expense: 'Spese', saving: 'Risparmi' }
                  const colors: Record<string, string> = {
                    income: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
                    expense: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
                    saving: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
                  }
                  return (
                    <div key={type} className={`rounded-lg border p-3 ${colors[type]}`}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                        {labels[type]}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {cats.map((cat) => (
                          <span key={cat} className="text-xs bg-white dark:bg-zinc-800 px-2 py-1 rounded-full text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-600">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  ← Indietro
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Continua →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && (
            <div className="p-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500 text-4xl text-white shadow-lg mx-auto mb-6">
                🚀
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">
                Tutto pronto!
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-8">
                Il tuo account è configurato. Inizia ad aggiungere le tue entrate e spese per monitorare il tuo budget.
              </p>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="space-y-3 text-left mb-8">
                {[
                  { icon: '💳', text: 'Registra le tue transazioni' },
                  { icon: '📅', text: 'Pianifica il budget mensile' },
                  { icon: '📊', text: 'Monitora entrate e spese sulla dashboard' },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 px-4 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  ← Indietro
                </button>
                <button
                  onClick={handleComplete}
                  disabled={completeOnboarding.isPending}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  {completeOnboarding.isPending ? 'Configurazione...' : 'Inizia ora!'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
