import { describe, expect, it } from 'vitest'

import { heartRateTrend } from './healthTrend'
import { summarizeTrend } from './trendSummary'

const point = (value: number) => ({ dateLabel: '10-01', value })

describe('heart-rate trend summary', () => {
  it('summarises the existing seven day demo series', () => {
    expect(summarizeTrend(heartRateTrend)).toEqual({ max: 74, min: 70, average: 71.9 })
  })

  it('returns empty statistics for an empty series without dividing by zero', () => {
    const summary = summarizeTrend([])

    expect(summary).toEqual({ max: null, min: null, average: null })
    expect(Number.isNaN(summary.average)).toBe(false)
  })

  it('handles a single point and a flat series', () => {
    expect(summarizeTrend([point(72)])).toEqual({ max: 72, min: 72, average: 72 })
    expect(summarizeTrend([point(72), point(72), point(72)])).toEqual({
      max: 72,
      min: 72,
      average: 72,
    })
  })

  it('keeps the average finite and inside the observed range', () => {
    const summary = summarizeTrend([point(60), point(90)])

    expect(summary.average).toBe(75)
    expect(Number.isFinite(summary.average as number)).toBe(true)
    expect(summary.average as number).toBeGreaterThanOrEqual(summary.min as number)
    expect(summary.average as number).toBeLessThanOrEqual(summary.max as number)
  })
})
