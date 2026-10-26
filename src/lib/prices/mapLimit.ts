// Come Promise.all su `items.map(fn)`, ma con al massimo `limit` chiamate in
// corso. Il cron prezzi gira come funzione serverless (60 s per richiesta su
// Netlify): in sequenza, qualche ticker lento su Yahoo basta a sforare; tutte
// insieme, Yahoo risponde 429. L'ordine dei risultati segue quello di `items`.
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, worker))
  return results
}
