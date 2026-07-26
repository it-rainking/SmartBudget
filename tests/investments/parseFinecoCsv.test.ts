import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { parseFinecoCsv } from '@/lib/investments/parseFinecoCsv'

const fixture = readFileSync(
  path.resolve(__dirname, '../fixtures/fineco_export_sample.csv'),
  'utf-8'
)

describe('parseFinecoCsv', () => {
  it('parsa il separatore ; e i decimali con la virgola', () => {
    const { rows, warnings } = parseFinecoCsv(fixture)

    expect(warnings).toEqual([])
    expect(rows).toHaveLength(3)

    const vwce = rows.find((r) => r.isin === 'IE00BK5BQT80')
    expect(vwce).toBeDefined()
    expect(vwce?.quantity).toBe(120)
    expect(vwce?.avg_cost).toBe(95.32)
    expect(vwce?.name).toBe('VANGUARD FTSE ALL-WORLD UCITS ETF')
  })

  it('lancia un errore chiaro se mancano le colonne richieste', () => {
    const csv = '"Strumento";"Quantità"\n"Test";"10"\n'
    expect(() => parseFinecoCsv(csv)).toThrowError(/ISIN/)
    expect(() => parseFinecoCsv(csv)).toThrowError(/Prezzo medio di carico/)
  })

  it('scarta le righe con quantità non numerica riportandola come warning', () => {
    const csv = '"ISIN";"Quantità";"Prezzo medio di carico"\n"IE00TEST0001";"n/d";"10,00"\n'
    const { rows, warnings } = parseFinecoCsv(csv)
    expect(rows).toHaveLength(0)
    expect(warnings[0]).toMatch(/quantità non valida/)
  })

  it('scarta le righe con ISIN mancante riportandola come warning', () => {
    const csv = '"ISIN";"Quantità";"Prezzo medio di carico"\n"";"10,00";"5,00"\n'
    const { rows, warnings } = parseFinecoCsv(csv)
    expect(rows).toHaveLength(0)
    expect(warnings[0]).toMatch(/ISIN mancante/)
  })
})
