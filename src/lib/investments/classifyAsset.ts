import { isFundLike } from './parseFinecoCsv'
import type { AssetClass } from '@/types/investments'

// Marcatori di un ETF/fondo obbligazionario nel nome del prodotto: la colonna
// "Strumento" dice solo "ETF" e non basta a distinguerlo da un azionario.
const BOND_FUND_NAME_RE = /\bbond\b|\bbonds\b|\bgovt\b|\bgovernment\b|\bgovies\b|\btreasury\b|\bcorp\b|\bcorporate\b|\baggregate\b|\bhigh yield\b|\bobbligazionar/i

/**
 * Classe dedotta dal CSV quando il lookup non dice nulla.
 *
 * L'ordine conta: un ETF che ha "Govt Bond" nel nome è un ETF obbligazionario
 * (`etf_bond`), non un titolo di Stato (`bond`) — quello che li distingue è che
 * il primo non è quotato in percentuale del nominale.
 */
export function classifyFromCsv(
  instrumentType: string | undefined,
  name: string | undefined,
  percentQuoted: boolean
): AssetClass | null {
  if (percentQuoted) return 'bond'

  const haystack = [instrumentType, name].filter(Boolean).join(' ')
  if (isFundLike(haystack)) {
    return BOND_FUND_NAME_RE.test(haystack) ? 'etf_bond' : 'etf_equity'
  }

  const t = instrumentType?.toLowerCase() ?? ''
  if (t.includes('azion') || t.includes('stock') || t.includes('equity')) return 'stock'
  return null
}
