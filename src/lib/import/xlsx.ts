// Lettore minimo di file .xlsx (Office Open XML): estrae le celle del primo
// foglio come matrice di valori. Basta per gli estratti conto bancari (testo,
// numeri, date seriali), senza formule, stili o fogli multipli.
// Usa solo fflate per decomprimere lo zip: niente DOM, quindi gira anche
// nei test (ambiente node) e nel browser.

import { unzipSync, strFromU8 } from 'fflate'

export type XlsxCell = string | number | boolean | null

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
}

/** Testo di un nodo <si> o <is>: concatena tutti i <t>, anche nei run <r>. */
function textOf(xml: string): string {
  let out = ''
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += m[1]
  return decodeXml(out)
}

/** "AB12" → indice colonna 0-based (A=0, Z=25, AA=26). */
function columnIndex(ref: string): number {
  const letters = ref.replace(/\d+$/, '')
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function firstSheetPath(files: Record<string, Uint8Array>): string {
  const wb = files['xl/workbook.xml']
  const rels = files['xl/_rels/workbook.xml.rels']
  if (wb && rels) {
    const sheet = strFromU8(wb).match(/<sheet\b[^>]*\br:id="([^"]+)"/)
    if (sheet) {
      const relXml = strFromU8(rels)
      for (const m of relXml.matchAll(/<Relationship\b[^>]*>/g)) {
        const tag = m[0]
        if (tag.includes(`Id="${sheet[1]}"`)) {
          const target = tag.match(/Target="([^"]+)"/)?.[1]
          if (target) return target.startsWith('/') ? target.slice(1) : `xl/${target}`
        }
      }
    }
  }
  return 'xl/worksheets/sheet1.xml'
}

/** Righe del primo foglio. Le celle vuote sono null; le righe mancanti sono []. */
export function readXlsxRows(data: Uint8Array): XlsxCell[][] {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(data)
  } catch {
    throw new Error('Il file non è un .xlsx valido')
  }

  const shared: string[] = []
  const sst = files['xl/sharedStrings.xml']
  if (sst) {
    for (const m of strFromU8(sst).matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) shared.push(m[1] ? textOf(m[1]) : '')
  }

  const sheetFile = files[firstSheetPath(files)]
  if (!sheetFile) throw new Error('Foglio di lavoro non trovato nel file .xlsx')
  const xml = strFromU8(sheetFile)

  const rows: XlsxCell[][] = []
  for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
    const attrs = rm[1] ?? rm[3] ?? ''
    const rowNum = Number(attrs.match(/\br="(\d+)"/)?.[1] ?? rows.length + 1)
    const cells: XlsxCell[] = []
    const body = rm[2] ?? ''
    for (const cm of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const cAttrs = cm[1]
      const inner = cm[2] ?? ''
      const ref = cAttrs.match(/\br="([A-Z]+\d+)"/)?.[1]
      const col = ref ? columnIndex(ref) : cells.length
      const t = cAttrs.match(/\bt="([^"]+)"/)?.[1]
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      let value: XlsxCell = null
      if (t === 's') value = v !== undefined ? (shared[Number(v)] ?? '') : null
      else if (t === 'inlineStr') value = textOf(inner)
      else if (t === 'str' || t === 'e' || t === 'd') value = v !== undefined ? decodeXml(v) : null
      else if (t === 'b') value = v === '1'
      else if (v !== undefined && v !== '') value = Number(v)
      while (cells.length < col) cells.push(null)
      cells[col] = value
    }
    while (rows.length < rowNum - 1) rows.push([])
    rows[rowNum - 1] = cells
  }
  return rows
}

/** Numero seriale Excel (sistema 1900) → "YYYY-MM-DD". */
export function excelSerialToDate(serial: number): string {
  const ms = Math.round((serial - 25569) * 86_400_000)
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
