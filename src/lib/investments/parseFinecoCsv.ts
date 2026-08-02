import Papa from 'papaparse'

export interface ParsedHoldingRow {
  isin: string
  name: string
  quantity: number
  avg_cost: number
}

const ISIN_KEYS = ['isin']
const QUANTITY_KEYS = ['quantita', 'quantity']
const AVG_COST_KEYS = ['prezzo_medio_di_carico', 'prezzo_medio_carico', 'prezzo_carico', 'pmc', 'prezzo_medio']
const NAME_KEYS = ['strumento', 'nome', 'descrizione', 'name']

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function findColumn(fields: string[], candidates: string[]): string | undefined {
  return candidates.find((c) => fields.includes(c))
}

// Formato numerico italiano usato da Fineco: '.' migliaia, ',' decimali (es. "1.234,56").
function parseItalianNumber(raw: string): number {
  const s = raw.trim().replace(/[€\s]/g, '')
  if (!s) return NaN
  return parseFloat(s.replace(/\./g, '').replace(',', '.'))
}

// Parsa il CSV export Fineco (Patrimonio -> Portafoglio titoli). Separatore
// ';' o ',' auto-rilevato da papaparse, decimali con virgola. Le colonne non
// sono hardcodate per indice: l'header viene normalizzato (trim/lowercase/
// senza accenti) e matchato per nome. Fallisce con un errore chiaro se
// mancano ISIN, Quantità o Prezzo medio di carico (richiesti dallo schema
// holdings). Le righe con valori non parsabili vengono scartate e riportate
// come warning, senza interrompere l'import dell'intero file.
export function parseFinecoCsv(csvText: string): { rows: ParsedHoldingRow[]; warnings: string[] } {
  const parsed = Papa.parse<Record<string, string>>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
  })

  const fields = parsed.meta.fields ?? []
  const isinKey = findColumn(fields, ISIN_KEYS)
  const quantityKey = findColumn(fields, QUANTITY_KEYS)
  const avgCostKey = findColumn(fields, AVG_COST_KEYS)
  const nameKey = findColumn(fields, NAME_KEYS)

  const missing: string[] = []
  if (!isinKey) missing.push('ISIN')
  if (!quantityKey) missing.push('Quantità')
  if (!avgCostKey) missing.push('Prezzo medio di carico')
  if (missing.length > 0) {
    throw new Error(`Colonne mancanti nel CSV: ${missing.join(', ')}. Verifica di aver esportato il portafoglio titoli da Fineco.`)
  }

  const rows: ParsedHoldingRow[] = []
  const warnings: string[] = []

  parsed.data.forEach((row, index) => {
    const isin = row[isinKey!]?.trim()
    const quantity = parseItalianNumber(row[quantityKey!] ?? '')
    const avgCost = parseItalianNumber(row[avgCostKey!] ?? '')
    const name = nameKey ? row[nameKey]?.trim() : ''
    const rowNum = index + 2 // +1 header, +1 1-based

    if (!isin) {
      warnings.push(`Riga ${rowNum}: ISIN mancante, riga scartata.`)
      return
    }
    if (isNaN(quantity)) {
      warnings.push(`Riga ${rowNum} (${isin}): quantità non valida, riga scartata.`)
      return
    }
    if (isNaN(avgCost)) {
      warnings.push(`Riga ${rowNum} (${isin}): prezzo medio di carico non valido, riga scartata.`)
      return
    }

    rows.push({ isin, name: name || isin, quantity, avg_cost: avgCost })
  })

  return { rows, warnings }
}
