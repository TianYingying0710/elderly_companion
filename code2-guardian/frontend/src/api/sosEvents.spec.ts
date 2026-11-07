import { describe, expect, it, vi } from 'vitest'

import { getSosEvents, parseSosEvent } from './sosEvents'

// 消费者契约样本：字段集合与 code1-elder 后端 tests/test_sos_events_api.py
// 的响应形态完全一致（id=uuid4().hex 共 32 位）。
const CONTRACT_SAMPLE = {
  id: '0123456789abcdef0123456789abcdef',
  elder_id: 'elder-001',
  created_at: '2026-11-08T02:30:00.000000+00:00',
  status: 'pending',
  note: '客厅需要帮助',
}

function fakeRequest(result: unknown) {
  return vi.fn().mockResolvedValue(result)
}

describe('sos events api', () => {
  it('requests the code1 sos-events endpoint with elder_id query', async () => {
    const request = fakeRequest([CONTRACT_SAMPLE])

    await getSosEvents('elder-001', request)

    expect(request).toHaveBeenCalledWith('/api/v1/sos-events?elder_id=elder-001')
  })

  it('accepts a response matching the code1 contract', async () => {
    const request = fakeRequest([CONTRACT_SAMPLE, { ...CONTRACT_SAMPLE, id: 'ffffffffffffffffffffffffffffffff', status: 'resolved', note: null }])

    await expect(getSosEvents('elder-001', request)).resolves.toHaveLength(2)
  })

  it('rejects payloads with wrong or missing fields', async () => {
    const request = fakeRequest([
      { ...CONTRACT_SAMPLE, status: 'done' },
      { ...CONTRACT_SAMPLE, elder_id: 42 },
      { ...CONTRACT_SAMPLE, note: 7 },
      { id: '' },
    ])

    await expect(getSosEvents('elder-001', request)).rejects.toThrow('invalid sos event')
  })

  it('rejects non-array payloads', async () => {
    const request = fakeRequest(CONTRACT_SAMPLE)

    await expect(getSosEvents('elder-001', request)).rejects.toThrow('invalid sos events payload')
  })

  it('parseSosEvent ignores extra fields from the backend', () => {
    expect(() => parseSosEvent({ ...CONTRACT_SAMPLE, extra: 'ignored' })).not.toThrow()
  })
})
