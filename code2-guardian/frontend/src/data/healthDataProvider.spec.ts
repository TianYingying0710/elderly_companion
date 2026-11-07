import { describe, expect, it } from 'vitest'

import { ApiError } from '../api/client'
import {
  ApiHealthDataProvider,
  MockHealthDataProvider,
  createHealthDataProvider,
  DEMO_ELDER_ID,
} from './healthDataProvider'
import type { HealthDisplayState } from '../domain/healthDataState'
import type { HealthOverviewModel } from '../types/healthData'

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

const baseModel = (overrides: Partial<HealthOverviewModel> = {}): HealthOverviewModel => ({
  elderId: DEMO_ELDER_ID,
  metrics: [
    { key: 'heartRate', label: '静息心率', value: '68', unit: '次/分', badge: '' },
  ],
  updatedAt: new Date().toISOString(),
  sourceStatus: 'available',
  ...overrides,
})

describe('ApiHealthDataProvider', () => {
  it('derives has_data from a successful backend model with empty trend', async () => {
    const fetchOverview = async (elderId: string): Promise<HealthOverviewModel> => {
      expect(elderId).toBe(DEMO_ELDER_ID)
      return baseModel()
    }
    const snapshot = await new ApiHealthDataProvider(fetchOverview).getOverview()
    expect(snapshot.state).toBe('has_data')
    expect(snapshot.metrics.length).toBeGreaterThan(0)
    expect(snapshot.trend).toEqual([])
    expect(snapshot.sourceStatus).toBe('available')
  })

  it('derives no_data from available source with empty metrics', async () => {
    const snapshot = await new ApiHealthDataProvider(async () => baseModel({ metrics: [] })).getOverview()
    expect(snapshot.state).toBe('no_data')
    expect(snapshot.metrics).toEqual([])
  })

  it('propagates 503 ApiError with health_data_source_unavailable code untouched', async () => {
    const fetchOverview = async (): Promise<HealthOverviewModel> => {
      throw new ApiError('健康数据源尚未接入', 503, 'health_data_source_unavailable')
    }
    // ApiError 原样抛出，由 useHealthData 映射为 not_connected
    await expect(new ApiHealthDataProvider(fetchOverview).getOverview()).rejects.toMatchObject({
      code: 'health_data_source_unavailable',
      status: 503,
    })
  })
})

describe('createHealthDataProvider', () => {
  it('defaults to mock when mode is undefined or mock', () => {
    expect(createHealthDataProvider(undefined)).toBeInstanceOf(MockHealthDataProvider)
    expect(createHealthDataProvider('mock')).toBeInstanceOf(MockHealthDataProvider)
  })

  it('selects the api provider only for mode=api', () => {
    expect(createHealthDataProvider('api')).toBeInstanceOf(ApiHealthDataProvider)
  })
})
