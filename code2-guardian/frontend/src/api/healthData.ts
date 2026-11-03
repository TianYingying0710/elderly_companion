import { apiRequest } from './client'
import { mapHealthOverview } from '../mappers/healthDataMapper'
import type { HealthOverviewDto, HealthOverviewModel } from '../types/healthData'

export function getHealthOverview(elderId: string): Promise<HealthOverviewModel> {
  return apiRequest<HealthOverviewDto>(`/api/v1/health-overview/${encodeURIComponent(elderId)}`).then(mapHealthOverview)
}
