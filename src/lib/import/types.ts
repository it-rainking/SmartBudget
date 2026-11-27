// Tipi comuni dell'import degli estratti conto (Fineco, Revolut).

export type StatementSource = 'fineco' | 'revolut'

export const STATEMENT_SOURCE_LABELS: Record<StatementSource, string> = {
  fineco: 'Fineco',
  revolut: 'Revolut',
}

/** Movimento letto dal file, prima di qualunque regola. */
export interface RawMovement {
  source: StatementSource
  /** Riga nel file (1-based), per i messaggi. */
  line: number
  date: string // YYYY-MM-DD
  /** Importo con segno: + entrata, − uscita. Commissioni escluse. */
  amount: number
  /** Commissione (Revolut "Costo"), sempre ≥ 0. */
  fee: number
  currency: string
  /** Descrizione mostrata all'utente e salvata. */
  description: string
  /** Tipo movimento della banca (Fineco "Descrizione", Revolut "Tipo"). */
  kind: string
  /** Revolut "Prodotto" (Attuale, Risparmi...). */
  product?: string
  /** Stato della banca (Contabilizzato, COMPLETATO...). */
  state: string
  /** Saldo dopo il movimento, se il file lo riporta (Revolut). */
  balance?: number | null
  /** Data e ora di inizio (Revolut), rende più univoco l'external_id. */
  startedAt?: string
  /** Anomalia rilevata dal parser (es. saldo che non torna): la riga va verificata. */
  warning?: string
}

export type CandidateStatus = 'import' | 'review' | 'skip'
export type CategoryKey = 'investimenti' | 'satispay'

/** Movimento classificato dalle regole, pronto per la revisione. */
export interface StatementCandidate {
  source: StatementSource
  line: number
  external_id: string
  date: string
  type: 'income' | 'expense' | 'saving'
  amount: number // positivo
  description: string
  payment_method: string | null
  currency: string
  status: CandidateStatus
  /** Motivo di scarto o di verifica, leggibile. */
  reason?: string
  categoryKey?: CategoryKey
  isPaypal?: boolean
}

export interface ParsedStatement {
  source: StatementSource
  movements: RawMovement[]
  errors: { location: string; reason: string }[]
  /** Avvisi sul file intero (es. importi corretti perché salvato da Excel). */
  warnings: string[]
  /** Intestatario del conto, se il file lo riporta (Fineco). */
  holder?: string
}
