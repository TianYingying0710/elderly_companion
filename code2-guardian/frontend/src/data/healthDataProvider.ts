// 健康数据 Provider：页面只依赖此接口，未来硬件接入时替换实现即可，页面与状态机零改动。
// 本轮唯一实现是 MockHealthDataProvider，驱动六态用于演示，不伪造真实健康数据。

import { ApiError } from '../api/client'
import { deriveHealthState, type HealthDisplayState, type HealthOverviewSnapshot } from '../domain/healthDataState'
import { healthMetrics } from '../mock/data'
import { heartRateTrend } from '../domain/healthTrend'

export interface HealthDataProvider {
  /**
   * 返回六态快照；数据源接入失败时抛出结构化错误（ApiError / Error）。
   * 连接中（connecting）不由 Provider 返回，由调用方（useHealthData）的 loading 派生。
   */
  getOverview(): Promise<HealthOverviewSnapshot>
}

/** 可被 mock 的状态：connecting 由编排层派生，不在 provider 内模拟 */
type MockableState = Exclude<HealthDisplayState, 'connecting'>

const STALE_ISO = '2026-11-01T08:20:00+08:00'

export class MockHealthDataProvider implements HealthDataProvider {
  private state: MockableState = 'not_connected'

  /**
   * 仅开发/测试期切换六态；生产页面只通过 HealthDataProvider 接口调用 getOverview，
   * 看不到此方法。
   */
  setState(state: MockableState): void {
    this.state = state
  }

  async getOverview(): Promise<HealthOverviewSnapshot> {
    switch (this.state) {
      case 'not_connected':
        return deriveHealthState(
          { sourceStatus: 'unavailable', metrics: [], trend: [], updatedAt: null },
          new Date(),
        )
      case 'no_data':
        return deriveHealthState(
          { sourceStatus: 'available', metrics: [], trend: [], updatedAt: null },
          new Date(),
        )
      case 'has_data':
        return deriveHealthState(
          {
            sourceStatus: 'available',
            metrics: healthMetrics,
            trend: heartRateTrend,
            updatedAt: freshIso(),
          },
          new Date(),
        )
      case 'stale':
        return deriveHealthState(
          {
            sourceStatus: 'available',
            metrics: healthMetrics,
            trend: heartRateTrend,
            updatedAt: STALE_ISO,
          },
          new Date(),
        )
      case 'error':
        throw new ApiError('健康数据获取失败，请稍后重试', null, 'health_data_error')
    }
  }
}

/** 返回当前时刻的带时区 ISO 8601 字符串（用于 has_data 的更新时间）。 */
function freshIso(): string {
  return new Date().toISOString()
}
