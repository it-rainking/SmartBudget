import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { buildFxTable, fxRate, normalizeCurrency } from '@/lib/prices/fx'
import type { Database } from '@/types/database'
import type { AssetClassBreakdown, InvestmentPosition, InvestmentSummary } from '@/types/investments'

// GET /api/investments/summary
// Riepilogo portafoglio: get_investment_summary() fa il join holdings <->
// assets <-> ultimo price_snapshot in una sola query; qui si calcolano
// market_value/P&L/pesi e i badge di provenienza (positions_as_of / prices_as_of).
//
// Valute: ogni posizione mantiene i valori nella propria valuta e riceve in più
// i valori convertiti nella valuta di riferimento dell'utente (settings.currency),
// usando i cambi aggiornati dal cron in `fx_rates`. Totali, pesi e ripartizione
// per classe sono calcolati sui valori convertiti, così sommano importi omogenei.
export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const [summaryRes, settingsRes, fxRes] = await Promise.all([
    supabase.rpc('get_investment_summary', { p_user_id: user.id }),
    supabase.from('settings').select('currency').eq('user_id', user.id).maybeSingle(),
    supabase.from('fx_rates').select('base, quote, rate, fetched_at'),
  ])
  if (summaryRes.error) return NextResponse.json({ error: summaryRes.error.message }, { status: 500 })

  const rawRows = summaryRes.data ?? []
  const baseCurrency = normalizeCurrency(settingsRes.data?.currency)
  const fxRows = fxRes.data ?? []
  const fxTable = buildFxTable(fxRows)

  // Controvalore = quantità * prezzo / price_divisor. Il divisore vale 1 per
  // azioni ed ETF e 100 per i titoli quotati in percentuale del nominale
  // (obbligazioni), dove la "quantità" Fineco è il valore nominale.
  const valueOf = (price: number, quantity: number, divisor: number) => (price * quantity) / divisor

  const positions: InvestmentPosition[] = rawRows.map((r) => {
    const quantity = Number(r.quantity)
    const avgCost = Number(r.avg_cost)
    const priceDivisor = Number(r.price_divisor) || 1
    const cost = valueOf(avgCost, quantity, priceDivisor)
    // Precedenza: prezzo di mercato, poi quello inserito a mano, infine il
    // costo di carico. Lo snapshot vince sul manuale perché è automatico e
    // fresco: un prezzo scritto mesi fa e dimenticato non deve coprire il dato
    // reale quando questo esiste. Valorizzare al costo, in ultima istanza, evita
    // di far sparire la posizione dal totale mostrando una perdita del 100% che
    // non è mai avvenuta.
    const manualPrice = r.manual_price === null ? null : Number(r.manual_price)
    const effectivePrice = r.last_price ?? manualPrice
    const priceOrigin: InvestmentPosition['price_origin'] =
      r.last_price !== null ? 'market' : manualPrice !== null ? 'manual' : 'cost'
    const marketValue = effectivePrice === null ? cost : valueOf(effectivePrice, quantity, priceDivisor)
    const pnlAbs = marketValue - cost
    const currency = normalizeCurrency(r.currency)
    // Cambio verso la valuta di riferimento: 1 se la posizione è già in quella
    // valuta, null se il cron non ha ancora scaricato la coppia. Null non viene
    // sostituito con 1: sommare dollari come fossero euro falsa il totale.
    const rate = fxRate(fxTable, currency, baseCurrency)
    return {
      fx_rate: rate,
      market_value_base: rate === null ? null : marketValue * rate,
      cost_base: rate === null ? null : cost * rate,
      pnl_abs_base: rate === null ? null : pnlAbs * rate,
      price_origin: priceOrigin,
      manual_price: manualPrice,
      manual_priced_at: r.manual_priced_at,
      price_divisor: priceDivisor,
      holding_id: r.holding_id,
      asset_id: r.asset_id,
      isin: r.isin,
      ticker_gf: r.ticker_gf,
      ticker_yahoo: r.ticker_yahoo,
      name: r.name,
      asset_class: r.asset_class as InvestmentPosition['asset_class'],
      currency,
      quantity,
      avg_cost: avgCost,
      imported_at: r.imported_at,
      last_price: r.last_price,
      change_pct: r.change_pct,
      price_source: r.price_source as InvestmentPosition['price_source'],
      fetched_at: r.fetched_at,
      market_value: marketValue,
      pnl_abs: pnlAbs,
      pnl_pct: cost > 0 ? (pnlAbs / cost) * 100 : 0,
      weight_pct: 0,
    }
  })

  // I totali sommano solo i valori convertiti: una posizione senza cambio resta
  // fuori (e viene dichiarata in unconverted_currencies) invece di inquinare la
  // somma con una valuta diversa.
  const converted = positions.filter((p) => p.market_value_base !== null)
  const totalMarketValue = converted.reduce((sum, p) => sum + p.market_value_base!, 0)
  for (const p of positions) {
    p.weight_pct =
      totalMarketValue > 0 && p.market_value_base !== null ? (p.market_value_base / totalMarketValue) * 100 : 0
  }

  const totalCost = converted.reduce((sum, p) => sum + p.cost_base!, 0)
  const totalPnlAbs = totalMarketValue - totalCost

  const byAssetClassMap = new Map<string, number>()
  for (const p of converted) {
    byAssetClassMap.set(p.asset_class, (byAssetClassMap.get(p.asset_class) ?? 0) + p.market_value_base!)
  }
  const by_asset_class: AssetClassBreakdown[] = [...byAssetClassMap.entries()].map(([asset_class, marketValue]) => ({
    asset_class: asset_class as AssetClassBreakdown['asset_class'],
    market_value: marketValue,
    weight_pct: totalMarketValue > 0 ? (marketValue / totalMarketValue) * 100 : 0,
  }))

  const positionsAsOf = positions.reduce<string | null>(
    (max, p) => (!max || p.imported_at > max ? p.imported_at : max),
    null
  )
  const pricesAsOf = positions.reduce<string | null>(
    (max, p) => (p.fetched_at && (!max || p.fetched_at > max) ? p.fetched_at : max),
    null
  )

  // Il cambio più vecchio fra quelli disponibili: è il dato che invecchia per
  // primo, quindi è quello onesto da mostrare come "aggiornato al".
  const usedCurrencies = new Set(positions.map((p) => p.currency))
  const fxAsOf = fxRows
    .filter((f) => usedCurrencies.has(normalizeCurrency(f.base)) && normalizeCurrency(f.quote) === baseCurrency)
    .reduce<string | null>((min, f) => (!min || f.fetched_at < min ? f.fetched_at : min), null)

  const summary: InvestmentSummary = {
    positions,
    by_asset_class,
    total_market_value: totalMarketValue,
    total_cost: totalCost,
    total_pnl_abs: totalPnlAbs,
    total_pnl_pct: totalCost > 0 ? (totalPnlAbs / totalCost) * 100 : 0,
    positions_as_of: positionsAsOf,
    prices_as_of: pricesAsOf,
    currencies: [...new Set(positions.map((p) => p.currency))].sort(),
    base_currency: baseCurrency,
    unconverted_currencies: [
      ...new Set(positions.filter((p) => p.fx_rate === null).map((p) => p.currency)),
    ].sort(),
    fx_as_of: fxAsOf,
  }

  return NextResponse.json(summary)
}
