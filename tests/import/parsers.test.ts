import { describe, expect, it } from 'vitest'
import { parseCSV, parseOFX } from '@/lib/importParsers'
import { fetchAllRows } from '@/lib/supabaseFetchAll'

describe('parseCSV', () => {
  it('senza colonna tipo decide il segno: negativo spesa, positivo entrata', () => {
    const { transactions } = parseCSV('data;importo;descrizione\n2026-03-01;-45,90;Conad\n2026-03-27;2.100,00;Stipendio')
    expect(transactions.map(t => [t.type, t.amount])).toEqual([['expense', 45.9], ['income', 2100]])
  })

  it('con il tipo esplicito il segno non conta', () => {
    const { transactions } = parseCSV('data,tipo,importo\n2026-03-01,spesa,85.50\n2026-03-02,risparmio,300')
    expect(transactions.map(t => [t.type, t.amount])).toEqual([['expense', 85.5], ['saving', 300]])
  })

  it('tipo sconosciuto: decide il segno', () => {
    const { transactions } = parseCSV('data,tipo,importo\n2026-03-01,giroconto,-20')
    expect(transactions[0].type).toBe('expense')
  })

  it("con separatore ';' la virgola è il decimale", () => {
    const { transactions } = parseCSV('data;tipo;importo\n2026-03-01;spesa;12,500\n2026-03-02;spesa;1.234\n2026-03-03;spesa;85.50')
    expect(transactions.map(t => t.amount)).toEqual([12.5, 1234, 85.5])
  })

  it('scarta date inesistenti', () => {
    const { transactions, errors } = parseCSV('data,importo\n31/02/2026,10')
    expect(transactions).toHaveLength(0)
    expect(errors[0].reason).toMatch(/Data non valida/)
  })
})

describe('parseOFX', () => {
  const ofx = (type: string, amt: string) =>
    `<OFX><STMTTRN><TRNTYPE>${type}<DTPOSTED>20260310<TRNAMT>${amt}<MEMO>Bonifico</STMTTRN></OFX>`

  it('un XFER negativo è una spesa', () => {
    expect(parseOFX(ofx('XFER', '-500.00')).transactions[0]).toMatchObject({ type: 'expense', amount: 500 })
  })

  it('un XFER positivo è una entrata', () => {
    expect(parseOFX(ofx('XFER', '500.00')).transactions[0]).toMatchObject({ type: 'income', amount: 500, date: '2026-03-10' })
  })
})

describe('fetchAllRows', () => {
  it('legge tutte le pagine fino a una pagina incompleta', async () => {
    const all = Array.from({ length: 2500 }, (_, i) => i)
    const calls: number[] = []
    const rows = await fetchAllRows(async (from, to) => {
      calls.push(from)
      return { data: all.slice(from, to + 1), error: null }
    })
    expect(rows).toHaveLength(2500)
    expect(calls).toEqual([0, 1000, 2000])
  })

  it('propaga gli errori', async () => {
    await expect(fetchAllRows(async () => ({ data: null, error: new Error('boom') }))).rejects.toThrow('boom')
  })
})
