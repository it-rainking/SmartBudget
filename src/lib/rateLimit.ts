// Best-effort per-instance rate limiter (in-memory token bucket).
// Not shared across serverless instances/regions, but bounds abuse from a
// single authenticated session against cost-bearing endpoints (AI calls,
// outbound email/Telegram sends).
const buckets = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = buckets.get(key)

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= limit) return false

  entry.count++
  return true
}
