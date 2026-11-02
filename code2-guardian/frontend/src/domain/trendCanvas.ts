import type {
  PlotPadding,
  TrendAreaPath,
  TrendCanvasBitmap,
  TrendCanvasMetrics,
  TrendCoordinate,
  TrendTouchRegion,
} from '../types'

/** 像素比缺省值：拿不到设备像素比时按 2 倍处理，与原先的运行期兜底一致 */
export const DEFAULT_PIXEL_RATIO = 2

/**
 * 画布是否具备绘制条件。
 *
 * 宽度、高度、像素比三者任一缺失（0、负数、NaN）都不可绘制：
 * 此时强行绘制只会得到贴边的一条直线，视觉上表现为「曲线跑到卡片外面」，
 * 且不会抛错，排查成本很高。因此统一在此处拦掉。
 */
export function isCanvasMeasurable(metrics: TrendCanvasMetrics): boolean {
  const { width, height, dpr } = metrics
  return (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    Number.isFinite(dpr) &&
    width > 0 &&
    height > 0 &&
    dpr > 0
  )
}

/**
 * 由 CSS 尺寸算出位图尺寸。
 *
 * 只用于设置 canvas 的 width / height 属性（位图分辨率），
 * 不参与布局：元素的实际显示尺寸仍由样式里的宽度与高度决定。
 */
export function resolveCanvasBitmap(metrics: TrendCanvasMetrics): TrendCanvasBitmap {
  if (!isCanvasMeasurable(metrics)) return { width: 0, height: 0 }
  return {
    width: Math.floor(metrics.width * metrics.dpr),
    height: Math.floor(metrics.height * metrics.dpr),
  }
}

/**
 * 画布在页面中的触摸区域（CSS 像素）。
 *
 * 原生组件的显示框由布局决定，不随位图尺寸变化；
 * 这里显式给出与布局一致的矩形，调用方可据此把画布钉在容器内。
 */
export function resolveTouchRegion(metrics: TrendCanvasMetrics): TrendTouchRegion {
  if (!isCanvasMeasurable(metrics)) return { left: 0, top: 0, width: 0, height: 0 }
  return { left: 0, top: 0, width: metrics.width, height: metrics.height }
}

/** 折线区域的基线（面积填充的底边），取画布底部减去下留白 */
export function resolveBaseline(metrics: TrendCanvasMetrics, padding: PlotPadding): number {
  if (!isCanvasMeasurable(metrics)) return 0
  return Math.max(0, metrics.height - padding.bottom)
}

/**
 * 折线 + 基线的闭合路径。
 *
 * 基线单独返回而非塞进坐标数组，是为了让调用方清楚：
 * 填充的是「上沿折线」与「下沿基线」之间的区域，而不是把基线当成一个数据点。
 */
export function buildTrendAreaPath(
  points: TrendCoordinate[],
  metrics: TrendCanvasMetrics,
  padding: PlotPadding,
): TrendAreaPath {
  const baseline = resolveBaseline(metrics, padding)
  if (points.length === 0) return { top: [], baseline }
  return { top: points, baseline }
}
