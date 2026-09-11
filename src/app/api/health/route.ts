import { NextResponse } from 'next/server'

// Commit da cui è stata costruita l'istanza in esecuzione. Vercel e Railway lo
// espongono con nomi diversi; in locale non è impostato.
const COMMIT_SHA =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.RAILWAY_GIT_COMMIT_SHA ??
  process.env.GIT_COMMIT_SHA ??
  null

// GET /api/health
// Health check + identità della build: serve a capire se il deploy in corso è
// allineato al repository, senza dover leggere la dashboard del provider.
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    commit: COMMIT_SHA,
    commit_short: COMMIT_SHA ? COMMIT_SHA.slice(0, 7) : null,
  })
}
