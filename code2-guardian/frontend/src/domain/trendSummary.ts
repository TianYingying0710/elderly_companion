import type { HeartRateTrendPoint } from '../types'

// 只由现有序列派生的统计量；空序列返回 null，避免除零或越界。
export interface TrendSummary {
  max: number | null
  min: number | null
  average: number | null
}

export function summarizeTrend(points: HeartRateTrendPoint[]): TrendSummary {
  if (points.length === 0) {
    return { max: null, min: null, average: null }
  }

  const values = points.map((point) => point.value)
  const total = values.reduce((sum, value) => sum + value, 0)

  return {
    max: Math.max(...values),
    min: Math.min(...values),
    average: Math.round((total / values.length) * 10) / 10,
  }
}
