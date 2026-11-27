import { readFileSync } from 'fs'
import path from 'path'
import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { parseFinecoRows } from '@/lib/import/fineco'
import { parseRevolutCsv } from '@/lib/import/revolut'
import { classifyMovements } from '@/lib/import/rules'
import { classifyAgainstExisting, defaultIncluded, isSelected } from '@/lib/import/dedupe'
import { parseAmount, parseDayFirstDate } from '@/lib/import/parse'
import { excelSerialToDate, readXlsxRows } from '@/lib/import/xlsx'
import { parseStatementFile } from '@/lib/import'
import type { RawMovement } from '@/lib/import/types'

const fixture = (name: string) => readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf-8')

// ─── Parsing di base ─────────────────────────────────────────────────────────

describe('parse', () => {
  it('importi europei e anglosassoni', () => {
    expect(parseAmount('-19.50')).toBe(-19.5)
    expect(parseAmount('1.234,56')).toBe(1234.56)
    expect(parseAmount('1,234.56')).toBe(1234.56)
    expect(parseAmount('12,5')).toBe(12.5)
    expect(parseAmount('abc')).toBeNaN()
  })

  it('date con orario e anno a due cifre', () => {
    expect(parseDayFirstDate('02/01/26 10:47')).toBe('2026-01-02')
    expect(parseDayFirstDate('2026-03-02 07:01:44')).toBe('2026-03-02')
    expect(parseDayFirstDate('31/02/2026')).toBeNull()
  })

  it('seriale Excel', () => {
    expect(excelSerialToDate(46345)).toBe('2026-11-19')
  })
})

// ─── XLSX ────────────────────────────────────────────────────────────────────

function buildXlsx(sheetXml: string, shared: string[]): Uint8Array {
  const sst = `<sst>${shared.map(s => `<si><t>${s}</t></si>`).join('')}</sst>`
  return zipSync({
    'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="Movimenti" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/sharedStrings.xml': strToU8(sst),
    'xl/worksheets/sheet1.xml': strToU8(`<worksheet><sheetData>${sheetXml}</sheetData></worksheet>`),
  })
}

describe('readXlsxRows', () => {
  it('legge stringhe condivise, numeri e celle saltate', () => {
    const bytes = buildXlsx(
      '<row r="1"><c r="A1" t="s"><v>0</v></c></row>' +
        '<row r="3"><c r="A3"><v>46345</v></c><c r="C3"><v>-12.5</v></c><c r="D3" t="s"><v>1</v></c></row>',
      ['Intestazione Conto Corrente: MARIO ROSSI', 'Bar &amp; Caff&#232;']
    )
    const rows = readXlsxRows(bytes)
    expect(rows[0]).toEqual(['Intestazione Conto Corrente: MARIO ROSSI'])
    expect(rows[1]).toEqual([])
    expect(rows[2]).toEqual([46345, null, -12.5, 'Bar & Caffè'])
  })
})

// ─── Fineco ──────────────────────────────────────────────────────────────────

const FINECO_HEADER = ['Data_Operazione', 'Data_Valuta', 'Entrate', 'Uscite', 'Descrizione', 'Descrizione_Completa', 'Stato', '']
const fineco = (op: number, val: number, inAmt: number | null, outAmt: number | null, kind: string, full: string, state = 'Contabilizzato') =>
  [op, val, inAmt, outAmt, kind, full, state, null]

const finecoRows = [
  ['Conto Corrente: 0000001'],
  ['Intestazione Conto Corrente: ROSSI MARIO\''],
  ['Periodo Dal: 01/01/2026 Al: 21/11/2026'],
  [],
  FINECO_HEADER,
  fineco(46345, 46345, null, -1500, 'Compravendita Titoli', 'Compravendita Titoli NVIDIA Qta/Val.nom. 30,000000'),
  fineco(46343, 46341, null, -0.99, 'Pagamento Visa Debit', 'PAYPAL *ITUNESAPPST AP 4029357733 IE Carta N. ***** 544 Data operazione 15/11/26'),
  fineco(46333, 46332, null, -12.4, 'Pagamento Bancomat', 'Pag. del 06/11/26 ora 20:49 presso: MCDO NALD\'S PAULLO'),
  fineco(46336, 46336, null, -10, 'Bonifico Istantaneo', 'Beneficiario: Mario Rossi IBAN: IT91R0 366901600072578779679 Causale: Giro conto per spese persona li'),
  fineco(46330, 46330, null, -350, 'SEPA Direct Debit', 'NEXI PAYMENTS SPA Addebito SDD fattura a Vs carico Per ESTRATTO CONTO DEUTSC HE BANK DEL 15- 09-26 CARTA N. 493532'),
  fineco(46328, 46328, null, -200, 'Bonifico SEPA Estero', 'Ben: Mario Rossi Ins: 02/11/2026 Iban: DE5420 Cau: Giroconto su Crypto per acquisti periodici'),
  fineco(46323, 46323, 2800, null, 'Stipendio', 'Ord: ACME SPA Ben: ROSSI MARIO Dt -ord: 29/10/2026 Info-Cli: STIPENDIO OTTO BRE 2026'),
  fineco(46313, 46312, 4.5, null, 'Dividendo estero', 'Div.su 10,000 ASML'),
  fineco(46313, 46312, null, -1.2, 'Ritenuta dividendo estero', 'Rit.div.su 10,000 ASML'),
  fineco(46309, 46308, null, -30, 'SEPA Direct Debit', 'Satispay Europe S.A. Addebito SDD fattur a a Vs carico Per Ricarica dell\'app Satispay'),
  fineco(46309, 46308, null, -5, 'Pagamento Visa Debit', 'TOGETHER PRICE SRL ROMA IT', 'Autorizzato'),
  fineco(46300, 46300, 100, null, 'Bonifico SEPA Italia', 'Ord: Mario Rossi Ben: ROSSI MARIO Cau: rientro da Revolut'),
  [null, null, null, null, null, null, null, null],
]

describe('Fineco', () => {
  const parsed = parseFinecoRows(finecoRows)
  const byLine = (line: number) => classifyMovements(parsed.movements, { holder: parsed.holder }).find(c => c.line === line)!

  it('trova intestazione, intestatario e usa la data valuta', () => {
    expect(parsed.holder).toBe('ROSSI MARIO\'')
    expect(parsed.movements).toHaveLength(12)
    const mc = parsed.movements.find(m => m.line === 8)!
    expect(mc.date).toBe(excelSerialToDate(46332))
    expect(mc.amount).toBe(-12.4)
  })

  it('applica le regole concordate', () => {
    expect(byLine(6)).toMatchObject({ status: 'skip', reason: expect.stringContaining('Compravendita') })
    expect(byLine(7)).toMatchObject({ status: 'review', isPaypal: true, payment_method: 'PayPal' })
    expect(byLine(8)).toMatchObject({ status: 'import', type: 'expense', amount: 12.4, payment_method: 'Carta' })
    expect(byLine(9)).toMatchObject({ status: 'skip', reason: 'Giroconto tra tuoi conti' })
    expect(byLine(10)).toMatchObject({ status: 'skip', reason: 'Addebito mensile della carta di credito' })
    expect(byLine(11)).toMatchObject({ status: 'import', type: 'saving', categoryKey: 'investimenti' })
    expect(byLine(12)).toMatchObject({ status: 'import', type: 'income', amount: 2800 })
    expect(byLine(13)).toMatchObject({ type: 'income', categoryKey: 'investimenti' })
    expect(byLine(14)).toMatchObject({ type: 'expense', categoryKey: 'investimenti', amount: 1.2 })
    expect(byLine(15)).toMatchObject({ status: 'review', categoryKey: 'satispay' })
    expect(byLine(16)).toMatchObject({ status: 'skip', reason: 'Movimento non ancora contabilizzato' })
    expect(byLine(17)).toMatchObject({ status: 'skip', reason: 'Bonifico tra tuoi conti' })
  })
})

// ─── Revolut ─────────────────────────────────────────────────────────────────

describe('Revolut', () => {
  it('CSV salvato da Excel: importi divisi per 100 e controllo del saldo', () => {
    const parsed = parseRevolutCsv(fixture('revolut_excel_salvato.csv'))
    expect(parsed.warnings).toHaveLength(1)
    expect(parsed.movements.map(m => m.amount)).toEqual([-5, -9, -19.5, -150.1, -22, 1000, -3.5])
    const c = classifyMovements(parsed.movements)
    expect(c[0]).toMatchObject({ type: 'saving', categoryKey: 'investimenti', amount: 5 })
    expect(c[2]).toMatchObject({ status: 'import', date: '2026-01-03', amount: 19.5 })
    expect(c[5]).toMatchObject({ status: 'skip', reason: 'Ricarica da un tuo conto' })
    expect(c[6]).toMatchObject({ status: 'review', reason: expect.stringContaining('saldo') })
  })

  it('CSV originale: punto decimale, commissioni, stati e cambi', () => {
    const parsed = parseRevolutCsv(fixture('revolut_originale.csv'))
    expect(parsed.warnings).toHaveLength(0)
    const c = classifyMovements(parsed.movements)
    expect(c[0]).toMatchObject({ status: 'import', amount: 42.3, date: '2026-03-02' })
    expect(c[1]).toMatchObject({ status: 'review', isPaypal: true })
    expect(c[2]).toMatchObject({ status: 'skip', reason: expect.stringContaining('non completato') })
    expect(c[3]).toMatchObject({ status: 'skip', reason: 'Cambio valuta interno' })
    expect(c[4]).toMatchObject({ status: 'review', categoryKey: 'satispay' })
    expect(c[5]).toMatchObject({ status: 'import', type: 'income', amount: 35 })
    expect(c[6]).toMatchObject({ status: 'import', amount: 11 })
    expect(c.every(x => !x.reason?.includes('saldo'))).toBe(true)
  })

  it('riconosce il file da parseStatementFile', () => {
    const r = parseStatementFile('estratto.csv', strToU8(fixture('revolut_originale.csv')))
    expect(r?.source).toBe('revolut')
    expect(parseStatementFile('altro.csv', strToU8('data,importo\n2026-01-01,5'))).toBeNull()
  })
})

// ─── external_id e doppioni ──────────────────────────────────────────────────

const mv = (over: Partial<RawMovement>): RawMovement => ({
  source: 'fineco', line: 1, date: '2026-05-10', amount: -10, fee: 0, currency: 'EUR',
  description: 'Bar Centrale', kind: 'Pagamento Visa Debit', state: 'Contabilizzato', ...over,
})

describe('external_id', () => {
  it('stabile tra import diversi e distinto per righe identiche', () => {
    const a = classifyMovements([mv({}), mv({ line: 2 })])
    const b = classifyMovements([mv({ line: 7 }), mv({ line: 9 })])
    expect(a[0].external_id).not.toBe(a[1].external_id)
    expect(a.map(x => x.external_id)).toEqual(b.map(x => x.external_id))
  })
})

describe('classifyAgainstExisting', () => {
  const candidates = classifyMovements([
    mv({ line: 1, description: 'Esselunga Milano', amount: -42.3 }),
    mv({ line: 2, description: 'PAYPAL *NEGOZIO', amount: -33.33, date: '2026-05-12' }),
    mv({ line: 3, description: 'PAYPAL *ALTRO', amount: -15, date: '2026-05-12' }),
    mv({ line: 4, description: 'Farmacia', amount: -8.9, date: '2026-05-15' }),
    mv({ line: 5, description: 'Cinema', amount: -9.5, date: '2026-05-20' }),
  ])

  const existing = [
    { id: 'e1', date: '2026-05-10', amount: 42.3, type: 'expense', description: 'Esselunga Milano' },
    { id: 'e2', date: '2026-05-10', amount: 33.33, type: 'expense', description: 'Rata 1/3', installment_plan_id: 'p1' },
    { id: 'e3', date: '2026-05-16', amount: 8.9, type: 'expense', description: 'Medicine' },
    { id: 'e4', date: '2026-05-01', amount: 9.5, type: 'expense', description: 'x', external_id: candidates[4].external_id },
  ]

  const items = classifyAgainstExisting(candidates, existing)

  it('scarta i doppioni certi e le rate PayPal già registrate', () => {
    expect(items[0]).toMatchObject({ status: 'skip', reason: expect.stringContaining('Già presente') })
    expect(items[1]).toMatchObject({ status: 'skip', reason: 'Rata già registrata' })
    expect(items[2]).toMatchObject({ status: 'review', isPaypal: true })
    expect(items[4]).toMatchObject({ status: 'skip', reason: expect.stringContaining('Già importato') })
  })

  it('propone i possibili doppioni con scelta di default "salta"', () => {
    expect(items[3].match?.id).toBe('e3')
    expect(items[3].decision).toBe('skip')
    const included = defaultIncluded(items)
    expect(items.filter(i => isSelected(i, included)).map(i => i.line)).toEqual([3])
    expect(isSelected({ ...items[3], decision: 'replace' }, included)).toBe(true)
  })
})
