// 监护人端健康展示六态状态机：纯函数，不依赖 Vue，可被 vitest 直接覆盖。
// 六态优先级：connecting > error > not_connected > no_data > stale > has_data。
// 其中 connecting 与 error 由 useHealthData 编排层决定，不在这里派生。

import type { HealthMetric, HeartRateTrendPoint } from '../types'

export type HealthDisplayState =
  | 'not_connected'
  | 'connecting'
  | 'no_data'
  | 'has_data'
  | 'stale'
  | 'error'

export interface HealthOverviewSnapshot {
  state: HealthDisplayState
  metrics: HealthMetric[]
  trend: HeartRateTrendPoint[]
  updatedAt: string | null
  message: string | null
  sourceStatus: 'unavailable' | 'available'
  isDemo: boolean
}

/** 原始 Provider 结果（DTO 语义），deriveHealthState 的输入 */
export interface HealthOverviewRaw {
  sourceStatus: 'unavailable' | 'available'
  metrics: HealthMetric[]
  trend: HeartRateTrendPoint[]
  updatedAt: string | null
}

const HOUR_MS = 60 * 60 * 1000

/** 默认过期阈值：24 小时 */
export const DEFAULT_STALE_THRESHOLD_MS = 24 * HOUR_MS

export const NOT_CONNECTED_MESSAGE = '尚未接入硬件'
export const NO_DATA_MESSAGE = '暂无数据'

/**
 * 把 Provider 原始结果派生为六态快照。
 * - source unavailable → not_connected（清空 metrics/trend）
 * - available 且 metrics 为空 → no_data
 * - available 且 updated_at 过期 → stale（保留数据，isDemo=true）
 * - available 且有效数据 → has_data（isDemo=true）
 * 非 has_data/stale 一律清空 metrics/trend，不显示健康数值。
 */
export function deriveHealthState(
  raw: HealthOverviewRaw,
  now: Date,
  staleThresholdMs: number = DEFAULT_STALE_THRESHOLD_MS,
): HealthOverviewSnapshot {
  if (raw.sourceStatus === 'unavailable') {
    return {
      state: 'not_connected',
      metrics: [],
      trend: [],
      updatedAt: raw.updatedAt,
      message: NOT_CONNECTED_MESSAGE,
      sourceStatus: raw.sourceStatus,
      isDemo: false,
    }
  }

  if (raw.metrics.length === 0) {
    return {
      state: 'no_data',
      metrics: [],
      trend: [],
      updatedAt: raw.updatedAt,
      message: NO_DATA_MESSAGE,
      sourceStatus: raw.sourceStatus,
      isDemo: false,
    }
  }

  const stale = isStale(raw.updatedAt, now, staleThresholdMs)
  return {
    state: stale ? 'stale' : 'has_data',
    metrics: raw.metrics,
    trend: raw.trend,
    updatedAt: raw.updatedAt,
    message: null,
    sourceStatus: raw.sourceStatus,
    isDemo: true,
  }
}

/** updated_at 为 null 时不判定过期；非 null 时按阈值比较。 */
function isStale(updatedAt: string | null, now: Date, staleThresholdMs: number): boolean {
  if (updatedAt === null) return false
  const parsed = Date.parse(updatedAt)
  if (!Number.isFinite(parsed)) return false
  return now.getTime() - parsed > staleThresholdMs
}
