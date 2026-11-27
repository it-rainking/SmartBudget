// Separato da parseFinecoCsv (che importa papaparse) per poterlo usare anche
// nell'import transazioni senza caricare il parser degli investimenti.

/**
 * Fineco esporta in Windows-1252 (non UTF-8): decodificare a occhi chiusi come
 * UTF-8 rompe "Quantità" -> "Quantit�" e l'header non viene più
 * riconosciuto. Si prova UTF-8 e, se compaiono caratteri di sostituzione, si
 * ricade su Windows-1252.
 */
export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)

  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)

  const utf8 = new TextDecoder('utf-8').decode(bytes)
  if (!utf8.includes('�')) return utf8

  try {
    return new TextDecoder('windows-1252').decode(bytes)
  } catch {
    return utf8
  }
}
