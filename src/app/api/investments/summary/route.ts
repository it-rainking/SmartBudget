import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { Database } from '@/types/database'
import type { AssetClassBreakdown, InvestmentPosition, InvestmentSummary } from '@/types/investments'

// GET /api/investments/summary
// Riepilogo portafoglio: get_investment_summary() fa il join holdings <->
// assets <-> ultimo price_snapshot in una sola query; qui si calcolano
// market_value/P&L/pesi e i badge di provenienza (positions_as_of / prices_as_of).
export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { data: rows, error } = await supabase.rpc('get_investment_summary', { p_user_id: user.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rawRows = rows ?? []

  const totalMarketValue = rawRows.reduce((sum, r) => sum + (r.last_price ?? 0) * Number(r.quantity), 0)

  const positions: InvestmentPosition[] = rawRows.map((r) => {
    const quantity = Number(r.quantity)
    const avgCost = Number(r.avg_cost)
    const cost = quantity * avgCost
    const marketValue = r.last_price !== null ? r.last_price * quantity : 0
    const pnlAbs = marketValue - cost
    return {
      holding_id: r.holding_id,
      asset_id: r.asset_id,
      isin: r.isin,
      ticker_gf: r.ticker_gf,
      ticker_yahoo: r.ticker_yahoo,
      name: r.name,
      asset_class: r.asset_class as InvestmentPosition['asset_class'],
      currency: r.currency,
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
      weight_pct: totalMarketValue > 0 ? (marketValue / totalMarketValue) * 100 : 0,
    }
  })

  const totalCost = positions.reduce((sum, p) => sum + p.quantity * p.avg_cost, 0)
  const totalPnlAbs = totalMarketValue - totalCost

  const byAssetClassMap = new Map<string, number>()
  for (const p of positions) {
    byAssetClassMap.set(p.asset_class, (byAssetClassMap.get(p.asset_class) ?? 0) + p.market_value)
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

  const summary: InvestmentSummary = {
    positions,
    by_asset_class,
    total_market_value: totalMarketValue,
    total_cost: totalCost,
    total_pnl_abs: totalPnlAbs,
    total_pnl_pct: totalCost > 0 ? (totalPnlAbs / totalCost) * 100 : 0,
    positions_as_of: positionsAsOf,
    prices_as_of: pricesAsOf,
  }

  return NextResponse.json(summary)
}
