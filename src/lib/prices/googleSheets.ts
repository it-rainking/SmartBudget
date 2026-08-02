import { google } from 'googleapis'
import type { PriceProvider, PriceQuote } from './types'

// Layout del Sheet ponte (colonna A = ticker Google Finance, B = prezzo,
// C = prezzo apertura, D = variazione %, E = valuta). Vedi docs/investimenti-setup.md.
const SHEET_RANGE = 'Prezzi!A:E'
// Cella con `=NOW()`, ricalcolata da Google a ogni apertura/refresh del foglio:
// usata per capire se il foglio non viene più aggiornato (es. mai aperto).
const TIMESTAMP_CELL = 'Prezzi!G1'
const STALE_AFTER_MS = 2 * 60 * 60 * 1000 // 2 ore

// Estrae le quote valide da righe grezze del foglio, scartando celle vuote,
// non numeriche o in errore (es. "#N/A" quando GOOGLEFINANCE non risolve il ticker).
export function parseSheetQuotes(rows: string[][]): Map<string, PriceQuote> {
  const quotes = new Map<string, PriceQuote>()
  for (const row of rows) {
    const [ticker, price, , changePct, currency] = row
    if (!ticker || !price) continue
    if (/#N\/A|#REF!|#ERROR!/i.test(price)) continue
    const priceNum = Number(price)
    if (isNaN(priceNum)) continue
    quotes.set(ticker, {
      price: priceNum,
      changePct: changePct && !isNaN(Number(changePct)) ? Number(changePct) : null,
      currency: currency || 'EUR',
    })
  }
  return quotes
}

// Un foglio è considerato stantio se la cella timestamp manca, non è una data
// valida, o è più vecchia di STALE_AFTER_MS.
export function isSheetStale(timestampRaw: string | undefined): boolean {
  if (!timestampRaw) return true
  const ts = new Date(timestampRaw).getTime()
  if (isNaN(ts)) return true
  return Date.now() - ts > STALE_AFTER_MS
}

function decodeServiceAccountKey(): { client_email: string; private_key: string } {
  const b64 = process.env.GOOGLE_SA_KEY_B64
  if (!b64) throw new Error('GOOGLE_SA_KEY_B64 non configurata')
  const json = Buffer.from(b64, 'base64').toString('utf-8')
  return JSON.parse(json)
}

// Legge una volta l'intero Sheet ponte e ritorna un PriceProvider che risponde
// dalla cache in memoria (una sola chiamata Sheets API per intero ciclo cron,
// non una per ticker). Ritorna null per ogni ticker se il foglio è stantio.
export async function createGoogleSheetsProvider(): Promise<PriceProvider> {
  const spreadsheetId = process.env.GSHEET_ID
  if (!spreadsheetId) throw new Error('GSHEET_ID non configurata')

  const { client_email, private_key } = decodeServiceAccountKey()
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })

  const [dataRes, tsRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: SHEET_RANGE }),
    sheets.spreadsheets.values.get({ spreadsheetId, range: TIMESTAMP_CELL }),
  ])

  const stale = isSheetStale(tsRes.data.values?.[0]?.[0])
  const quotes = stale ? new Map<string, PriceQuote>() : parseSheetQuotes((dataRes.data.values ?? []) as string[][])

  return {
    async getQuote(ticker: string) {
      return quotes.get(ticker) ?? null
    },
  }
}
