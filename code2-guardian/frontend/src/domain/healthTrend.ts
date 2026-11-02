import type { HeartRateTrendPoint, PlotPadding, TrendCoordinate } from '../types'

export const heartRateTrend: HeartRateTrendPoint[] = [
  { dateLabel: '10-25', value: 70 },
  { dateLabel: '10-26', value: 72 },
  { dateLabel: '10-27', value: 71 },
  { dateLabel: '10-28', value: 74 },
  { dateLabel: '10-29', value: 73 },
  { dateLabel: '10-30', value: 71 },
  { dateLabel: '10-31', value: 72 },
]

export function buildTrendPoints(
  values: number[],
  width: number,
  height: number,
  padding: PlotPadding,
): TrendCoordinate[] {
  // 画布尚未完成布局时尺寸为 0；此时返回空数组，调用方直接跳过绘制，
  // 避免按 0 尺寸算出一条贴边的假曲线。
  if (values.length === 0) return []
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return []

  const plotWidth = Math.max(0, width - padding.left - padding.right)
  const plotHeight = Math.max(0, height - padding.top - padding.bottom)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min

  return values.map((value, index) => ({
    x: padding.left + (values.length === 1 ? plotWidth / 2 : (index * plotWidth) / (values.length - 1)),
    y: span === 0
      ? padding.top + plotHeight / 2
      : padding.top + ((max - value) * plotHeight) / span,
  }))
}
