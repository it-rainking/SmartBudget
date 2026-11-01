'use client'

import '@/components/dashboard/chartSetup'
import { Bar, Line } from 'react-chartjs-2'
import type { Plugin } from 'chart.js'
import { formatPct, formatEur } from './format'

const TICK = { color: '#a1a1aa', font: { size: 11 } }
const GRID = 'rgba(161, 161, 170, 0.15)'
export const USER_COLOR = '#10b981'
export const ALT_COLOR = '#6366f1'
const PEER_COLOR = 'rgba(161, 161, 170, 0.45)'
const PEER_COLOR_HOVER = 'rgba(161, 161, 170, 0.75)'

export interface PeerBar {
  label: string
  value: number
  isUser: boolean
  equities?: number | null
  cost?: number
}

export interface ReferenceLine {
  value: number
  /** dash pattern Chart.js: [6, 4] tratteggio, [2, 3] punteggiato, [] continuo */
  dash: number[]
  color: string
}

// Linee verticali di riferimento (medie COVIP, rivalutazione TFR) sopra le barre
const referenceLinesPlugin: Plugin<'bar', { lines: ReferenceLine[] }> = {
  id: 'pensionReferenceLines',
  afterDatasetsDraw(chart, _args, opts) {
    const { ctx, chartArea, scales } = chart
    ctx.save()
    for (const line of opts.lines ?? []) {
      const x = scales.x.getPixelForValue(line.value)
      if (x < chartArea.left || x > chartArea.right) continue
      ctx.beginPath()
      ctx.setLineDash(line.dash)
      ctx.lineWidth = 2
      ctx.strokeStyle = line.color
      ctx.moveTo(x, chartArea.top)
      ctx.lineTo(x, chartArea.bottom)
      ctx.stroke()
    }
    ctx.restore()
  },
}

/** Rendimento medio annuo delle linee aperte della categoria, con il comparto dell'utente evidenziato */
export function PeersChart({ bars, references }: { bars: PeerBar[]; references: ReferenceLine[] }) {
  const values = [0, ...bars.map(b => b.value), ...references.map(r => r.value)]
  const min = Math.floor(Math.min(...values))
  const max = Math.ceil(Math.max(...values))

  return (
    <div style={{ height: Math.max(160, bars.length * 30 + 40) }} data-no-swipe>
      <Bar
        aria-label="Rendimento medio annuo delle linee della categoria"
        data={{
          labels: bars.map(b => b.label),
          datasets: [{
            data: bars.map(b => b.value),
            backgroundColor: bars.map(b => (b.isUser ? USER_COLOR : PEER_COLOR)),
            hoverBackgroundColor: bars.map(b => (b.isUser ? USER_COLOR : PEER_COLOR_HOVER)),
            borderRadius: 3,
            barThickness: 14,
          }],
        }}
        plugins={[referenceLinesPlugin]}
        options={{
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            // @ts-expect-error opzioni del plugin locale, non dichiarate nei tipi di Chart.js
            pensionReferenceLines: { lines: references },
            tooltip: {
              callbacks: {
                label: (item) => {
                  const b = bars[item.dataIndex]
                  const out = [`Rendimento medio annuo: ${formatPct(b.value)}`]
                  if (!b.isUser) {
                    out.push(`Azioni: ${b.equities == null ? 'n.d.' : formatPct(b.equities, 0)}`)
                    if (b.cost != null) out.push(`Costo di gestione: ${formatPct(b.cost)}`)
                  }
                  return out
                },
              },
            },
          },
          scales: {
            x: {
              min, max,
              grid: { color: GRID },
              border: { display: false },
              ticks: { ...TICK, callback: (v) => formatPct(Number(v), 0) },
            },
            y: {
              grid: { display: false },
              ticks: {
                ...TICK,
                color: (c) => (bars[c.index]?.isUser ? USER_COLOR : '#a1a1aa'),
                // Etichette accorciate in base alla larghezza: sotto i 640px
                // l'asse occuperebbe metà del grafico
                callback: (_v, i) => {
                  const l = bars[i]?.label ?? ''
                  const max = typeof window !== 'undefined' && window.innerWidth < 640 ? 22 : 40
                  return l.length > max ? l.slice(0, max - 1) + '…' : l
                },
              },
            },
          },
        }}
      />
    </div>
  )
}

/** Capitale accumulato anno per anno nei due scenari */
export function SimulationChart({ stay, switched }: { stay: number[]; switched: number[] }) {
  return (
    <div className="h-60" data-no-swipe>
      <Line
        aria-label="Capitale accumulato negli anni restando o passando al fondo aperto"
        data={{
          labels: stay.map((_, i) => String(i)),
          datasets: [
            { label: 'Restando', data: stay, borderColor: USER_COLOR, backgroundColor: USER_COLOR, borderWidth: 2, pointRadius: 0, tension: 0.2 },
            { label: 'Fondo aperto', data: switched, borderColor: ALT_COLOR, backgroundColor: ALT_COLOR, borderWidth: 2, pointRadius: 0, tension: 0.2 },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => `Anno ${items[0].label}`,
                label: (item) => `${item.dataset.label}: ${formatEur(item.parsed.y ?? 0)}`,
              },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { ...TICK, maxTicksLimit: 8 }, title: { display: true, text: 'Anni da oggi', ...TICK } },
            y: {
              grid: { color: GRID },
              border: { display: false },
              ticks: {
                ...TICK,
                maxTicksLimit: 5,
                callback: (v) => new Intl.NumberFormat('it-IT', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(v)) + ' €',
              },
            },
          },
        }}
      />
    </div>
  )
}
