// 健康数据 Provider：页面只依赖此接口，未来硬件接入时替换实现即可，页面与状态机零改动。
// 两个实现：MockHealthDataProvider（本地演示六态）与 ApiHealthDataProvider（真实后端契约）。
// 页面通过 createHealthDataProvider 按 VITE_HEALTH_DATA_MODE 选择实现，默认 mock。

import { getHealthOverview } from '../api/healthData'
import { ApiError } from '../api/client'
import { deriveHealthState, type HealthDisplayState, type HealthOverviewSnapshot } from '../domain/healthDataState'
import { healthMetrics } from '../mock/data'
import { heartRateTrend } from '../domain/healthTrend'
import type { HealthOverviewModel } from '../types/healthData'

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

/** 后端契约允许的老人标识（[A-Za-z0-9_-]{1,64}）；当前无真实老人，仅用于契约调用的演示标识 */
export const DEMO_ELDER_ID = 'elder-001'

/**
 * 真实后端实现：调用 /api/v1/health-overview/{elderId}，把 Model 派生为六态快照。
 * 后端数据源未接入时返回 503 + health_data_source_unavailable，ApiError 原样抛出，
 * 由 useHealthData 映射为 not_connected。后端契约暂不含趋势序列，trend 恒为空。
 */
export class ApiHealthDataProvider implements HealthDataProvider {
  constructor(
    private readonly fetchOverview: (elderId: string) => Promise<HealthOverviewModel> = getHealthOverview,
  ) {}

  async getOverview(): Promise<HealthOverviewSnapshot> {
    const model = await this.fetchOverview(DEMO_ELDER_ID)
    return deriveHealthState(
      {
        sourceStatus: model.sourceStatus,
        metrics: model.metrics,
        trend: [],
        updatedAt: model.updatedAt,
      },
      new Date(),
    )
  }
}

/**
 * 按环境变量选择 Provider：VITE_HEALTH_DATA_MODE=api 用真实后端，其余（含未设置）用 mock。
 * mode 显式传参便于测试；页面调用时不传，读取构建环境。
 */
export function createHealthDataProvider(
  mode: string | undefined = import.meta.env.VITE_HEALTH_DATA_MODE,
): HealthDataProvider {
  return mode === 'api' ? new ApiHealthDataProvider() : new MockHealthDataProvider()
}
