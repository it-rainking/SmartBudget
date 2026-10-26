import { describe, expect, it } from 'vitest'
import { mapLimit } from '@/lib/prices/mapLimit'

describe('mapLimit', () => {
  it('mantiene l\'ordine degli input anche se le chiamate finiscono in disordine', async () => {
    const out = await mapLimit([30, 10, 20], 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms))
      return ms
    })
    expect(out).toEqual([30, 10, 20])
  })

  it('non supera il numero di chiamate in parallelo richiesto', async () => {
    let running = 0
    let peak = 0
    await mapLimit(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 5))
      running--
    })
    expect(peak).toBe(3)
  })

  it('con lista vuota ritorna una lista vuota', async () => {
    expect(await mapLimit([], 4, async () => 1)).toEqual([])
  })
})
