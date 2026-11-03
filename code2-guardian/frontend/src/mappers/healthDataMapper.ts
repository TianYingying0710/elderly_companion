import type { HealthMetricKey } from '../types'
import type { HealthMetricDto, HealthOverviewDto, HealthOverviewModel } from '../types/healthData'

const keyMap: Record<HealthMetricDto['key'], HealthMetricKey> = {
  heart_rate: 'heartRate',
  blood_pressure: 'bloodPressure',
  sleep: 'sleep',
}

export function mapHealthOverview(dto: HealthOverviewDto): HealthOverviewModel {
  return {
    elderId: dto.elder_id,
    updatedAt: dto.updated_at,
    sourceStatus: dto.source_status,
    metrics: dto.metrics.map((metric) => ({ ...metric, key: keyMap[metric.key], badge: metric.badge ?? '' })),
  }
}
