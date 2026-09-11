import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  decodeCsvBuffer,
  detectNonCsvFormat,
  detectPriceDivisor,
  isPercentQuotedType,
  parseAmount,
  parseFinecoCsv,
} from '@/lib/investments/parseFinecoCsv'
import { isKnownMarket, resolveTickerFromCsv } from '@/lib/investments/resolveTicker'

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

  it('elenca le colonne rilevate nel messaggio di errore', () => {
    const csv = '"Strumento";"Quantità"\n"Test";"10"\n'
    expect(() => parseFinecoCsv(csv)).toThrowError(/Colonne rilevate nel file: Strumento, Quantità/)
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

  it('salta le righe di intestazione libere prima della tabella', () => {
    const csv = [
      'Portafoglio titoli al 10/09/2026',
      'Conto: 12345678',
      '',
      'Simbolo;Descrizione;ISIN;Quantità;Prz. Medio Carico;Controvalore',
      'VWCE;VANGUARD FTSE ALL-WORLD;IE00BK5BQT80;120;95,32;12.540,00',
    ].join('\n')
    const { rows } = parseFinecoCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      isin: 'IE00BK5BQT80',
      name: 'VANGUARD FTSE ALL-WORLD',
      quantity: 120,
      avg_cost: 95.32,
    })
  })

  it('riconosce le varianti di nome delle colonne', () => {
    const csv = '"Titolo";"Codice ISIN";"Q.tà";"PMC"\n"VWCE";"IE00BK5BQT80";"120";"95,32"\n'
    const { rows } = parseFinecoCsv(csv)
    expect(rows[0]).toMatchObject({ isin: 'IE00BK5BQT80', quantity: 120, avg_cost: 95.32 })
  })

  it('trova l\'ISIN nei dati anche senza una colonna dedicata', () => {
    const csv = 'Descrizione;Codice;Quantità;Prezzo medio di carico\nVANGUARD;IE00BK5BQT80;120;95,32\n'
    const { rows } = parseFinecoCsv(csv)
    expect(rows[0].isin).toBe('IE00BK5BQT80')
  })

  it('ricava il prezzo medio dal valore di carico quando manca il PMC', () => {
    const csv = 'Strumento;ISIN;Quantità;Valore di carico\nVWCE;IE00BK5BQT80;120;11.438,40\n'
    const { rows } = parseFinecoCsv(csv)
    expect(rows[0].avg_cost).toBe(95.32)
  })

  it('aggrega le righe duplicate sullo stesso ISIN a media ponderata', () => {
    const csv = 'Strumento;ISIN;Quantità;Prezzo medio di carico\nVWCE;IE00BK5BQT80;100;95,00\nVWCE;IE00BK5BQT80;20;101,00\n'
    const { rows, warnings } = parseFinecoCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].quantity).toBe(120)
    expect(rows[0].avg_cost).toBe(96)
    expect(warnings.some((w) => w.includes('più righe nel CSV'))).toBe(true)
  })

  it('ignora le righe di totale e i disclaimer in coda', () => {
    const csv = [
      'Strumento;ISIN;Quantità;Prezzo medio di carico',
      'VWCE;IE00BK5BQT80;120;95,32',
      'TOTALE;;120;',
      'Documento non avente valore certificativo;;;',
    ].join('\n')
    const { rows, warnings } = parseFinecoCsv(csv)
    expect(rows).toHaveLength(1)
    expect(warnings).toEqual([])
  })

  it('ignora le posizioni chiuse con quantità zero', () => {
    const csv = 'Strumento;ISIN;Quantità;Prezzo medio di carico\nVWCE;IE00BK5BQT80;0;95,32\n'
    const { rows, warnings } = parseFinecoCsv(csv)
    expect(rows).toHaveLength(0)
    expect(warnings[0]).toMatch(/posizione chiusa/)
  })

  it('gestisce il separatore tab e i CSV con virgola', () => {
    const tab = 'Strumento\tISIN\tQuantità\tPrezzo medio di carico\nVWCE\tIE00BK5BQT80\t120\t95,32\n'
    expect(parseFinecoCsv(tab).rows[0].quantity).toBe(120)

    const comma = 'Strumento,ISIN,Quantità,Prezzo medio di carico\nVWCE,IE00BK5BQT80,120,95.32\n'
    expect(parseFinecoCsv(comma).rows[0].avg_cost).toBe(95.32)
  })

  it('rifiuta un file vuoto con un messaggio esplicito', () => {
    expect(() => parseFinecoCsv('   ')).toThrowError(/vuoto/)
  })
})

describe('export reale Fineco (Portafoglio di sintesi)', () => {
  const readFixture = (name: string) =>
    decodeCsvBuffer(
      new Uint8Array(readFileSync(path.resolve(__dirname, `../fixtures/${name}`))).buffer as ArrayBuffer
    )

  it('parsa il layout completo: preambolo, BOM, CRLF, header a riga 3', () => {
    const { rows, warnings, detectedColumns } = parseFinecoCsv(readFixture('fineco_portafoglio_export.csv'))

    expect(detectedColumns[0]).toBe('Titolo')
    expect(detectedColumns).toContain('P.zo medio di carico')
    expect(rows).toHaveLength(4)
    // L'unico warning atteso è quello sul titolo quotato in percentuale.
    expect(warnings).toEqual([
      expect.stringContaining('quotato in percentuale del nominale'),
    ])
  })

  it('usa "Titolo" come nome e non "Strumento", che in Fineco è il tipo', () => {
    const { rows } = parseFinecoCsv(readFixture('fineco_portafoglio_export.csv'))
    expect(rows.map((r) => r.name)).toEqual([
      'VANGUARD FTSE ALL-WORLD UCITS ETF',
      'ISHARES CORE MSCI WORLD UCITS ETF',
      'APPLE INC',
      'BTP 15AP26 3,5%',
    ])
  })

  it('legge il PMC da "P.zo medio di carico", non dal valore di carico in euro', () => {
    const { rows } = parseFinecoCsv(readFixture('fineco_portafoglio_export.csv'))
    const apple = rows.find((r) => r.isin === 'US0378331005')
    // 1.620,00 € / 10 darebbe 162: il carico in valuta del titolo è 150.
    expect(apple?.avg_cost).toBe(150)
    expect(apple?.currency).toBe('USD')
  })

  it('riporta la valuta di ogni posizione', () => {
    const { rows } = parseFinecoCsv(readFixture('fineco_portafoglio_export.csv'))
    expect(rows.map((r) => r.currency)).toEqual(['EUR', 'EUR', 'USD', 'EUR'])
  })

  it('sull\'export senza posizioni riconosce l\'header e non lancia errori di formato', () => {
    const { rows, detectedColumns } = parseFinecoCsv(readFixture('fineco_portafoglio_vuoto.csv'))
    expect(rows).toHaveLength(0)
    expect(detectedColumns).toContain('ISIN')
    expect(detectedColumns).toContain('Quantità')
  })
})

describe('titoli quotati in percentuale del nominale', () => {
  const readFixture = (name: string) =>
    decodeCsvBuffer(
      new Uint8Array(readFileSync(path.resolve(__dirname, `../fixtures/${name}`))).buffer as ArrayBuffer
    )

  it('rileva il divisore 100 sulle obbligazioni e lascia 1 su ETF e azioni', () => {
    const { rows } = parseFinecoCsv(readFixture('fineco_portafoglio_export.csv'))
    const byIsin = Object.fromEntries(rows.map((r) => [r.isin, r]))

    expect(byIsin['IT0005493250'].price_divisor).toBe(100)
    expect(byIsin['IE00BK5BQT80'].price_divisor).toBe(1)
    expect(byIsin['US0378331005'].price_divisor).toBe(1)
  })

  it('espone simbolo, mercato e tipo strumento di ogni posizione', () => {
    const { rows } = parseFinecoCsv(readFixture('fineco_portafoglio_export.csv'))
    const vwce = rows.find((r) => r.isin === 'IE00BK5BQT80')
    expect(vwce).toMatchObject({ symbol: 'VWCE', market: 'MTA', instrument_type: 'ETF' })
  })

  it('deduce il divisore dal valore di carico, non dal nome dello strumento', () => {
    // Nominale 10.000, prezzo 98,50%: solo /100 riproduce il valore di carico.
    expect(detectPriceDivisor(10000, 98.5, 9850, NaN, undefined)).toBe(100)
    // Azione: quantità * prezzo torna già senza divisore.
    expect(detectPriceDivisor(10, 150, 1500, NaN, 'Obbligazioni')).toBe(1)
  })

  it('accetta il cambio in entrambe le direzioni, la convenzione non è dichiarata', () => {
    expect(detectPriceDivisor(10, 150, 1620, 1.08, undefined)).toBe(1)
    expect(detectPriceDivisor(10, 150, 1388.89, 1.08, undefined)).toBe(1)
  })

  it('ricade sul tipo strumento quando manca il valore di carico', () => {
    expect(detectPriceDivisor(10000, 98.5, NaN, NaN, 'Obbligazioni')).toBe(100)
    expect(detectPriceDivisor(120, 95.32, NaN, NaN, 'ETF')).toBe(1)
  })

  it('non tratta come percentuale un ETF obbligazionario', () => {
    expect(isPercentQuotedType('ETF Obbligazionario')).toBe(false)
    expect(isPercentQuotedType('Obbligazioni')).toBe(true)
    expect(isPercentQuotedType('Titoli di Stato')).toBe(true)
    expect(isPercentQuotedType('Azioni')).toBe(false)
  })
})

describe('resolveTickerFromCsv', () => {
  it('costruisce i ticker dai mercati noti', () => {
    expect(resolveTickerFromCsv('VWCE', 'MTA')).toEqual({ ticker_gf: 'BIT:VWCE', ticker_yahoo: 'VWCE.MI' })
    expect(resolveTickerFromCsv('AAPL', 'NASDAQ')).toEqual({ ticker_gf: 'NASDAQ:AAPL', ticker_yahoo: 'AAPL' })
    expect(resolveTickerFromCsv('IWDA', 'Xetra')).toEqual({ ticker_gf: 'ETR:IWDA', ticker_yahoo: 'IWDA.DE' })
  })

  it('non inventa nulla su mercati sconosciuti o dati mancanti', () => {
    expect(resolveTickerFromCsv('XYZ', 'Mercato Ignoto')).toBeNull()
    expect(resolveTickerFromCsv('', 'MTA')).toBeNull()
    expect(resolveTickerFromCsv('VWCE', undefined)).toBeNull()
  })

  it('non deriva ticker per i titoli quotati in percentuale', () => {
    // Sul MOT il "simbolo" Fineco non è un ticker interrogabile.
    expect(resolveTickerFromCsv('BTP26', 'MOT', { percentQuoted: true })).toBeNull()
  })

  it('riconosce i mercati mappati', () => {
    expect(isKnownMarket('MTA')).toBe(true)
    expect(isKnownMarket('Borsa Italiana')).toBe(true)
    expect(isKnownMarket('Mercato Ignoto')).toBe(false)
  })

  // Codici osservati in un export Fineco reale.
  it('mappa i codici mercato usati da Fineco', () => {
    expect(resolveTickerFromCsv('CUCINELLI', 'AFF')).toEqual({ ticker_gf: 'BIT:CUCINELLI', ticker_yahoo: 'CUCINELLI.MI' })
    expect(resolveTickerFromCsv('ASML', 'EURONEXTNL')).toEqual({ ticker_gf: 'AMS:ASML', ticker_yahoo: 'ASML.AS' })
  })

  it('non deriva ticker dai mercati che non ne espongono uno', () => {
    // Equiduct: stessi titoli in duplice quotazione, il simbolo non identifica
    // una piazza di Google Finance.
    expect(resolveTickerFromCsv('AAPL', 'EQUIDUCT')).toBeNull()
    expect(resolveTickerFromCsv('BTP26', 'MOT')).toBeNull()
  })

  it('non segnala come sconosciuti i mercati noti ma senza ticker', () => {
    // "Non so cosa sia" e "so cosa è, ma il ticker va messo a mano" sono due
    // messaggi diversi per chi legge il banner dell'import.
    expect(isKnownMarket('EQUIDUCT')).toBe(true)
    expect(isKnownMarket('MOT')).toBe(true)
  })
})

describe('parseAmount', () => {
  it('interpreta il formato italiano', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56)
    expect(parseAmount('95,32')).toBe(95.32)
    expect(parseAmount('1.200')).toBe(1200)
    expect(parseAmount('12.540,00 €')).toBe(12540)
  })

  it('interpreta il formato anglosassone', () => {
    expect(parseAmount('1,200.00')).toBe(1200)
    expect(parseAmount('95.32')).toBe(95.32)
  })

  it('gestisce valori negativi e non disponibili', () => {
    expect(parseAmount('-1.234,56')).toBe(-1234.56)
    expect(parseAmount('(1.234,56)')).toBe(-1234.56)
    expect(parseAmount('n/d')).toBeNaN()
    expect(parseAmount('')).toBeNaN()
    expect(parseAmount('-')).toBeNaN()
  })
})

describe('decodeCsvBuffer', () => {
  it('decodifica un export Windows-1252 senza rompere gli accenti', () => {
    // "Quantità" in Windows-1252: 0xE0 al posto della sequenza UTF-8.
    const bytes = Uint8Array.from([0x51, 0x75, 0x61, 0x6e, 0x74, 0x69, 0x74, 0xe0])
    expect(decodeCsvBuffer(bytes.buffer)).toBe('Quantità')
  })

  it('decodifica UTF-8 quando il file è già UTF-8', () => {
    const bytes = new TextEncoder().encode('Quantità;ISIN')
    expect(decodeCsvBuffer(bytes.buffer as ArrayBuffer)).toBe('Quantità;ISIN')
  })

  it('parsa un header Windows-1252 fino alle righe finali', () => {
    const latin1 = Uint8Array.from(
      'Strumento;ISIN;Quantità;Prezzo medio di carico\nVWCE;IE00BK5BQT80;120;95,32\n',
      (c) => c.charCodeAt(0)
    )
    const { rows } = parseFinecoCsv(decodeCsvBuffer(latin1.buffer))
    expect(rows[0].quantity).toBe(120)
  })
})

describe('detectNonCsvFormat', () => {
  it('riconosce un file xlsx', () => {
    const bytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x00])
    expect(detectNonCsvFormat(bytes.buffer)).toMatch(/xlsx/)
  })

  it('riconosce un file vuoto', () => {
    expect(detectNonCsvFormat(new Uint8Array([]).buffer)).toMatch(/vuoto/)
  })

  it('lascia passare un CSV di testo', () => {
    const bytes = new TextEncoder().encode('ISIN;Quantità\n')
    expect(detectNonCsvFormat(bytes.buffer as ArrayBuffer)).toBeNull()
  })
})
