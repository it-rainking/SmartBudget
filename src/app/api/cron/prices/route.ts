import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { secretsMatch } from '@/lib/security'
import { createGoogleSheetsProvider } from '@/lib/prices/googleSheets'
import { resolveAssetQuote } from '@/lib/prices/resolveQuote'
import type { PriceProvider } from '@/lib/prices/types'
import { yahooProvider } from '@/lib/prices/yahoo'
import type { Database } from '@/types/database'

// POST /api/cron/prices
// Job schedulato (vedi vercel.json): per ogni asset con un ticker Google
// Finance risolto, legge il prezzo dal Sheet ponte; se la cella è #N/A o il
// foglio è stantio (>2h), usa yahoo-finance2 come fallback. Scrive con la
// service role key (bypassa RLS), stesso pattern di /api/notifications/process.
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!cronSecret || !authHeader || !secretsMatch(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: allAssets } = await supabase
    .from('assets')
    .select('id, ticker_gf, ticker_yahoo')

  // Basta uno dei due ticker: un asset con il solo ticker Yahoo (ticker dedotto
  // dal CSV, o mercato non coperto dal Sheet ponte) deve comunque ricevere il
  // prezzo dal fallback.
  const assets = (allAssets ?? []).filter((a) => a.ticker_gf || a.ticker_yahoo)

  if (!assets.length) return NextResponse.json({ ok: true, updated: 0 })

  let sheetsProvider: PriceProvider | null = null
  try {
    sheetsProvider = await createGoogleSheetsProvider()
  } catch {
    // Sheet ponte non configurato (env mancanti) o Sheets API non raggiungibile:
    // si prosegue con il solo fallback Yahoo per tutti gli asset.
    sheetsProvider = null
  }

  const snapshots: Database['public']['Tables']['price_snapshots']['Insert'][] = []
  for (const asset of assets) {
    const quote = await resolveAssetQuote(asset.ticker_gf, asset.ticker_yahoo, sheetsProvider, yahooProvider)
    if (!quote) continue
    snapshots.push({
      asset_id: asset.id,
      price: quote.price,
      change_pct: quote.changePct,
      currency: quote.currency,
      source: quote.source,
    })
  }

  if (snapshots.length > 0) {
    const { error } = await supabase.from('price_snapshots').insert(snapshots)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: snapshots.length, total: assets.length })
}
