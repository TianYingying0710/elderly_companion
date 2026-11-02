import { describe, expect, it } from 'vitest'

import type { TrendCanvasMetrics } from '../types'
import {
  buildTrendAreaPath,
  isCanvasMeasurable,
  resolveCanvasBitmap,
  resolveTouchRegion,
} from './trendCanvas'
import { buildTrendPoints } from './healthTrend'

const PADDING = { left: 10, right: 10, top: 10, bottom: 12 }

describe('trend canvas measurement guard', () => {
  it('rejects unmeasured or collapsed nodes so nothing is drawn silently', () => {
    const cases: TrendCanvasMetrics[] = [
      { width: 0, height: 90, dpr: 2 },
      { width: 315, height: 0, dpr: 2 },
      { width: 315, height: 90, dpr: 0 },
      { width: Number.NaN, height: 90, dpr: 2 },
      { width: 315, height: Number.NaN, dpr: 2 },
      { width: 315, height: -20, dpr: 2 },
    ]
    for (const metrics of cases) {
      expect(isCanvasMeasurable(metrics)).toBe(false)
    }
  })

  it('accepts a fully measured node', () => {
    expect(isCanvasMeasurable({ width: 315, height: 90, dpr: 2 })).toBe(true)
    expect(isCanvasMeasurable({ width: 315, height: 90, dpr: 1 })).toBe(true)
  })
})

describe('trend canvas bitmap sizing', () => {
  it('scales the bitmap by dpr and keeps the layout box at Css size', () => {
    expect(resolveCanvasBitmap({ width: 315, height: 90, dpr: 2 })).toEqual({ width: 630, height: 180 })
    expect(resolveCanvasBitmap({ width: 315, height: 90, dpr: 1 })).toEqual({ width: 315, height: 90 })
  })

  it('never returns a zero or fractional bitmap edge', () => {
    const bitmap = resolveCanvasBitmap({ width: 315.4, height: 90.6, dpr: 2.75 })
    expect(bitmap.width).toBe(Math.floor(315.4 * 2.75))
    expect(bitmap.height).toBe(Math.floor(90.6 * 2.75))
    expect(Number.isInteger(bitmap.width)).toBe(true)
    expect(Number.isInteger(bitmap.height)).toBe(true)
  })
})

describe('trend touch region', () => {
  it('keeps the touch box at exactly the measured Css size regardless of dpr', () => {
    expect(resolveTouchRegion({ width: 315, height: 90, dpr: 2 })).toEqual({ left: 0, top: 0, width: 315, height: 90 })
    expect(resolveTouchRegion({ width: 315, height: 90, dpr: 3 })).toEqual({ left: 0, top: 0, width: 315, height: 90 })
  })

  it('returns a zero region for an unusable node so callers can skip it', () => {
    expect(resolveTouchRegion({ width: 315, height: 0, dpr: 2 })).toEqual({ left: 0, top: 0, width: 0, height: 0 })
  })
})

describe('trend area path', () => {
  it('closes the filled area on the baseline inside the canvas', () => {
    const metrics: TrendCanvasMetrics = { width: 315, height: 90, dpr: 2 }
    const path = buildTrendAreaPath(
      buildTrendPoints([70, 72, 71, 74, 73, 71, 72], metrics.width, metrics.height, PADDING),
      metrics,
      PADDING,
    )
    expect(path.top).toHaveLength(7)
    expect(path.baseline).toBe(78)
    expect(path.top.every((point) => point.y >= 0 && point.y <= path.baseline)).toBe(true)
    expect(path.top.every((point) => point.x >= 0 && point.x <= metrics.width)).toBe(true)
  })

  it('returns an empty path when there is nothing to draw', () => {
    const metrics: TrendCanvasMetrics = { width: 315, height: 90, dpr: 2 }
    expect(buildTrendAreaPath([], metrics, PADDING)).toEqual({ top: [], baseline: 78 })
  })

  it('produces the same geometry for the same Css size at any dpr', () => {
    const points = [70, 72, 71]
    const at2 = buildTrendAreaPath(buildTrendPoints(points, 315, 90, PADDING), { width: 315, height: 90, dpr: 2 }, PADDING)
    const at3 = buildTrendAreaPath(buildTrendPoints(points, 315, 90, PADDING), { width: 315, height: 90, dpr: 3 }, PADDING)
    expect(at2).toEqual(at3)
  })
})
