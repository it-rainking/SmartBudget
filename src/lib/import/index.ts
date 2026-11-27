// Ingresso unico dell'import estratti conto: riconosce la banca dal
// contenuto del file e restituisce i movimenti classificati dalle regole.

import { isFinecoSheet, parseFinecoRows } from './fineco'
import { isRevolutCsv, parseRevolutCsv } from './revolut'
import { classifyMovements } from './rules'
import { readXlsxRows } from './xlsx'
import type { ParsedStatement, StatementCandidate } from './types'

export * from './types'
export { classifyAgainstExisting, isSelected, defaultIncluded } from './dedupe'
export type { ReviewItem, DuplicateDecision, ExistingTransaction } from './dedupe'

export interface StatementResult extends ParsedStatement {
  candidates: StatementCandidate[]
}

const isZip = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b

/**
 * null se il file non è un estratto riconosciuto (il modal usa allora il
 * parser CSV/OFX generico). Lancia un errore se è un Excel non leggibile.
 */
export function parseStatementFile(
  fileName: string,
  bytes: Uint8Array,
  opts: { baseCurrency?: string } = {}
): StatementResult | null {
  let parsed: ParsedStatement | null = null

  if (isZip(bytes) || /\.xlsx$/i.test(fileName)) {
    const rows = readXlsxRows(bytes)
    if (!isFinecoSheet(rows)) {
      throw new Error('File Excel non riconosciuto: al momento è supportato l\'export movimenti Fineco')
    }
    parsed = parseFinecoRows(rows)
  } else if (/\.xls$/i.test(fileName)) {
    throw new Error('Il formato .xls (Excel 97-2003) non è supportato: salva il file come .xlsx')
  } else {
    const text = new TextDecoder('utf-8').decode(bytes)
    if (isRevolutCsv(text)) parsed = parseRevolutCsv(text)
  }

  if (!parsed) return null
  return {
    ...parsed,
    candidates: classifyMovements(parsed.movements, { holder: parsed.holder, baseCurrency: opts.baseCurrency }),
  }
}
