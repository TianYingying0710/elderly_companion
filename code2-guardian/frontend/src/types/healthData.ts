import type { HealthMetric } from './index'

export type HealthMetricDtoKey = 'heart_rate' | 'blood_pressure' | 'sleep'

export interface HealthMetricDto {
  key: HealthMetricDtoKey
  label: string
  value: string
  unit: string
  badge: string | null
}

export interface HealthOverviewDto {
  elder_id: string
  metrics: HealthMetricDto[]
  updated_at: string | null
  source_status: 'unavailable' | 'available'
}

export interface HealthOverviewModel {
  elderId: string
  metrics: HealthMetric[]
  updatedAt: string | null
  sourceStatus: HealthOverviewDto['source_status']
}
