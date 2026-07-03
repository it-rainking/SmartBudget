import { timingSafeEqual } from 'crypto'

// Constant-time comparison for bearer-token secrets (avoids timing side-channels).
export function secretsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
