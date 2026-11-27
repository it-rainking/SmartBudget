// Regole di classificazione dei movimenti degli estratti conto.
// Ogni movimento esce con uno stato:
// - import: entra nell'import (selezionato);
// - review: entra nell'import ma con un avviso da verificare;
// - skip: scartato e mostrato con il motivo, recuperabile a mano.
// Le regole lavorano su testo compattato (maiuscolo, senza spazi) perché
// Fineco spezza le descrizioni lunghe con spazi a caso ("DEUTSC HE BANK").

import type { RawMovement, StatementCandidate } from './types'

/** Hash stringa deterministico (cyrb53), 53 bit in esadecimale. */
export function hashString(str: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}

const compact = (s: string) =>
  s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '')

function nameTokens(name: string): string[] {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z ]+/g, ' ')
    .split(' ')
    .filter(t => t.length >= 2)
}

/** true se il segmento dopo l'etichetta (es. "Ben:") contiene il nome dell'intestatario. */
function segmentHasHolder(description: string, labels: RegExp, holder: string | undefined): boolean {
  if (!holder) return false
  const tokens = nameTokens(holder)
  if (tokens.length === 0) return false
  const m = description.match(labels)
  if (!m || m.index === undefined) return false
  // Il segmento finisce alla prossima etichetta: in "Ord: ACME Ben: MARIO
  // ROSSI" (stipendio) l'ordinante è ACME, non l'intestatario.
  const rest = description.slice(m.index + m[0].length, m.index + m[0].length + 60)
  const end = rest.search(/\b(Ben|Beneficiario|Ord|Ins|Dt|Banca|Iban|Cau|Causale|Info-Cli|Data)\b/i)
  const segment = compact(end === -1 ? rest : rest.slice(0, end))
  return tokens.every(t => segment.includes(t))
}

function paymentMethod(m: RawMovement, isPaypal: boolean): string | null {
  if (isPaypal) return 'PayPal'
  const k = m.kind.toLowerCase()
  if (k.includes('prelievo') || k.includes('prelevamento')) return 'Contanti'
  if (k.includes('carta') || k.includes('card') || k.includes('visa') || k.includes('bancomat')) return 'Carta'
  if (k.includes('bonifico') || k.includes('trasferimento') || k.includes('transfer')) return 'Bonifico'
  return null
}

const COMPLETED_STATES = new Set(['', 'CONTABILIZZATO', 'COMPLETATO', 'COMPLETED'])

export interface ClassifyOptions {
  /** Intestatario del conto, per riconoscere i giroconti verso sé stessi. */
  holder?: string
  /** Valuta dell'utente: i movimenti in altre valute vanno verificati. */
  baseCurrency?: string
}

export function classifyMovements(movements: RawMovement[], opts: ClassifyOptions = {}): StatementCandidate[] {
  const base = (opts.baseCurrency || 'EUR').toUpperCase()
  const seen = new Map<string, number>()

  return movements.map(m => {
    const desc = compact(m.description)
    const kind = compact(m.kind)
    const all = `${kind}|${desc}`
    const isPaypal = all.includes('PAYPAL')

    // Identità stabile del movimento: due righe identiche nello stesso file
    // (due caffè uguali lo stesso giorno) si distinguono per occorrenza.
    const cents = Math.round(m.amount * 100)
    const baseKey = `${m.source}|${m.date}|${cents}|${desc}|${m.startedAt ?? ''}`
    const occurrence = seen.get(baseKey) ?? 0
    seen.set(baseKey, occurrence + 1)

    const net = m.amount > 0 ? m.amount - m.fee : Math.abs(m.amount) + m.fee
    const c: StatementCandidate = {
      source: m.source,
      line: m.line,
      external_id: `${m.source}:${hashString(`${baseKey}|${occurrence}`)}`,
      date: m.date,
      type: m.amount > 0 ? 'income' : 'expense',
      amount: Math.round(net * 100) / 100,
      description: m.description || m.kind,
      payment_method: paymentMethod(m, isPaypal),
      currency: m.currency,
      status: 'import',
      ...(isPaypal ? { isPaypal: true } : {}),
    }
    const skip = (reason: string) => ({ ...c, status: 'skip' as const, reason })
    const review = (reason: string, extra: Partial<StatementCandidate> = {}) => ({ ...c, ...extra, status: 'review' as const, reason })

    if (!COMPLETED_STATES.has(compact(m.state))) {
      return skip(m.source === 'fineco' ? 'Movimento non ancora contabilizzato' : `Movimento non completato (${m.state})`)
    }

    // ── Patrimonio, non spesa ──
    if (all.includes('COMPRAVENDITATITOLI')) return skip('Compravendita titoli: gestita in Investimenti')
    if (desc.includes('ROBOPORTFOLIO')) {
      return m.amount < 0
        ? { ...c, type: 'saving' as const, categoryKey: 'investimenti' as const, reason: 'Versamento nel portafoglio robo: risparmio' }
        : skip('Rientro dal portafoglio robo: non è un\'entrata')
    }
    if (desc.includes('CRYPTO') && m.amount < 0 && (all.includes('BONIFICO') || desc.includes('GIROCONTO'))) {
      return { ...c, type: 'saving' as const, categoryKey: 'investimenti' as const, reason: 'Versamento su crypto: risparmio' }
    }

    // ── Addebito mensile della carta di credito (le spese arrivano dal suo estratto) ──
    if (
      (desc.includes('ESTRATTOCONTO') && (desc.includes('CARTA') || desc.includes('NEXI') || desc.includes('AMEX') || desc.includes('AMERICANEXPRESS'))) ||
      desc.includes('ADDEBITOCARTADICREDITO') || desc.includes('SALDOE/CCARTA')
    ) {
      return skip('Addebito mensile della carta di credito')
    }

    // ── Trasferimenti tra conti propri ──
    if (m.source === 'revolut') {
      if (/^(RICARICA|TOPUP|TOP-UP)$/.test(kind)) return skip('Ricarica da un tuo conto')
      if (/^(CAMBIO|EXCHANGE)$/.test(kind)) return skip('Cambio valuta interno')
      const product = compact(m.product ?? '')
      if (product && product !== 'ATTUALE' && product !== 'CURRENT') return skip('Movimento nel salvadanaio Revolut')
      if (/POCKET|SALVADANAIO|VAULT|SAVINGS/.test(desc)) return skip('Trasferimento verso il salvadanaio Revolut')
    }
    if (desc.includes('GIROCONTO')) return skip('Giroconto tra tuoi conti')
    if (
      (m.amount < 0 && segmentHasHolder(m.description, /\b(Beneficiario|Ben):/i, opts.holder)) ||
      (m.amount > 0 && segmentHasHolder(m.description, /\bOrd:/i, opts.holder))
    ) {
      return skip('Bonifico tra tuoi conti')
    }

    // ── Rendimenti degli investimenti ──
    if (/RITENUTA|RITEN\.|^RIT\./.test(kind) || desc.startsWith('RIT.')) {
      return { ...c, type: 'expense' as const, categoryKey: 'investimenti' as const }
    }
    if (kind.includes('DIVIDEND') || kind.includes('INTERESSI') || desc.startsWith('DIV.')) {
      return { ...c, type: m.amount > 0 ? ('income' as const) : ('expense' as const), categoryKey: 'investimenti' as const }
    }

    // ── Da verificare ──
    if (desc.includes('SATISPAY')) {
      return review('Ricarica Satispay: ripartisci la spesa se serve', { categoryKey: 'satispay' })
    }
    if (m.warning) return review(m.warning)
    if (m.currency.toUpperCase() !== base) return review(`Importo in ${m.currency}: verifica il cambio`)
    // PayPal: confrontato con le rate già registrate in una fase successiva
    // (classifyAgainstExisting), qui resta da verificare.
    if (isPaypal) return review('Addebito PayPal senza rata corrispondente: verifica')

    return c
  })
}
