'use client'

import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button, Card, KpiTile, Skeleton } from '@/components/ui'
import { useToast } from '@/components/Toast'
import { PeersChart, SimulationChart, USER_COLOR, ALT_COLOR, type PeerBar, type ReferenceLine } from '@/components/pension/PensionCharts'
import { formatEur, formatPct, formatPoints, formatSignedEur, toneClass } from '@/components/pension/format'
import { usePensionComparison, useSavePensionComparison } from '@/hooks/usePensionComparison'
import {
  COVIP_ISC, COVIP_RETURNS, OPEN_FUND_LINES, PENSION_CATEGORIES, PENSION_FORMS,
  alternativeLine, comparisonPeriod, covipIscFor, covipReturn, covipValue, iscCategory,
  linesFor, openFundTableRows, parseNumberInput, simulate, userReturn,
  type PensionCategory, type PensionForm, type PensionParams,
} from '@/lib/pension/compare'
import { classNames } from '@/lib/utils'

type NumericKey = 'r10' | 'r5' | 'isc' | 'montante' | 'ral' | 'pct_lav' | 'pct_dat' | 'pct_tfr' | 'anni'

const INPUT = 'w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500'
const TH = 'px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap'
const TD = 'px-3 py-2 whitespace-nowrap'
const N = 'text-right tabular-nums'

const shown = (v: number | null) => (v == null ? '' : String(v).replace('.', ','))

function Field({ id, label, hint, error, children }: { id: string; label: string; hint: string; error?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={id} className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{label}</label>
      {children}
      <span className={classNames('text-xs', error ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400')}>
        {error ? 'Numero non valido, valore precedente mantenuto' : hint}
      </span>
    </div>
  )
}

// Campo numerico: si scrive liberamente (virgola, punto, migliaia) e il
// valore viene interpretato e salvato all'uscita dal campo, come nello
// strumento originale. Il genitore lo rimonta (key) quando il valore cambia.
function NumberField({ id, label, hint, placeholder, value, numeric, onCommit }: {
  id: string; label: string; hint: string; placeholder: string; value: number | null; numeric?: boolean
  onCommit: (v: number | null) => void
}) {
  const [draft, setDraft] = useState(shown(value))
  const [error, setError] = useState(false)
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        type="text"
        inputMode={numeric ? 'numeric' : 'decimal'}
        autoComplete="off"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setError(false) }}
        onBlur={() => {
          const v = parseNumberInput(draft)
          if (v === undefined) { setError(true); setDraft(shown(value)); return }
          if (v !== value) onCommit(v)
        }}
        className={INPUT}
      />
    </Field>
  )
}

export default function FondoPensionePage() {
  const { data, isLoading, error } = usePensionComparison()
  const save = useSavePensionComparison()
  const { showToast } = useToast()
  const [resetToken, setResetToken] = useState(0)

  const p = data?.params
  const synced = data?.synced ?? true

  const update = (patch: Partial<PensionParams>) => {
    if (!p) return
    save.mutate({ params: { ...p, ...patch }, synced }, {
      onError: (e) => showToast(`Salvataggio non riuscito: ${e.message}`, 'error'),
    })
  }
  const reset = () => {
    save.mutate({ params: null, synced }, {
      onSuccess: () => showToast('Dati azzerati', 'success'),
      onError: (e) => showToast(`Azzeramento non riuscito: ${e.message}`, 'error'),
    })
    setResetToken(t => t + 1)
  }

  const view = useMemo(() => {
    if (!p) return null
    const period = comparisonPeriod(p)
    const ur = userReturn(p)
    const fpa = covipValue(covipReturn('FPA', p.cat), period)
    const fpn = covipValue(covipReturn('FPN', p.cat), period)
    const tfr = covipValue(covipReturn('TFR', 'TFR'), period)
    const best = linesFor(p.cat, period)[0] ?? null
    const isc = covipIscFor(p.cat)

    const bars: PeerBar[] = linesFor(p.cat, period).map(x => ({
      label: `${x.fondo} · ${x.linea}`, value: x.rend, isUser: false, equities: x.azioni_pct, cost: x.costo_gestione,
    }))
    if (ur != null) bars.push({ label: `${p.fondo || 'Il tuo fondo'} (tu)`, value: ur, isUser: true })
    bars.sort((a, b) => b.value - a.value)

    const references: ReferenceLine[] = []
    if (fpa != null) references.push({ value: fpa, dash: [6, 4], color: '#71717a' })
    if (fpn != null) references.push({ value: fpn, dash: [2, 3], color: '#71717a' })
    if (tfr != null) references.push({ value: tfr, dash: [], color: '#a1a1aa' })

    return {
      period, ur, fpa, fpn, best, isc, bars, references,
      gapFpa: ur != null && fpa != null ? ur - fpa : null,
      gapFpn: ur != null && fpn != null ? ur - fpn : null,
      altLines: linesFor(p.cat, null),
      alt: alternativeLine(p),
      sim: simulate(p),
      tableRows: openFundTableRows(p),
    }
  }, [p])

  const numField = (key: NumericKey, label: string, hint: string, placeholder: string, numeric = false) => (
    <NumberField
      key={`${key}:${p?.[key] ?? ''}:${resetToken}`}
      id={`fp-${key}`}
      label={label}
      hint={hint}
      placeholder={placeholder}
      value={p?.[key] ?? null}
      numeric={numeric}
      onCommit={(v) => update({ [key]: v })}
    />
  )

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Confronto fondo pensione</h1>
          {view && view.ur != null ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
              Su {view.period} anni il tuo comparto ha reso <b>{formatPct(view.ur)}</b> l&apos;anno,{' '}
              <b className={toneClass(view.gapFpa)}>{formatPoints(view.gapFpa)}</b> punti rispetto alla media dei fondi aperti
              della stessa categoria ({formatPct(view.fpa, 1)}, dati COVIP).
            </p>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
              Inserisci la categoria e il rendimento medio annuo del tuo comparto: il confronto con i principali fondi aperti si aggiorna subito.
            </p>
          )}
        </header>

        {error && (
          <Card className="p-4 text-sm text-red-600 dark:text-red-400">Impossibile caricare i dati: {error.message}</Card>
        )}

        {isLoading || !p || !view ? (
          <div className="space-y-4">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            {/* I tuoi dati */}
            <Card className="p-4 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-white">I tuoi dati</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Usa il punto o la virgola per i decimali. Ogni campo si salva quando lo lasci
                    {synced ? ' e lo ritrovi su tutti i tuoi dispositivi.' : ', per ora solo in questo browser (manca la migrazione migrate_pension_comparison.sql).'}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={reset}>
                  <RotateCcw size={14} /> Azzera i dati
                </Button>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Il tuo fondo</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field id="fp-fondo" label="Nome del fondo" hint="Comunicazione periodica o voce in busta paga">
                    <input
                      key={`fondo:${p.fondo ?? ''}:${resetToken}`}
                      id="fp-fondo"
                      type="text"
                      autoComplete="off"
                      defaultValue={p.fondo ?? ''}
                      onBlur={(e) => {
                        const v = e.target.value.trim() || null
                        if (v !== p.fondo) update({ fondo: v })
                      }}
                      className={INPUT}
                    />
                  </Field>
                  <Field id="fp-forma" label="Tipo di fondo" hint="Il negoziale è quello previsto dal tuo CCNL">
                    <select id="fp-forma" value={p.forma} onChange={(e) => update({ forma: e.target.value as PensionForm })} className={INPUT}>
                      {PENSION_FORMS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </Field>
                  <Field id="fp-cat" label="Categoria del comparto" hint='Nota informativa, scheda "Le opzioni di investimento"'>
                    <select id="fp-cat" value={p.cat} onChange={(e) => update({ cat: e.target.value as PensionCategory, alt: null })} className={INPUT}>
                      {PENSION_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </Field>
                  {numField('r10', 'Rendimento netto medio annuo 10 anni (%)', 'Sito del fondo o elenco rendimenti COVIP, al 31/12/2025', 'es. 4,8')}
                  {numField('r5', 'Rendimento netto medio annuo 5 anni (%)', 'Usato solo se manca il dato a 10 anni', 'es. 5,1')}
                  {numField('isc', 'ISC a 10 anni (%)', 'Nota informativa, scheda "I costi"', 'es. 0,38')}
                  {numField('montante', 'Posizione maturata oggi (€)', 'Comunicazione periodica annuale o area riservata', 'es. 45000')}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Contributi (busta paga)</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {numField('ral', 'Retribuzione annua utile al TFR (€)', 'Busta paga di dicembre, imponibile TFR progressivo', 'es. 60000')}
                  {numField('pct_lav', 'Contributo a tuo carico (%)', 'Voce trattenuta fondo pensione', 'es. 1,2')}
                  {numField('pct_dat', 'Contributo del datore (%)', 'Busta paga, CCNL o accordo aziendale', 'es. 2')}
                  {numField('pct_tfr', 'TFR versato al fondo (%)', '100 se versi tutto il TFR (6,91% della retribuzione)', '100')}
                  {numField('anni', 'Anni alla pensione', 'Orizzonte della simulazione', '20', true)}
                </div>
              </div>
            </Card>

            {/* Rendimento a confronto */}
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Rendimento a confronto</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Rendimenti netti medi annui, già al netto di costi di gestione e tasse sui rendimenti. Periodo: {view.period} anni fino al 31/12/2025.
                </p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <KpiTile label="Il tuo comparto" value={formatPct(view.ur)} tone={view.ur == null ? 'text-zinc-400' : undefined} />
                <KpiTile
                  label="Media fondi aperti"
                  value={formatPct(view.fpa, 1)}
                  hint={view.gapFpa != null && <span className={toneClass(view.gapFpa)}>Tu: {formatPoints(view.gapFpa)} punti</span>}
                />
                <KpiTile
                  label="Media fondi negoziali"
                  value={formatPct(view.fpn, 1)}
                  hint={view.gapFpn != null && <span className={toneClass(view.gapFpn)}>Tu: {formatPoints(view.gapFpn)} punti</span>}
                />
                <KpiTile
                  label="Miglior linea aperta"
                  value={view.best ? formatPct(view.best.rend) : 'n.d.'}
                  hint={view.best && <span className="block truncate" title={`${view.best.fondo}, ${view.best.linea}`}>{view.best.fondo}, {view.best.linea}</span>}
                />
                <KpiTile
                  className="col-span-2 lg:col-span-1"
                  label="ISC 10 anni: tuo / aperti"
                  value={`${formatPct(p.isc)} / ${formatPct(view.isc?.isc_fpa)}`}
                  hint={`Media negoziali: ${formatPct(view.isc?.isc_fpn)}`}
                />
              </div>
            </section>

            {/* Classifica della categoria */}
            <Card className="p-4 sm:p-6">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Linee dei fondi aperti nella tua categoria</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Rendimento medio annuo su {view.period} anni, lo stesso periodo del tuo dato. Il tuo comparto è la barra verde; tocca una barra per quota azionaria e costo.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 my-3">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: USER_COLOR }} />Il tuo comparto</span>
                <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-zinc-500" />Media fondi aperti</span>
                <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dotted border-zinc-500" />Media fondi negoziali</span>
                <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-zinc-400" />Rivalutazione TFR</span>
              </div>
              {view.bars.length ? (
                <PeersChart bars={view.bars} references={view.references} />
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Nessuna linea con {view.period} anni di storia in questa categoria tra i fondi censiti.</p>
              )}
            </Card>

            {/* Simulazione */}
            <Card className="p-4 sm:p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Restare o spostarsi in un fondo aperto</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Proiezione con contributi costanti e rendimento costante pari alla media storica di ciascuna linea. Non considera spese fisse annue, aumenti di stipendio e tassazione finale (uguale nei due casi).
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Field
                  id="fp-alt"
                  label="Fondo aperto da simulare"
                  hint={view.alt ? `Rendimento usato: ${formatPct(view.alt.rend)} l'anno, media su ${view.alt.periodo} anni` : 'Nessuna linea in questa categoria'}
                >
                  <select id="fp-alt" value={view.alt?.id ?? ''} onChange={(e) => update({ alt: e.target.value || null })} className={INPUT}>
                    {view.altLines.map(x => (
                      <option key={x.id} value={x.id}>{x.fondo} · {x.linea} ({formatPct(x.rend)}, {x.periodo} anni)</option>
                    ))}
                  </select>
                </Field>
                <label className="flex gap-2 items-start text-xs text-zinc-600 dark:text-zinc-300 lg:pt-6">
                  <input type="checkbox" checked={p.porta} onChange={(e) => update({ porta: e.target.checked })} className="mt-0.5 h-4 w-4 accent-emerald-600 shrink-0" />
                  <span>Il contributo del datore segue anche nel fondo aperto. Dalla fine di ottobre 2026 è possibile dopo almeno 2 anni nel fondo negoziale, per il contributo previsto dal CCNL: verifica il tuo caso.</span>
                </label>
              </div>

              {view.sim ? (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    <KpiTile label="Contributo annuo restando" value={formatEur(view.sim.contributionStay)} />
                    <KpiTile label="Contributo annuo nel fondo aperto" value={formatEur(view.sim.contributionSwitch)} />
                    <KpiTile label="Capitale finale restando" value={formatEur(view.sim.stay[view.sim.years])} />
                    <KpiTile label="Capitale finale nel fondo aperto" value={formatEur(view.sim.switched[view.sim.years])} />
                    <KpiTile
                      label="Differenza (aperto meno attuale)"
                      value={formatSignedEur(view.sim.switched[view.sim.years] - view.sim.stay[view.sim.years])}
                      tone={toneClass(view.sim.switched[view.sim.years] - view.sim.stay[view.sim.years])}
                    />
                    <KpiTile
                      label="Rendimento per pareggiare"
                      title="Rendimento annuo che serve al fondo aperto per arrivare allo stesso capitale finale"
                      value={view.sim.breakevenReached ? formatPct(view.sim.breakeven) : 'oltre 30%'}
                      hint="annuo, nel fondo aperto"
                    />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: USER_COLOR }} />Restando nel fondo attuale</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: ALT_COLOR }} />Nel fondo aperto scelto</span>
                  </div>
                  <SimulationChart stay={view.sim.stay} switched={view.sim.switched} />
                </>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Compila rendimento, retribuzione, contributi e anni alla pensione (fino a 60) per vedere la simulazione.
                </p>
              )}
            </Card>

            {/* Tabella fondi aperti */}
            <Card className="p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Linee dei principali fondi aperti</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {new Set(OPEN_FUND_LINES.map(x => x.fondo)).size} fondi, {OPEN_FUND_LINES.length} linee. Rendimento netto medio annuo a fine 2025 sul periodo indicato; costo di gestione annuo sul patrimonio (non è l&apos;ISC).
                  </p>
                </div>
                <label className="flex gap-2 items-center text-xs text-zinc-600 dark:text-zinc-300">
                  <input type="checkbox" checked={p.tutte} onChange={(e) => update({ tutte: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
                  Tutte le categorie
                </label>
              </div>
              <div className="overflow-x-auto -mx-4 sm:mx-0 mt-3" data-no-swipe>
                <table className="w-full text-sm tabular-nums">
                  <thead className="border-b border-zinc-100 dark:border-zinc-700">
                    <tr>
                      <th className={TH}>Fondo</th><th className={TH}>Linea</th><th className={TH}>Categoria</th>
                      <th className={classNames(TH, N)}>Azioni</th><th className={classNames(TH, N)}>Rend. medio</th>
                      <th className={classNames(TH, N)}>Anni</th><th className={classNames(TH, N)}>Costo gestione</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/60 text-zinc-800 dark:text-zinc-200">
                    {view.tableRows.map(x => (
                      <tr key={x.id} className={view.alt?.id === x.id ? 'bg-indigo-50 dark:bg-indigo-950/30' : undefined}>
                        <td className={TD}>
                          <a href={x.fonte} target="_blank" rel="noopener noreferrer" className="hover:underline">{x.fondo}</a>
                        </td>
                        <td className={TD}>{x.linea}</td>
                        <td className={classNames(TD, 'text-zinc-500 dark:text-zinc-400')}>{x.categoria_label}</td>
                        <td className={classNames(TD, N)}>{x.azioni_pct == null ? 'n.d.' : formatPct(x.azioni_pct, 0)}</td>
                        <td className={classNames(TD, N, x.rend < 0 && 'text-red-600 dark:text-red-400')}>{formatPct(x.rend)}</td>
                        <td className={classNames(TD, N)}>{x.periodo}</td>
                        <td className={classNames(TD, N)}>{formatPct(x.costo_gestione)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Medie COVIP e costi */}
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
              <Card className="p-4 sm:p-6 min-w-0">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Medie COVIP per comparto</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Rendimenti netti medi annui al 31/12/2025. In evidenza la tua categoria.</p>
                <div className="overflow-x-auto -mx-4 sm:mx-0 mt-3" data-no-swipe>
                  <table className="w-full text-sm tabular-nums">
                    <thead className="border-b border-zinc-100 dark:border-zinc-700">
                      <tr>
                        <th className={TH}>Forma</th><th className={TH}>Comparto</th>
                        <th className={classNames(TH, N)}>10 anni</th><th className={classNames(TH, N)}>5 anni</th>
                        <th className={classNames(TH, N)}>3 anni</th><th className={classNames(TH, N)}>2025</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/60 text-zinc-800 dark:text-zinc-200">
                      {COVIP_RETURNS.map(x => (
                        <tr key={`${x.forma}-${x.comparto}`} className={x.comparto === p.cat ? 'bg-emerald-50 dark:bg-emerald-950/30 font-medium' : undefined}>
                          <td className={TD}>{x.forma_label}</td>
                          <td className={TD}>{x.comparto_label}</td>
                          <td className={classNames(TD, N)}>{formatPct(x.r10, 1)}</td>
                          <td className={classNames(TD, N)}>{formatPct(x.r5, 1)}</td>
                          <td className={classNames(TD, N)}>{formatPct(x.r3, 1)}</td>
                          <td className={classNames(TD, N)}>{formatPct(x.r1, 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card className="p-4 sm:p-6 min-w-0">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Costi medi (ISC a 10 anni)</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Indicatore sintetico dei costi COVIP al 31/12/2025, con minimo e massimo di mercato.</p>
                <div className="overflow-x-auto -mx-4 sm:mx-0 mt-3" data-no-swipe>
                  <table className="w-full text-sm tabular-nums">
                    <thead className="border-b border-zinc-100 dark:border-zinc-700">
                      <tr>
                        <th className={TH}>Comparto</th><th className={classNames(TH, N)}>Negoziali</th><th className={classNames(TH, N)}>Aperti</th>
                        <th className={classNames(TH, N)}>PIP</th><th className={classNames(TH, N)}>Min</th><th className={classNames(TH, N)}>Max</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/60 text-zinc-800 dark:text-zinc-200">
                      {COVIP_ISC.map(x => (
                        <tr key={x.comparto} className={x.comparto === iscCategory(p.cat) ? 'bg-emerald-50 dark:bg-emerald-950/30 font-medium' : undefined}>
                          <td className={TD}>{x.comparto_label}</td>
                          <td className={classNames(TD, N)}>{formatPct(x.isc_fpn)}</td>
                          <td className={classNames(TD, N)}>{formatPct(x.isc_fpa)}</td>
                          <td className={classNames(TD, N)}>{formatPct(x.isc_pip)}</td>
                          <td className={classNames(TD, N)}>{formatPct(x.isc_min)}</td>
                          <td className={classNames(TD, N)}>{formatPct(x.isc_max)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Dove trovo i dati */}
            <Card className="p-4 sm:p-6">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Dove trovo i dati</h2>
              <ul className="mt-2 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-300 list-disc pl-5">
                <li>Busta paga di dicembre: imponibile TFR progressivo, percentuale e importo del tuo contributo, del contributo del datore e quota TFR al fondo.</li>
                <li>Certificazione unica e 730 (quadro E, righi E27-E31): contributi dedotti e non dedotti. Servono per il beneficio fiscale, che è lo stesso in ogni fondo.</li>
                <li>Comunicazione periodica annuale del fondo: posizione maturata, comparto, versamenti dell&apos;anno.</li>
                <li>Sito del fondo o elenco rendimenti COVIP: rendimenti a 10 e 5 anni del tuo comparto. Nota informativa, scheda &quot;I costi&quot;: ISC.</li>
              </ul>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">
                I rendimenti storici non indicano quelli futuri. Fonti: COVIP; linee dei fondi aperti dalle schede ciaoelsa.com su dati COVIP, lette il 01/11/2026.
              </p>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
