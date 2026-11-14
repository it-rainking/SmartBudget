import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PENSION_PARAMS, alternativeLine, comparisonPeriod, covipIscFor, covipReturn, covipValue,
  linesFor, normalizeParams, openFundTableRows, parseNumberInput, project, simulate, userReturn,
  type PensionParams,
} from '@/lib/pension/compare'

const params = (o: Partial<PensionParams>): PensionParams => ({ ...DEFAULT_PENSION_PARAMS, ...o })

describe('parseNumberInput', () => {
  it('accetta virgola, punto, migliaia, € e %', () => {
    expect(parseNumberInput('4,8')).toBe(4.8)
    expect(parseNumberInput('4.8')).toBe(4.8)
    expect(parseNumberInput('60.000')).toBe(60000)
    expect(parseNumberInput('1.234,56 €')).toBe(1234.56)
    expect(parseNumberInput(' 2 % ')).toBe(2)
    expect(parseNumberInput('-0,5')).toBe(-0.5)
  })
  it('vuoto = null, testo = undefined', () => {
    expect(parseNumberInput('  ')).toBeNull()
    expect(parseNumberInput('abc')).toBeUndefined()
  })
})

describe('normalizeParams', () => {
  it('riempie i campi mancanti e scarta valori non validi', () => {
    const p = normalizeParams({ cat: 'XYZ', r10: '4', ral: 50000, porta: 'si', fondo: '  ' })
    expect(p.cat).toBe('AZN')
    expect(p.r10).toBeNull()
    expect(p.ral).toBe(50000)
    expect(p.porta).toBe(true)
    expect(p.fondo).toBeNull()
    expect(p.anni).toBe(20)
  })
  it('null esplicito resta null anche dove il default ha un valore', () => {
    expect(normalizeParams({ pct_tfr: null }).pct_tfr).toBeNull()
  })
  it('input non oggetto = default', () => {
    expect(normalizeParams(null)).toEqual(DEFAULT_PENSION_PARAMS)
  })
})

describe('periodo e rendimento utente', () => {
  it('preferisce il dato a 10 anni, ripiega sul 5', () => {
    expect(comparisonPeriod(params({ r10: 4, r5: 5 }))).toBe(10)
    expect(userReturn(params({ r10: 4, r5: 5 }))).toBe(4)
    expect(comparisonPeriod(params({ r5: 5 }))).toBe(5)
    expect(userReturn(params({ r5: 5 }))).toBe(5)
    expect(userReturn(params({}))).toBeNull()
  })
})

describe('dati COVIP', () => {
  it('trova medie e ISC; i due obbligazionari condividono l\'ISC', () => {
    expect(covipValue(covipReturn('FPA', 'AZN'), 10)).toBeTypeOf('number')
    expect(covipIscFor('OBB_PURO')?.comparto).toBe('OBB')
    expect(covipIscFor('OBB_MISTO')?.comparto).toBe('OBB')
    expect(covipValue(null, 10)).toBeNull()
  })
  it('linee ordinate per rendimento decrescente e filtrate per periodo', () => {
    const l = linesFor('AZN', 10)
    expect(l.length).toBeGreaterThan(0)
    expect(l.every(x => x.categoria === 'AZN' && x.periodo === 10)).toBe(true)
    for (let i = 1; i < l.length; i++) expect(l[i - 1].rend).toBeGreaterThanOrEqual(l[i].rend)
  })
})

describe('alternativeLine', () => {
  it('ignora una scelta di un\'altra categoria', () => {
    expect(alternativeLine(params({ cat: 'GAR', alt: 'allianz-insieme-azionaria' }))?.categoria).toBe('GAR')
  })
  it('rispetta la scelta della stessa categoria', () => {
    const any = linesFor('BIL', null).at(-1)!
    expect(alternativeLine(params({ cat: 'BIL', alt: any.id }))?.id).toBe(any.id)
  })
})

describe('project', () => {
  it('versamento a fine anno su capitale rivalutato', () => {
    const p = project(1000, 100, 10, 2)
    expect(p).toHaveLength(3)
    expect(p[1]).toBeCloseTo(1200, 9)
    expect(p[2]).toBeCloseTo(1420, 9)
  })
})

// Valori di riferimento letti dallo strumento HTML originale (FP.sim())
// con gli stessi parametri: la riscrittura deve dare gli stessi risultati.
describe('simulate: parità con lo strumento originale', () => {
  const cases: { p: Partial<PensionParams>; alt: string; cs: number; cw: number; stay: number; sw: number; be: number }[] = [
    { p: { cat: 'AZN', r10: 4.8, ral: 60000, pct_lav: 1.2, pct_dat: 2, pct_tfr: 100, anni: 20, montante: 45000, porta: true },
      alt: 'allianz-insieme-azionaria', cs: 6066, cw: 6066, stay: 311321.54728835454, sw: 452552.3126342128, be: 4.8 },
    { p: { cat: 'BIL', r5: 3.1, ral: 35000, pct_lav: 1, pct_dat: 1.5, pct_tfr: 50, anni: 30, porta: false },
      alt: 'arca-previdenza-alta-crescita-sostenibile', cs: 2084.25, cw: 1559.25, stay: 100781.1362095985, sw: 102007.88114296967, be: 4.839311125814671 },
    { p: { cat: 'GAR', r10: 0.5, ral: 28000, pct_lav: 0, pct_dat: 0, pct_tfr: 100, anni: 10, montante: 0, alt: 'allianz-insieme-azionaria' },
      alt: 'credem-destinazione-futuro-prudente-garantito', cs: 1934.8, cw: 1934.8, stay: 19789.185494504334, sw: 20150.69967759202, be: 0.5 },
    { p: { cat: 'OBB_PURO', r10: -0.5, ral: 40000, pct_lav: 2, pct_dat: 2, pct_tfr: 100, anni: 5, montante: 10000 },
      alt: 'sella-eurorisparmio-obbligazionario-garantito', cs: 4364, cw: 4364, stay: 31355.37580644625, sw: 32578.375554842627, be: -0.5 },
    { p: { cat: 'AZN', r10: 20, ral: 30000, pct_lav: 1, pct_dat: 3, pct_tfr: 100, anni: 25, porta: false },
      alt: 'allianz-insieme-azionaria', cs: 3273, cw: 2373, stay: 1544794.0853801884, sw: 160844.93725435456, be: 22.000312027524934 },
  ]

  it.each(cases)('$alt', ({ p, alt, cs, cw, stay, sw, be }) => {
    const s = simulate(params(p))!
    expect(s.alt.id).toBe(alt)
    expect(s.contributionStay).toBeCloseTo(cs, 6)
    expect(s.contributionSwitch).toBeCloseTo(cw, 6)
    expect(s.stay[s.years]).toBeCloseTo(stay, 4)
    expect(s.switched[s.years]).toBeCloseTo(sw, 4)
    expect(s.breakeven).toBeCloseTo(be, 6)
    expect(s.breakevenReached).toBe(true)
  })

  it('null con dati insufficienti o orizzonte fuori scala', () => {
    expect(simulate(params({ r10: 4 }))).toBeNull()
    expect(simulate(params({ ral: 30000 }))).toBeNull()
    expect(simulate(params({ r10: 4, ral: 30000, anni: 0 }))).toBeNull()
    expect(simulate(params({ r10: 4, ral: 30000, anni: 61 }))).toBeNull()
  })

  it('pareggio oltre il 30% segnalato', () => {
    const s = simulate(params({ cat: 'AZN', r10: 40, ral: 30000, pct_lav: 1, pct_dat: 1, anni: 30 }))!
    expect(s.breakevenReached).toBe(false)
  })
})

describe('openFundTableRows', () => {
  it('tutte le categorie nell\'ordine del menu', () => {
    const rows = openFundTableRows(params({ tutte: true }))
    expect(rows.length).toBe(62)
    expect(rows[0].categoria).toBe('GAR')
    expect(rows.at(-1)!.categoria).toBe('AZN')
  })
  it('solo la categoria scelta', () => {
    expect(openFundTableRows(params({ cat: 'BIL' })).every(x => x.categoria === 'BIL')).toBe(true)
  })
})
