// Supabase (PostgREST) restituisce al massimo 1000 righe per richiesta: oltre,
// il resto viene troncato senza errore. Qui si leggono tutte le pagine.
// La query costruita da `page` deve avere un ordinamento stabile (es. per id),
// altrimenti due pagine possono sovrapporsi o saltare righe.
export const SUPABASE_PAGE_SIZE = 1000

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PageResult<T>,
  maxRows = Infinity
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; from < maxRows; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await page(from, from + SUPABASE_PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if ((data?.length ?? 0) < SUPABASE_PAGE_SIZE) break
  }
  return rows
}
