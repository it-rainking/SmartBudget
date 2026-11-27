// Utilità di parsing condivise dai parser degli estratti conto.

/**
 * Importo testuale in formato europeo (1.234,56) o anglosassone (1,234.56).
 * NaN se non numerico.
 */
export function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\s|€/g, '')
  if (!s) return NaN
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return parseFloat(s.replace(/,/g, ''))
  if (/^[-+]?\d+,\d+$/.test(s)) return parseFloat(s.replace(',', '.'))
  if (/^[-+]?\d+(\.\d+)?$/.test(s)) return parseFloat(s)
  return NaN
}

function validDate(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Data con eventuale orario: "YYYY-MM-DD[ HH:mm[:ss]]", "DD/MM/YYYY[ ...]",
 * "DD/MM/YY[ ...]" (anno a due cifre = 20YY). null se non valida.
 */
export function parseDayFirstDate(raw: string): string | null {
  const s = raw.trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return validDate(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?!\d)/)
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    return validDate(y, +m[2], +m[1])
  }
  return null
}

/** Divide una riga CSV rispettando le virgolette. */
export function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++ }
      else quoted = !quoted
    } else if (ch === sep && !quoted) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map(c => c.trim())
}
