// 健康数据加载编排：把 Provider 的 Promise 生命周期映射为六态中的 connecting/error，
// 并把其余状态透传给页面。页面只依赖 useHealthData + Provider，不直接读 mock 常量。

import { ref } from 'vue'
import { ApiError } from '../api/client'
import type { HealthDataProvider } from '../data/healthDataProvider'
import type { HealthOverviewSnapshot } from '../domain/healthDataState'

/** 数据源未接入的结构化错误码（对应后端 503 契约），映射为 not_connected 而非 error */
const UNAVAILABLE_CODE = 'health_data_source_unavailable'

export function useHealthData(provider: HealthDataProvider) {
  const snapshot = ref<HealthOverviewSnapshot | null>(null)
  const loading = ref(true)
  const ready = (async () => {
    try {
      snapshot.value = await provider.getOverview()
    } catch (error) {
      snapshot.value = toErrorSnapshot(error)
    } finally {
      loading.value = false
    }
  })()

  return { snapshot, loading, ready }
}

/** 把 Provider 抛出的异常转换为快照：数据源未接入 → not_connected，其余 → error */
function toErrorSnapshot(error: unknown): HealthOverviewSnapshot {
  const isUnavailable = error instanceof ApiError && error.code === UNAVAILABLE_CODE
  const message = error instanceof Error ? error.message : '健康数据获取失败，请稍后重试'

  return {
    state: isUnavailable ? 'not_connected' : 'error',
    metrics: [],
    trend: [],
    updatedAt: null,
    message,
    sourceStatus: isUnavailable ? 'unavailable' : 'available',
    isDemo: false,
  }
}
