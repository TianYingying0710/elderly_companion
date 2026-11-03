import { describe, expect, it } from 'vitest'

import { ApiError } from '../api/client'
import type { HealthDataProvider } from '../data/healthDataProvider'
import type { HealthOverviewSnapshot } from '../domain/healthDataState'
import { useHealthData } from './useHealthData'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const hasDataSnapshot: HealthOverviewSnapshot = {
  state: 'has_data',
  metrics: [{ key: 'heartRate', label: '心率', value: '72', unit: '次/分', badge: '正常' }],
  trend: [{ dateLabel: '10-28', value: 74 }],
  updatedAt: '2026-11-03T07:00:00+08:00',
  message: null,
  sourceStatus: 'available',
  isDemo: true,
}

describe('useHealthData', () => {
  it('exposes connecting while the provider promise is pending', async () => {
    const d = deferred<HealthOverviewSnapshot>()
    const provider: HealthDataProvider = { getOverview: () => d.promise }
    const store = useHealthData(provider)

    const loading = store.loading.value
    expect(loading).toBe(true)

    d.resolve(hasDataSnapshot)
    await d.promise
  })

  it('resolves to has_data with the snapshot', async () => {
    const provider: HealthDataProvider = { getOverview: () => Promise.resolve(hasDataSnapshot) }
    const store = useHealthData(provider)
    await store.ready
    expect(store.snapshot.value?.state).toBe('has_data')
    expect(store.loading.value).toBe(false)
  })

  it('maps a normal error to error state and keeps the message', async () => {
    const provider: HealthDataProvider = {
      getOverview: () => Promise.reject(new ApiError('健康数据获取失败', null, 'health_data_error')),
    }
    const store = useHealthData(provider)
    await store.ready
    expect(store.snapshot.value?.state).toBe('error')
    expect(store.snapshot.value?.message).toBe('健康数据获取失败')
  })

  it('maps health_data_source_unavailable to not_connected, not error', async () => {
    const provider: HealthDataProvider = {
      getOverview: () =>
        Promise.reject(new ApiError('健康数据源尚未接入', 503, 'health_data_source_unavailable')),
    }
    const store = useHealthData(provider)
    await store.ready
    expect(store.snapshot.value?.state).toBe('not_connected')
    expect(store.snapshot.value?.message).toBe('健康数据源尚未接入')
  })
})
