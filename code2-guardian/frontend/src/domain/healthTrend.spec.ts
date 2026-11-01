import { describe, expect, it } from 'vitest'

import { buildTrendPoints, heartRateTrend } from './healthTrend'

describe('guardian heart-rate trend', () => {
  it('provides seven explicitly dated plausible demo points', () => {
    expect(heartRateTrend).toHaveLength(7)
    expect(heartRateTrend.every((point) => /^\d{2}-\d{2}$/.test(point.dateLabel))).toBe(true)
    expect(heartRateTrend.every((point) => point.value >= 50 && point.value <= 100)).toBe(true)
  })

  it('keeps normal and flat series inside the plot padding', () => {
    for (const values of [[60, 70, 65], [72, 72, 72]]) {
      const points = buildTrendPoints(values, 300, 120, { left: 16, right: 12, top: 12, bottom: 20 })
      expect(points).toHaveLength(3)
      expect(points.every((point) => point.x >= 16 && point.x <= 288)).toBe(true)
      expect(points.every((point) => point.y >= 12 && point.y <= 100)).toBe(true)
    }
  })

  it('returns no geometry for an empty series', () => {
    expect(buildTrendPoints([], 300, 120, { left: 16, right: 12, top: 12, bottom: 20 })).toEqual([])
  })
})
