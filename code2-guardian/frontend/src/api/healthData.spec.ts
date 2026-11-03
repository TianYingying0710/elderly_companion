import { describe, expect, it, vi } from 'vitest'

import { getHealthOverview } from './healthData'

vi.mock('./client', () => ({
  apiRequest: vi.fn().mockResolvedValue({
    elder_id: 'elder_1',
    metrics: [],
    updated_at: null,
    source_status: 'available',
  }),
}))

describe('health data api', () => {
  it('requests the overview endpoint and maps its response', async () => {
    await expect(getHealthOverview('elder_1')).resolves.toMatchObject({ elderId: 'elder_1', metrics: [] })
  })
})
