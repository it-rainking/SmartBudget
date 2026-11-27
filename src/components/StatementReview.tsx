'use client'

import { useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { STATEMENT_SOURCE_LABELS, isSelected, type DuplicateDecision, type ReviewItem, type StatementSource } from '@/lib/import'

const TYPE_COLORS = { income: 'text-emerald-600 dark:text-emerald-400', expense: 'text-red-600 dark:text-red-400', saving: 'text-blue-600 dark:text-blue-400' }
const TYPE_SIGN = { income: '+', expense: '−', saving: '→' }
const CATEGORY_LABELS = { investimenti: 'Investimenti', satispay: 'Satispay' }
const DECISIONS: { value: DuplicateDecision; label: string }[] = [
  { value: 'skip', label: 'Salta' },
  { value: 'import', label: 'Importa' },
  { value: 'replace', label: 'Sostituisci' },
]

interface Props {
  source: StatementSource
  items: ReviewItem[]
  included: ReadonlySet<string>
  warnings: string[]
  errors: { location: string; reason: string }[]
  currency: string
  onToggle: (externalId: string, value: boolean) => void
  onToggleMany: (externalIds: string[], value: boolean) => void
  onDecision: (externalId: string, decision: DuplicateDecision) => void
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function StatementReview({ source, items, included, warnings, errors, currency, onToggle, onToggleMany, onDecision }: Props) {
  const fmt = (n: number) => formatCurrency(n, currency)
  const [showSkipped, setShowSkipped] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  const duplicates = items.filter(i => i.match)
  const regular = items.filter(i => !i.match && i.status !== 'skip')
  const skipped = items.filter(i => !i.match && i.status === 'skip')
  const review = regular.filter(i => i.status === 'review')

  const groups = new Map<string, ReviewItem[]>()
  for (const i of [...regular].sort((a, b) => b.date.localeCompare(a.date))) {
    const k = i.date.slice(0, 7)
    const g = groups.get(k)
    if (g) g.push(i)
    else groups.set(k, [i])
  }
  const byMonth = Array.from(groups.entries())

  const renderRow = (item: ReviewItem) => {
    const checked = included.has(item.external_id)
    return (
      <label key={item.external_id} className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer ${checked ? '' : 'opacity-60'}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onToggle(item.external_id, e.target.checked)}
          className="mt-1 h-4 w-4 accent-emerald-600 flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm text-zinc-800 dark:text-zinc-200 truncate" title={item.description}>{item.description || '(senza descrizione)'}</p>
            <span className={`text-sm font-medium whitespace-nowrap ${TYPE_COLORS[item.type]}`}>{TYPE_SIGN[item.type]} {fmt(item.amount)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{formatDate(item.date)}</span>
            {item.type === 'saving' && <span className="px-1.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">Risparmio</span>}
            {item.categoryKey && <span className="px-1.5 rounded bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400">{CATEGORY_LABELS[item.categoryKey]}</span>}
            {item.reason && (
              <span className={item.status === 'review' ? 'text-amber-700 dark:text-amber-400' : ''}>
                {item.status === 'review' ? '⚠️ ' : ''}{item.reason}
              </span>
            )}
          </div>
        </div>
      </label>
    )
  }

  const selectedCount = items.filter(i => isSelected(i, included)).length

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        {[
          ['Da importare', selectedCount, 'text-emerald-600 dark:text-emerald-400'],
          ['Da verificare', review.length, 'text-amber-600 dark:text-amber-400'],
          ['Possibili doppioni', duplicates.length, 'text-orange-600 dark:text-orange-400'],
          ['Scartati', skipped.length, 'text-zinc-500 dark:text-zinc-400'],
        ].map(([label, n, color]) => (
          <div key={label as string} className="rounded-lg bg-zinc-50 dark:bg-zinc-700/40 px-2 py-2">
            <p className={`text-lg font-semibold ${color}`}>{n}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Estratto {STATEMENT_SOURCE_LABELS[source]}. Le spese senza categoria finiscono in &quot;Non categorizzato&quot;: puoi assegnarla dopo dalla lista transazioni.
      </p>

      {warnings.map(w => (
        <div key={w} className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400">⚠️ {w}</div>
      ))}

      {errors.length > 0 && (
        <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-700/40 rounded-lg text-xs text-zinc-600 dark:text-zinc-400">
          <button onClick={() => setShowErrors(s => !s)} className="w-full flex justify-between font-medium">
            <span>{errors.length} righe non lette (dati mancanti o importo zero)</span>
            <span>{showErrors ? '▲' : '▼'}</span>
          </button>
          {showErrors && (
            <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {errors.map((e, i) => <li key={i}><span className="font-semibold">{e.location}</span>: {e.reason}</li>)}
            </ul>
          )}
        </div>
      )}

      {duplicates.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Possibili doppioni</h3>
            <div className="flex gap-2 text-xs">
              <button onClick={() => duplicates.forEach(d => onDecision(d.external_id, 'skip'))} className="text-zinc-600 dark:text-zinc-400 underline">Salta tutti</button>
              <button onClick={() => duplicates.forEach(d => onDecision(d.external_id, 'import'))} className="text-zinc-600 dark:text-zinc-400 underline">Importa tutti</button>
            </div>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Simili a una transazione già salvata. &quot;Sostituisci&quot; aggiorna data, importo e descrizione di quella esistente e ne conserva categoria e note.
          </p>
          <ul className="space-y-2">
            {duplicates.map(d => (
              <li key={d.external_id} className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10 p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-zinc-500 dark:text-zinc-400">Dall&apos;estratto</p>
                    <p className="text-zinc-800 dark:text-zinc-200 truncate" title={d.description}>{d.description}</p>
                    <p className={TYPE_COLORS[d.type]}>{formatDate(d.date)} · {fmt(d.amount)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 dark:text-zinc-400">Già salvata</p>
                    <p className="text-zinc-800 dark:text-zinc-200 truncate" title={d.match!.description ?? ''}>{d.match!.description || '(senza descrizione)'}</p>
                    <p className="text-zinc-600 dark:text-zinc-400">{formatDate(d.match!.date)} · {fmt(Number(d.match!.amount))}</p>
                  </div>
                </div>
                <div role="radiogroup" aria-label="Cosa fare" className="grid grid-cols-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-0.5 text-xs">
                  {DECISIONS.map(opt => (
                    <button
                      key={opt.value}
                      role="radio"
                      aria-checked={d.decision === opt.value}
                      onClick={() => onDecision(d.external_id, opt.value)}
                      className={`py-1.5 rounded-md font-medium transition-colors ${d.decision === opt.value ? 'bg-emerald-500 text-white' : 'text-zinc-600 dark:text-zinc-300'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.length > 0 && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-amber-700 dark:text-amber-400">{review.length} movimenti da verificare, inclusi nell&apos;import</span>
          <button onClick={() => onToggleMany(review.map(r => r.external_id), false)} className="text-zinc-600 dark:text-zinc-400 underline">Escludili tutti</button>
        </div>
      )}

      {byMonth.map(([ym, list]) => {
        const sel = list.filter(i => included.has(i.external_id))
        const allOn = sel.length === list.length
        return (
          <section key={ym} className="rounded-lg border border-zinc-100 dark:border-zinc-700 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-700/40">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{monthLabel(ym)}</h3>
              <button onClick={() => onToggleMany(list.map(i => i.external_id), !allOn)} className="text-xs text-zinc-600 dark:text-zinc-400 underline">
                {sel.length}/{list.length} · {allOn ? 'deseleziona' : 'seleziona tutti'}
              </button>
            </div>
            <div className="divide-y divide-zinc-50 dark:divide-zinc-700/50">
              {list.map(renderRow)}
            </div>
          </section>
        )
      })}

      {skipped.length > 0 && (
        <section className="rounded-lg border border-zinc-100 dark:border-zinc-700 overflow-hidden">
          <button onClick={() => setShowSkipped(s => !s)} className="w-full flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-700/40 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <span>Scartati automaticamente ({skipped.length})</span>
            <span className="text-xs">{showSkipped ? '▲' : '▼'}</span>
          </button>
          {showSkipped && (
            <div className="divide-y divide-zinc-50 dark:divide-zinc-700/50">
              <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">Spunta una riga per importarla comunque.</p>
              {skipped.map(renderRow)}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
