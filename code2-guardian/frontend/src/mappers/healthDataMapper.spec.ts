import { describe, expect, it } from 'vitest'

import { mapHealthOverview } from './healthDataMapper'

describe('health data mapper', () => {
  it('maps backend snake_case metric keys to the existing guardian model', () => {
    const result = mapHealthOverview({
      elder_id: 'elder_1',
      metrics: [{ key: 'heart_rate', label: '心率', value: '72', unit: '次/分', badge: null }],
      updated_at: '2026-11-03T08:20:00Z',
      source_status: 'available',
    })

    expect(result).toEqual({
      elderId: 'elder_1',
      metrics: [{ key: 'heartRate', label: '心率', value: '72', unit: '次/分', badge: '' }],
      updatedAt: '2026-11-03T08:20:00Z',
      sourceStatus: 'available',
    })
  })
})
