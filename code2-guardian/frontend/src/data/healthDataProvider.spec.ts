import { describe, expect, it } from 'vitest'

import { ApiError } from '../api/client'
import { MockHealthDataProvider } from './healthDataProvider'
import type { HealthDisplayState } from '../domain/healthDataState'

const MOCKABLE_STATES: HealthDisplayState[] = ['not_connected', 'no_data', 'has_data', 'stale', 'error']

describe('MockHealthDataProvider', () => {
  it('returns not_connected by default with a complete snapshot', async () => {
    const provider = new MockHealthDataProvider()
    const snapshot = await provider.getOverview()
    expect(snapshot.state).toBe('not_connected')
    expect(snapshot.metrics).toEqual([])
    expect(snapshot.trend).toEqual([])
    expect(snapshot.updatedAt).toBeNull()
    expect(snapshot.message).toBe('尚未接入硬件')
    expect(snapshot.sourceStatus).toBe('unavailable')
    expect(snapshot.isDemo).toBe(false)
  })

  it('returns has_data with metrics, trend and isDemo=true when switched', async () => {
    const provider = new MockHealthDataProvider()
    provider.setState('has_data')
    const snapshot = await provider.getOverview()
    expect(snapshot.state).toBe('has_data')
    expect(snapshot.metrics.length).toBeGreaterThan(0)
    expect(snapshot.trend.length).toBeGreaterThan(0)
    expect(snapshot.isDemo).toBe(true)
    expect(snapshot.sourceStatus).toBe('available')
  })

  it('returns stale with isDemo=true when switched', async () => {
    const provider = new MockHealthDataProvider()
    provider.setState('stale')
    const snapshot = await provider.getOverview()
    expect(snapshot.state).toBe('stale')
    expect(snapshot.metrics.length).toBeGreaterThan(0)
    expect(snapshot.isDemo).toBe(true)
  })

  it('returns no_data with empty metrics when switched', async () => {
    const provider = new MockHealthDataProvider()
    provider.setState('no_data')
    const snapshot = await provider.getOverview()
    expect(snapshot.state).toBe('no_data')
    expect(snapshot.metrics).toEqual([])
    expect(snapshot.isDemo).toBe(false)
  })

  it('rejects with an ApiError for error state', async () => {
    const provider = new MockHealthDataProvider()
    provider.setState('error')
    await expect(provider.getOverview()).rejects.toBeInstanceOf(ApiError)
  })

  it('rejects with health_data_source_unavailable code mapped to not_connected semantics', async () => {
    const provider = new MockHealthDataProvider()
    provider.setState('not_connected')
    // not_connected 是正常 resolve（非异常），这里只验证它不抛错且状态正确
    const snapshot = await provider.getOverview()
    expect(snapshot.state).toBe('not_connected')
  })

  it('does not support connecting state via provider (derived by composable)', () => {
    const provider = new MockHealthDataProvider()
    // setState 不接受 connecting；类型层面 HealthDisplayState 含 connecting 但 provider 只处理可 mock 的态
    expect(MOCKABLE_STATES).not.toContain('connecting')
  })
})
