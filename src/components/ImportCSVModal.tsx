'use client'

import { useState, useRef, useMemo } from 'react'
import { parseCSV, parseOFX, resolveCategoryNames, useImportTransactions, findSimilarTransactions, type ParsedTransaction, type ParseRowError } from '@/hooks/useImportTransactions'
import { useToast } from '@/components/Toast'
import { useSettings } from '@/hooks/useSettings'
import { useExpenseCategories, useIncomeCategories, useSavingCategories } from '@/hooks/useCategories'
import { useModalA11y } from '@/hooks/useModalA11y'
import { formatCurrency, formatDate } from '@/lib/utils'

const TYPE_LABELS = { income: 'Entrata', expense: 'Spesa', saving: 'Risparmio' }
const TYPE_COLORS = { income: 'text-emerald-600', expense: 'text-red-600', saving: 'text-blue-600' }

const EXAMPLE_CSV = `data,tipo,importo,descrizione,categoria,sottocategoria,metodo,tag,note,eccezionale
2026-01-15,entrata,2500,Stipendio gennaio,Stipendio,,bonifico,,,no
2026-01-20,spesa,85.50,Spesa supermercato,Alimentari,Conad,carta,,,no
2026-01-22,risparmio,300,Fondo emergenza,Investimenti,,bonifico,,,no
2026-02-01,spesa,1200,Affitto,Casa,Affitto,bonifico,casa,,no
2026-02-10,spesa,950,Riparazione auto dopo un incidente,Trasporti,Manutenzione Auto,carta,,Preventivo carrozzeria Rossi,si`

interface Props {
  onClose: () => void
}

export function ImportCSVModal({ onClose }: Props) {
  const { data: settings } = useSettings()
  const { data: expenseCategories } = useExpenseCategories()
  const { data: incomeCategories } = useIncomeCategories()
  const { data: savingCategories } = useSavingCategories()
  const importTx = useImportTransactions()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<ParsedTransaction[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [parseErrors, setParseErrors] = useState<ParseRowError[]>([])
  const [showParseErrors, setShowParseErrors] = useState(false)
  const [unmatchedCategories, setUnmatchedCategories] = useState<string[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number } | null>(null)
  const [isCategorizingAI, setIsCategorizingAI] = useState(false)

  const currency = settings?.currency || 'EUR'
  const fmt = (n: number) => formatCurrency(n, currency)

  const modalRef = useModalA11y<HTMLDivElement>(true, onClose)

  const similarMatches = useMemo(() => findSimilarTransactions(rows), [rows])

  function handleFile(file: File) {
    setParseError(null)
    setParseErrors([])
    setShowParseErrors(false)
    setUnmatchedCategories([])
    setFileName(file.name)
    const isOFX = /\.(ofx|qfx|qif)$/i.test(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { transactions, errors } = isOFX ? parseOFX(text) : parseCSV(text)
      setParseErrors(errors)
      if (transactions.length === 0) {
        setParseError(
          errors.length > 0
            ? `Nessuna riga valida trovata: ${errors.length} righe scartate. Controlla i dettagli sotto.`
            : 'Nessuna riga valida trovata. Controlla il formato del file.'
        )
        return
      }
      // Risolve i nomi di categoria/sottocategoria del CSV contro le categorie
      // reali dell'utente (case-insensitive) per popolare category_id/subcategory_id.
      const { rows: resolved, unmatched } = resolveCategoryNames(transactions, {
        income: (incomeCategories ?? []).map(c => ({ id: c.id, name: c.name })),
        expense: (expenseCategories ?? []).map(c => ({
          id: c.id,
          name: c.name,
          subcategories: (c.subcategories ?? []).map(s => ({ id: s.id, name: s.name })),
        })),
        saving: (savingCategories ?? []).map(c => ({ id: c.id, name: c.name })),
      })
      setUnmatchedCategories(unmatched)
      setRows(resolved)
      setStep('preview')
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function removeRow(index: number) {
    setRows(r => r.filter((_, i) => i !== index))
  }

  async function handleImport() {
    if (rows.length === 0) return
    try {
      const result = await importTx.mutateAsync(rows)
      setImportResult(result)
      if (result.skipped > 0) {
        showToast(`${result.inserted} importate, ${result.skipped} duplicate saltate`, 'info')
      } else {
        showToast(`${result.inserted} transazioni importate`, 'success')
      }
      setStep('done')
    } catch {
      showToast('Errore durante l\'importazione', 'error')
    }
  }

  // AI auto-categorization
  async function handleAICategorize() {
    const allCategories = [
      ...(expenseCategories ?? []).map(c => ({ id: c.id, name: c.name })),
      ...(incomeCategories ?? []).map(c => ({ id: c.id, name: c.name })),
    ]
    if (!allCategories.length) {
      showToast('Nessuna categoria disponibile', 'error')
      return
    }

    // Solo righe con descrizione non vuota e senza categoria già assegnata
    const toClassify = rows.filter(r => r.description && r.category_id === undefined)
    if (!toClassify.length) {
      showToast('Tutte le righe hanno già una categoria', 'info')
      return
    }

    setIsCategorizingAI(true)
    try {
      const res = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descriptions: toClassify.map(r => r.description),
          categories: allCategories,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Errore AI', 'error')
        return
      }

      const suggestionsMap: Record<string, { category_id: string | null; category_name: string }> = {}
      for (const s of data.suggestions ?? []) {
        suggestionsMap[s.description] = { category_id: s.category_id, category_name: s.category_name }
      }

      setRows(prev => prev.map(r => {
        if (r.category_id !== undefined || !r.description) return r
        const s = suggestionsMap[r.description]
        return s ? { ...r, category_id: s.category_id, category_name: s.category_name } : r
      }))
      showToast('Categorie suggerite dall\'AI', 'success')
    } catch {
      showToast('Errore connessione AI', 'error')
    } finally {
      setIsCategorizingAI(false)
    }
  }

  function downloadExample() {
    const blob = new Blob([EXAMPLE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'smartbudget-esempio.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
      <div ref={modalRef} className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-700 flex-shrink-0">
          <div>
            <h2 id="import-modal-title" className="text-lg font-semibold text-zinc-900 dark:text-white">Importa transazioni</h2>
            {step === 'preview' && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{fileName} — {rows.length} righe trovate</p>
            )}
          </div>
          <button onClick={onClose} aria-label="Chiudi" className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="p-6 space-y-4">
              {/* Drop zone */}
              <div
                role="button"
                tabIndex={0}
                aria-label="Seleziona un file da importare"
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
                className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl p-10 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <div className="text-4xl mb-3">📂</div>
                <p className="font-medium text-zinc-700 dark:text-zinc-300">Trascina qui il file</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">CSV, OFX / QFX — oppure clicca per selezionare</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.ofx,.qfx,.qif"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
              </div>

              {parseError && (
                <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 space-y-2">
                  <p>{parseError}</p>
                  {parseErrors.length > 0 && (
                    <ul className="text-xs space-y-1 max-h-48 overflow-y-auto border-t border-red-200 dark:border-red-800 pt-2">
                      {parseErrors.map((e, i) => (
                        <li key={i}>
                          <span className="font-semibold">{e.location}</span>: {e.reason}
                          {e.raw ? <span className="text-red-500 dark:text-red-500/80"> — &quot;{e.raw}&quot;</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Format guide */}
              <div className="bg-zinc-50 dark:bg-zinc-700/40 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wide">Formati supportati</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">CSV (separatore , o ;)</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {[
                        ['data / date', 'YYYY-MM-DD o DD/MM/YYYY'],
                        ['tipo / type', 'entrata · spesa · risparmio'],
                        ['importo / amount', 'numero positivo'],
                        ['descrizione', 'opzionale'],
                        ['categoria', 'opzionale — nome esatto di una tua categoria'],
                        ['sottocategoria', 'opzionale — solo per le spese'],
                        ['metodo', 'opzionale'],
                        ['tag', 'opzionale — più tag separati da |'],
                        ['note', 'opzionale'],
                        ['eccezionale', 'opzionale — si/no'],
                      ].map(([col, val]) => (
                        <div key={col} className="contents">
                          <span className="font-mono text-emerald-600 dark:text-emerald-400">{col}</span>
                          <span className="text-zinc-500 dark:text-zinc-400">{val}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={downloadExample} className="text-xs text-emerald-600 dark:text-emerald-400 underline mt-1">
                      Scarica file di esempio
                    </button>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                      Il nome in <span className="font-mono">categoria</span>/<span className="font-mono">sottocategoria</span> deve
                      corrispondere esattamente (senza maiuscole) a una categoria già creata su SmartBudget: le righe non riconosciute
                      restano senza categoria e puoi assegnarla dopo con &quot;Categorizza con AI&quot; o modificandole manualmente.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">OFX / QFX</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Formato bancario standard — esportato direttamente dalla tua banca</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div className="p-6 space-y-4">
              {/* AI categorize button */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Rivedi le transazioni prima di importare. Puoi rimuovere le righe indesiderate.
                </p>
                <button
                  onClick={handleAICategorize}
                  disabled={isCategorizingAI}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/30 disabled:opacity-50 transition-colors"
                >
                  {isCategorizingAI ? (
                    <><span className="animate-spin">⟳</span> Categorizzando...</>
                  ) : (
                    <>✨ Categorizza con AI</>
                  )}
                </button>
              </div>

              {parseErrors.length > 0 && (
                <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                  <button
                    onClick={() => setShowParseErrors(s => !s)}
                    className="flex items-center justify-between w-full font-medium text-left"
                  >
                    <span>⚠️ {parseErrors.length} righe scartate durante la lettura del file</span>
                    <span>{showParseErrors ? '▲' : '▼'}</span>
                  </button>
                  {showParseErrors && (
                    <ul className="mt-2 space-y-1 text-xs max-h-40 overflow-y-auto border-t border-amber-200 dark:border-amber-800 pt-2">
                      {parseErrors.map((e, i) => (
                        <li key={i}>
                          <span className="font-semibold">{e.location}</span>: {e.reason}
                          {e.raw ? <span className="text-amber-600/80 dark:text-amber-500/80"> — &quot;{e.raw}&quot;</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {unmatchedCategories.length > 0 && (
                <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                  ⚠️ Categorie nel file non riconosciute: <span className="font-medium">{unmatchedCategories.join(', ')}</span>.
                  Le righe corrispondenti resteranno senza categoria — puoi usare &quot;Categorizza con AI&quot; qui sotto o assegnarla dopo l&apos;import.
                </div>
              )}

              {similarMatches.size > 0 && (
                <div className="px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg text-xs text-orange-700 dark:text-orange-400">
                  🔁 {similarMatches.size} transazioni hanno un importo uguale o molto simile (differenza &lt;5%) ad un&apos;altra riga nello stesso giorno del mese — evidenziate in tabella, verifica che non siano doppioni.
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-zinc-100 dark:border-zinc-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-700/40 border-b border-zinc-100 dark:border-zinc-700">
                      {['Data', 'Tipo', 'Importo', 'Descrizione', 'Categoria', ''].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-700/50">
                    {rows.map((row, i) => {
                      const matches = similarMatches.get(i)
                      return (
                        <tr
                          key={i}
                          className={matches
                            ? 'bg-orange-50/60 dark:bg-orange-900/10 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/30'}
                        >
                          <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{row.date}</td>
                          <td className={`px-3 py-2 font-medium whitespace-nowrap ${TYPE_COLORS[row.type]}`}>
                            {TYPE_LABELS[row.type]}
                            {row.is_exceptional && (
                              <span className="ml-1" title="Movimento eccezionale — escluso da medie e trend">⚡</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                            {fmt(row.amount)}
                            {matches && (
                              <span
                                className="ml-1.5 inline-flex items-center text-orange-500 dark:text-orange-400 cursor-help align-middle"
                                title={`Possibile doppione — importo simile a: ${matches
                                  .map(m => `${fmt(m.amount)} il ${formatDate(m.date)}${m.description ? ` (${m.description})` : ''}`)
                                  .join('; ')}`}
                              >
                                🔁
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 max-w-[150px] truncate">{row.description || '—'}</td>
                          <td className="px-3 py-2 max-w-[150px]">
                            {row.category_id && row.category_name ? (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 inline-block truncate max-w-full align-middle"
                                title={row.subcategory_name ? `${row.category_name} › ${row.subcategory_name}` : row.category_name}
                              >
                                ✨ {row.subcategory_id && row.subcategory_name ? `${row.category_name} › ${row.subcategory_name}` : row.category_name}
                              </span>
                            ) : row.category_name ? (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 inline-block truncate max-w-full align-middle"
                                title={`"${row.category_name}" non corrisponde a nessuna categoria — resterà senza categoria`}
                              >
                                ⚠️ {row.category_name}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <button onClick={() => removeRow(i)} className="text-zinc-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-colors">✕</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length === 0 && (
                <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-4">
                  Tutte le righe sono state rimosse.{' '}
                  <button onClick={() => setStep('upload')} className="text-emerald-600 dark:text-emerald-400 underline">Carica un altro file</button>
                </p>
              )}
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-1">Importazione completata</h3>
              {importResult && (
                <div className="text-sm text-zinc-500 dark:text-zinc-400 space-y-1 mt-2">
                  <p>{importResult.inserted} transazioni importate</p>
                  {importResult.skipped > 0 && (
                    <p className="text-amber-600 dark:text-amber-400">{importResult.skipped} duplicate saltate (stesso giorno, importo e descrizione)</p>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 dark:border-zinc-700 flex-shrink-0">
          {step === 'upload' && (
            <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
              Annulla
            </button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => { setStep('upload'); setRows([]); setFileName(null) }} className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                ← Indietro
              </button>
              <button
                onClick={handleImport}
                disabled={rows.length === 0 || importTx.isPending}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {importTx.isPending ? 'Importazione...' : `Importa ${rows.length} transazioni`}
              </button>
            </>
          )}
          {step === 'done' && (
            <div className="w-full flex justify-center">
              <button onClick={onClose} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
                Chiudi
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
