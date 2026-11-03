import { describe, expect, it } from 'vitest'

import { deriveHealthState } from './healthDataState'
import type { HealthOverviewRaw } from './healthDataState'

const NOW = new Date('2026-11-03T08:20:00+08:00')
const STALE_MS = 24 * 60 * 60 * 1000 // 24 小时

function raw(overrides: Partial<HealthOverviewRaw> = {}): HealthOverviewRaw {
  return {
    sourceStatus: 'available',
    metrics: [
      { key: 'heartRate', label: '心率', value: '72', unit: '次/分', badge: '正常' },
    ],
    trend: [{ dateLabel: '10-28', value: 74 }],
    updatedAt: '2026-11-03T07:00:00+08:00',
    ...overrides,
  }
}

describe('deriveHealthState', () => {
  it('derives not_connected when source is unavailable', () => {
    const result = deriveHealthState(raw({ sourceStatus: 'unavailable' }), NOW, STALE_MS)
    expect(result.state).toBe('not_connected')
    expect(result.metrics).toEqual([])
    expect(result.trend).toEqual([])
    expect(result.isDemo).toBe(false)
  })

  it('derives no_data when available but metrics are empty', () => {
    const result = deriveHealthState(raw({ metrics: [], trend: [] }), NOW, STALE_MS)
    expect(result.state).toBe('no_data')
    expect(result.metrics).toEqual([])
    expect(result.isDemo).toBe(false)
  })

  it('derives has_data when available with fresh data', () => {
    const result = deriveHealthState(raw(), NOW, STALE_MS)
    expect(result.state).toBe('has_data')
    expect(result.metrics).toHaveLength(1)
    expect(result.trend).toHaveLength(1)
    expect(result.isDemo).toBe(true)
  })

  it('derives stale when updated_at is older than 24h', () => {
    const old = '2026-11-02T06:00:00+08:00' // 超过 24 小时前
    const result = deriveHealthState(raw({ updatedAt: old }), NOW, STALE_MS)
    expect(result.state).toBe('stale')
    expect(result.metrics).toHaveLength(1)
    expect(result.isDemo).toBe(true)
  })

  it('keeps has_data when updated_at is within 24h (boundary)', () => {
    const justWithin = '2026-11-02T08:20:00+08:00' // 正好 24 小时
    const result = deriveHealthState(raw({ updatedAt: justWithin }), NOW, STALE_MS)
    expect(result.state).toBe('has_data')
  })

  it('does not judge staleness when updated_at is null', () => {
    const result = deriveHealthState(raw({ updatedAt: null }), NOW, STALE_MS)
    expect(result.state).toBe('has_data')
  })

  it('passes through source_status and updated_at unchanged', () => {
    const result = deriveHealthState(raw(), NOW, STALE_MS)
    expect(result.sourceStatus).toBe('available')
    expect(result.updatedAt).toBe('2026-11-03T07:00:00+08:00')
  })

  it('clears metrics and trend for non-data states', () => {
    const result = deriveHealthState(raw({ sourceStatus: 'unavailable' }), NOW, STALE_MS)
    expect(result.metrics).toEqual([])
    expect(result.trend).toEqual([])
  })
})
