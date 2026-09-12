'use client'

import { Fragment, useRef, useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useToast } from '@/components/Toast'
import { useSettings } from '@/hooks/useSettings'
import { useDeleteManualPrice, useImportCsv, useInvestments, useSetManualPrice } from '@/hooks/useInvestments'
import { formatCurrency } from '@/lib/utils'
import type { AssetClass, ImportDiff, InvestmentPosition } from '@/types/investments'

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  etf_equity: 'ETF Azionari',
  etf_bond: 'ETF Obbligazionari',
  etf_thematic: 'ETF Tematici',
  stock: 'Azioni',
  bond: 'Obbligazioni',
  cash: 'Liquidità',
  other: 'Altro',
}

const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  etf_equity: '#10b981',
  etf_bond: '#3b82f6',
  etf_thematic: '#8b5cf6',
  stock: '#f59e0b',
  bond: '#0ea5e9',
  cash: '#6b7280',
  other: '#94a3b8',
}

// Tab per tipo di strumento, come nel portafoglio Fineco. Gli ETF stanno in un
// tab solo perché è così che si ragiona quando si guarda l'asset allocation
// ("quanto ho in ETF"), ma dentro restano separati per sotto-classe: un ETF
// obbligazionario e uno azionario non sono la stessa cosa.
const TABS = [
  { key: 'all', label: 'Tutte', classes: null },
  { key: 'etf', label: 'ETF', classes: ['etf_equity', 'etf_bond', 'etf_thematic'] },
  { key: 'stock', label: 'Azioni', classes: ['stock'] },
  { key: 'bond', label: 'Obbligazioni', classes: ['bond'] },
  { key: 'other', label: 'Altro', classes: ['cash', 'other'] },
] as const satisfies readonly { key: string; label: string; classes: readonly AssetClass[] | null }[]

type TabKey = (typeof TABS)[number]['key']

const POSITIONS_STALE_DAYS = 30

type SortKey = 'weight' | 'name' | 'pnl'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

// Form del prezzo manuale. Componente separato perché il suo stato deve
// azzerarsi a ogni apertura: montandolo solo quando serve, non c'è da
// sincronizzare i campi con la posizione selezionata.
function ManualPriceModal({
  position,
  onClose,
}: {
  position: InvestmentPosition
  onClose: () => void
}) {
  const setManualPrice = useSetManualPrice()
  const deleteManualPrice = useDeleteManualPrice()
  const { showToast } = useToast()

  const [price, setPrice] = useState(position.manual_price !== null ? String(position.manual_price) : '')
  const [pricedAt, setPricedAt] = useState(position.manual_priced_at ?? todayIso())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isPercentQuoted = position.price_divisor !== 1
  const parsed = Number(price.replace(',', '.'))
  const valid = price.trim() !== '' && isFinite(parsed) && parsed > 0

  async function handleSave() {
    if (!valid) {
      setError('Inserisci un prezzo maggiore di zero.')
      return
    }
    setError(null)
    try {
      await setManualPrice.mutateAsync({
        assetId: position.asset_id,
        price: parsed,
        pricedAt,
        note: note.trim() || null,
      })
      showToast('Prezzo aggiornato', 'success')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel salvataggio')
    }
  }

  async function handleDelete() {
    setError(null)
    try {
      await deleteManualPrice.mutateAsync(position.asset_id)
      showToast('Prezzo manuale rimosso', 'success')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nella rimozione')
    }
  }

  const busy = setManualPrice.isPending || deleteManualPrice.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-100 dark:border-zinc-700 w-full max-w-md p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Prezzo manuale</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{position.name}</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{position.isin}</p>
        </div>

        <div className="px-3 py-2 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg text-xs text-sky-700 dark:text-sky-400">
          {isPercentQuoted
            ? 'Titolo quotato in percentuale del nominale: inserisci la percentuale (es. 96,44), non il controvalore.'
            : `Prezzo per unità, in ${position.currency}.`}
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Prezzo</span>
            <input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={isPercentQuoted ? '96,44' : '100,00'}
              autoFocus
              className="mt-1 w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100"
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Data del prezzo</span>
            <input
              type="date"
              value={pricedAt}
              max={todayIso()}
              onChange={(e) => setPricedAt(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100"
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Nota (facoltativa)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="es. prezzo di chiusura Borsa Italiana"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100"
            />
          </label>
        </div>

        {error && (
          <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          {position.manual_price !== null ? (
            <button
              onClick={handleDelete}
              disabled={busy}
              className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
            >
              Rimuovi
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 text-sm rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              onClick={handleSave}
              disabled={busy || !valid}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InvestimentiPage() {
  const { data: settings } = useSettings()
  const { data: summary, isLoading, error: summaryError } = useInvestments()
  const importCsv = useImportCsv()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [sortKey, setSortKey] = useState<SortKey>('weight')
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [priceModal, setPriceModal] = useState<InvestmentPosition | null>(null)
  const [lastImportResult, setLastImportResult] = useState<{ diff: ImportDiff; warnings: string[] } | null>(null)
  // L'errore di import resta a video: il toast dura 3 secondi e i messaggi del
  // parser (colonne rilevate, formato del file) servono a capire cosa correggere.
  const [importError, setImportError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Valuta dei totali: la dice il riepilogo (che ha già convertito), con
  // settings come ripiego finché la risposta non è arrivata.
  const currency = summary?.base_currency || settings?.currency || 'EUR'
  const fmt = (n: number) => formatCurrency(n, currency)
  // Gli importi di una singola posizione restano nella valuta in cui sono
  // quotati: un carico in dollari scritto con il simbolo € sarebbe un errore.
  const fmtIn = (n: number, cur: string) => formatCurrency(n, cur)

  const positions = summary?.positions ?? []

  // Un tab senza posizioni non viene mostrato: meglio due tab pieni che cinque
  // di cui tre vuoti. "Tutte" resta sempre, anche a portafoglio vuoto.
  const visibleTabs = TABS.filter(
    (t) => t.classes === null || positions.some((p) => (t.classes as readonly AssetClass[]).includes(p.asset_class))
  )
  const currentTab = visibleTabs.find((t) => t.key === activeTab) ?? visibleTabs[0]
  const tabClasses = currentTab?.classes ?? null
  const tabPositions = tabClasses
    ? positions.filter((p) => (tabClasses as readonly AssetClass[]).includes(p.asset_class))
    : positions

  const sortedPositions = [...tabPositions].sort((a, b) => {
    if (sortKey === 'name') return a.name.localeCompare(b.name)
    if (sortKey === 'pnl') return b.pnl_pct - a.pnl_pct
    return b.weight_pct - a.weight_pct
  })

  // Sul tab ETF le righe restano raggruppate per sotto-classe: senza quella
  // separazione "ETF" diventa un calderone in cui azionario e obbligazionario
  // si confondono.
  const groupedPositions: { label: string | null; rows: InvestmentPosition[] }[] =
    currentTab?.key === 'etf'
      ? (['etf_equity', 'etf_bond', 'etf_thematic'] as const)
          .map((cls) => ({
            label: ASSET_CLASS_LABELS[cls],
            rows: sortedPositions.filter((p) => p.asset_class === cls),
          }))
          .filter((g) => g.rows.length > 0)
      : [{ label: null, rows: sortedPositions }]

  // Totali del tab, calcolati sui valori già convertiti: le posizioni senza
  // cambio restano fuori, come nei totali di portafoglio.
  const tabMarketValue = tabPositions.reduce((sum, p) => sum + (p.market_value_base ?? 0), 0)
  const tabCost = tabPositions.reduce((sum, p) => sum + (p.cost_base ?? 0), 0)
  const tabPnlAbs = tabMarketValue - tabCost
  const tabWeight = tabPositions.reduce((sum, p) => sum + p.weight_pct, 0)

  // Variazione del giorno sui valori già convertiti: le posizioni senza cambio
  // non entrano nel totale, quindi non devono entrare neanche qui.
  const dailyChangeAbs = positions.reduce(
    (sum, p) => sum + (p.change_pct !== null && p.market_value_base !== null ? (p.market_value_base * p.change_pct) / 100 : 0),
    0
  )
  const dailyChangePct = summary && summary.total_market_value > 0
    ? (dailyChangeAbs / summary.total_market_value) * 100
    : 0

  const positionsStale = summary?.positions_as_of ? daysSince(summary.positions_as_of) > POSITIONS_STALE_DAYS : false

  async function handleFile(file: File) {
    setImportError(null)
    try {
      const result = await importCsv.mutateAsync(file)
      setLastImportResult(result)
      const { diff } = result
      showToast(`Import completato: ${diff.imported_positions} posizioni caricate`, 'success')
      if (diff.unmapped_isins.length > 0) {
        showToast(`${diff.unmapped_isins.length} ISIN senza ticker mappato`, 'info')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore durante l\'import'
      setLastImportResult(null)
      setImportError(message)
      showToast(message, 'error')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFile(file)
    } else {
      setImportError('Nessun file riconosciuto nel trascinamento: seleziona il CSV con un click.')
    }
  }

  const pnlColor = (n: number) => (n > 0 ? 'text-emerald-600' : n < 0 ? 'text-red-600' : 'text-zinc-500')

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Investimenti</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Portafoglio titoli importato da Fineco, prezzi da Google Finance</p>
          </div>
          <a
            href="https://www.google.com/finance/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Apri in Google Finance ↗
          </a>
        </div>

        {summaryError && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            <p className="font-medium mb-1">Portafoglio non caricato</p>
            <p>{summaryError instanceof Error ? summaryError.message : 'Errore nel caricamento del portafoglio'}</p>
            <p className="mt-1 text-xs">
              Se è il primo utilizzo, verifica di aver eseguito la migration <code>supabase/migrate_investments.sql</code> sul progetto Supabase.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-12 shadow-sm border border-zinc-100 dark:border-zinc-700 text-center text-zinc-500 dark:text-zinc-400">
            Caricamento...
          </div>
        ) : (
          <>
            {/* Header card: valore totale, P&L, badge provenienza */}
            {positions.length > 0 && summary && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-700">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Valore totale</p>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">{fmt(summary.total_market_value)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">P&amp;L totale</p>
                    <p className={`text-2xl font-bold ${pnlColor(summary.total_pnl_abs)}`}>
                      {fmt(summary.total_pnl_abs)} <span className="text-base">({summary.total_pnl_pct.toFixed(2)}%)</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Variazione giornaliera</p>
                    <p className={`text-2xl font-bold ${pnlColor(dailyChangeAbs)}`}>
                      {fmt(dailyChangeAbs)} <span className="text-base">({dailyChangePct.toFixed(2)}%)</span>
                    </p>
                  </div>
                </div>
                {summary.unconverted_currencies.length > 0 && (
                  <div className="mt-4 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                    Cambio non disponibile per {summary.unconverted_currencies.join(', ')} →{' '}
                    {summary.base_currency}: le posizioni in queste valute restano escluse dai totali
                    (peso 0%) invece di essere sommate a valuta diversa. Verranno incluse al prossimo
                    aggiornamento prezzi.
                  </div>
                )}
                {summary.unconverted_currencies.length === 0 && summary.currencies.length > 1 && (
                  <div className="mt-4 px-4 py-3 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg text-sm text-sky-700 dark:text-sky-400">
                    Portafoglio in più valute ({summary.currencies.join(', ')}): i totali sono convertiti
                    in {summary.base_currency}
                    {summary.fx_as_of && ` al cambio del ${formatDateTime(summary.fx_as_of)}`}. Gli importi
                    delle singole posizioni restano nella valuta di quotazione.
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-700">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      positionsStale
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                    }`}
                    title={positionsStale ? 'Ricarica il CSV Fineco per allineare dividendi e nuove operazioni' : undefined}
                  >
                    Posizioni Fineco al {summary.positions_as_of ? formatDateTime(summary.positions_as_of) : 'N/D'}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                    Prezzi Google Finance {summary.prices_as_of ? formatTime(summary.prices_as_of) : 'in attesa di aggiornamento'}
                  </span>
                </div>
              </div>
            )}

            {/* Allocazione per asset class */}
            {summary && summary.by_asset_class.length > 0 && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-700">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Allocazione per categoria</h3>
                </div>
                <div className="divide-y divide-zinc-50 dark:divide-zinc-700/50">
                  {[...summary.by_asset_class]
                    .sort((a, b) => b.market_value - a.market_value)
                    .map((a) => (
                      <div key={a.asset_class} className="px-6 py-3 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                              {ASSET_CLASS_LABELS[a.asset_class]}
                            </span>
                            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 ml-4 shrink-0">
                              {fmt(a.market_value)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${a.weight_pct}%`, backgroundColor: ASSET_CLASS_COLORS[a.asset_class] }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 w-10 text-right shrink-0">
                          {Math.round(a.weight_pct)}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Tabella posizioni */}
            {positions.length > 0 && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700 overflow-hidden">
                <div className="px-6 pt-4 border-b border-zinc-100 dark:border-zinc-700">
                  <div className="flex gap-1 overflow-x-auto -mb-px">
                    {visibleTabs.map((t) => {
                      const isActive = currentTab?.key === t.key
                      return (
                        <button
                          key={t.key}
                          onClick={() => setActiveTab(t.key)}
                          className={`whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                            isActive
                              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                              : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                          }`}
                        >
                          {t.label}
                          <span className="ml-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                            {t.classes === null
                              ? positions.length
                              : positions.filter((p) => (t.classes as readonly AssetClass[]).includes(p.asset_class)).length}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-700 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{fmt(tabMarketValue)}</span>
                    <span className={pnlColor(tabPnlAbs)}>
                      {fmt(tabPnlAbs)} ({tabCost > 0 ? ((tabPnlAbs / tabCost) * 100).toFixed(2) : '0.00'}%)
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {tabWeight.toFixed(1)}% del portafoglio
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {([
                      { key: 'weight', label: 'Peso' },
                      { key: 'name', label: 'Nome' },
                      { key: 'pnl', label: 'P&L' },
                    ] as const).map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setSortKey(s.key)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                          sortKey === s.key
                            ? 'bg-emerald-600 text-white'
                            : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-700/40 border-b border-zinc-100 dark:border-zinc-700">
                        {['Nome', 'Quantità / nominale', 'Carico', 'Ultimo prezzo', 'P&L', 'Peso'].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-700/50">
                      {groupedPositions.map((group) => (
                        <Fragment key={group.label ?? 'all'}>
                          {group.label && (
                            <tr className="bg-zinc-50/70 dark:bg-zinc-700/20">
                              <td
                                colSpan={6}
                                className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                              >
                                {group.label}
                                <span className="ml-1.5 font-normal normal-case tracking-normal">
                                  · {group.rows.length}
                                </span>
                              </td>
                            </tr>
                          )}
                          {group.rows.map((p: InvestmentPosition) => (
                            <tr key={p.holding_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30">
                              <td className="px-4 py-2.5">
                                <div className="font-medium text-zinc-800 dark:text-zinc-200">{p.name}</div>
                                <div className="text-xs text-zinc-400 dark:text-zinc-500">
                                  {p.ticker_gf || 'ticker non mappato'} · {p.currency}
                                  {p.price_divisor !== 1 && ' · quotato in % del nominale'}
                                  {p.fx_rate === null && ' · cambio non disponibile'}
                                  {p.fx_rate !== null && p.fx_rate !== 1 &&
                                    ` · ${fmt(p.market_value_base!)} al cambio ${p.fx_rate.toFixed(4)}`}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{p.quantity}</td>
                              <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{fmtIn(p.avg_cost, p.currency)}</td>
                              <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                {p.price_origin === 'market' && fmtIn(p.last_price!, p.currency)}
                                {p.price_origin === 'manual' && (
                                  <span className="text-sky-700 dark:text-sky-400" title={`Prezzo inserito a mano il ${formatDateTime(p.manual_priced_at!)}`}>
                                    {fmtIn(p.manual_price!, p.currency)}
                                    <span className="ml-1 text-xs">· manuale</span>
                                  </span>
                                )}
                                {p.price_origin === 'cost' && (
                                  <span
                                    className="text-amber-600 dark:text-amber-400"
                                    title="Nessun prezzo di mercato disponibile: la posizione è valorizzata al costo di carico"
                                  >
                                    al costo
                                  </span>
                                )}
                                {p.price_origin !== 'market' && (
                                  <button
                                    onClick={() => setPriceModal(p)}
                                    className="ml-2 text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                                  >
                                    {p.price_origin === 'manual' ? 'aggiorna' : 'inserisci'}
                                  </button>
                                )}
                              </td>
                              <td className={`px-4 py-2.5 font-medium whitespace-nowrap ${pnlColor(p.pnl_abs)}`}>
                                {fmtIn(p.pnl_abs, p.currency)} ({p.pnl_pct.toFixed(1)}%)
                              </td>
                              <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                {p.weight_pct.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty state */}
            {positions.length === 0 && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-12 shadow-sm border border-zinc-100 dark:border-zinc-700 text-center">
                <div className="text-4xl mb-4">📈</div>
                <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Nessuna posizione importata</h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-md mx-auto">
                  Esporta il portafoglio titoli da Fineco (Patrimonio → Portafoglio titoli → Esporta) e carica il CSV qui sotto.
                </p>
              </div>
            )}

            {/* Import CSV */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700 p-6 space-y-4">
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Importa CSV Fineco</h3>
              <div
                role="button"
                tabIndex={0}
                aria-label="Seleziona il CSV Fineco da importare"
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  isDragging
                    ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10'
                    : 'border-zinc-300 dark:border-zinc-600 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10'
                }`}
              >
                <div className="text-3xl mb-2">📂</div>
                <p className="font-medium text-zinc-700 dark:text-zinc-300 text-sm">
                  {importCsv.isPending ? 'Importazione in corso...' : 'Trascina qui il CSV Fineco'}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Sostituisce integralmente le posizioni attuali — oppure clicca per selezionare</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  // Alcuni browser assegnano ai CSV scaricati un MIME Excel: un
                  // accept troppo stretto li rende non selezionabili dal picker.
                  accept=".csv,.txt,text/csv,text/plain,application/csv,application/vnd.ms-excel"
                  className="hidden"
                  disabled={importCsv.isPending}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    // Reset del value: senza, ricaricare lo stesso file due volte
                    // non emette un nuovo change e sembra che non succeda nulla.
                    e.target.value = ''
                    if (f) handleFile(f)
                  }}
                />
              </div>

              {importError && (
                <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                  <p className="font-medium mb-1">Import non riuscito</p>
                  <p>{importError}</p>
                </div>
              )}

              {lastImportResult && (
                <div className="space-y-2">
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    {lastImportResult.diff.imported_positions} posizioni caricate · {lastImportResult.diff.new_positions} nuove · {lastImportResult.diff.changed_positions} variate · {lastImportResult.diff.removed_positions} rimosse
                  </div>
                  {lastImportResult.diff.percent_quoted_positions > 0 && (
                    <div className="px-4 py-3 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg text-sm text-sky-700 dark:text-sky-400">
                      {lastImportResult.diff.percent_quoted_positions} posizioni quotate in percentuale del nominale
                      (obbligazioni): il controvalore è calcolato come quantità × prezzo / 100.
                    </div>
                  )}
                  {lastImportResult.diff.derived_tickers.length > 0 && (
                    <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm text-emerald-700 dark:text-emerald-400">
                      <p className="font-medium mb-1">
                        {lastImportResult.diff.derived_tickers.length} ticker dedotti da Simbolo + Mercato del CSV
                      </p>
                      <p className="text-xs">
                        {lastImportResult.diff.derived_tickers.map((t) => `${t.isin} → ${t.ticker_gf}`).join(' · ')}
                      </p>
                      <p className="text-xs mt-1">
                        Ricordati di aggiornare la colonna A del Google Sheet ponte con i nuovi ticker.
                      </p>
                    </div>
                  )}
                  {lastImportResult.diff.unknown_markets.length > 0 && (
                    <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                      Mercati non riconosciuti: {lastImportResult.diff.unknown_markets.join(', ')}. Le posizioni su
                      questi mercati restano senza prezzi live finché non aggiungi la riga in <code>isin_ticker_lookup</code>.
                    </div>
                  )}
                  {lastImportResult.diff.unmapped_isins.length > 0 && (
                    <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                      {lastImportResult.diff.unmapped_isins.length} ISIN senza ticker mappato: {lastImportResult.diff.unmapped_isins.join(', ')}.
                      Aggiungi la mappatura in <code>isin_ticker_lookup</code> per abilitare i prezzi live.
                    </div>
                  )}
                  {lastImportResult.warnings.length > 0 && (
                    <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-700/40 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5">
                      {lastImportResult.warnings.map((w, i) => <p key={i}>{w}</p>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {priceModal && <ManualPriceModal position={priceModal} onClose={() => setPriceModal(null)} />}
    </DashboardLayout>
  )
}
