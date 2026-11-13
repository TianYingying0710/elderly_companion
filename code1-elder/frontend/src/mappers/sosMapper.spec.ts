import { describe, expect, it } from 'vitest'
import type { SosEventDto } from '../types/sos'
import { formatSosTime, toRequestRecord, toRequestRecords } from './sosMapper'

const event: SosEventDto = {
  id: 'sos-1', elder_id: 'elder-001', created_at: '2026-11-13T02:03:00Z',
  status: 'processing', note: '家人已联系',
}

describe('sos history mapper', () => {
  it('maps an event to a request record with status copy and note timeline', () => {
    expect(toRequestRecord(event)).toEqual({
      id: 'sos-1',
      title: '软件 SOS 求助',
      time: '11-13 10:03',
      state: '处理中 · 家人/社区已介入',
      timeline: [['11-13 10:03', '家人已联系']],
    })
  })

  it('uses an honest timeline entry when the backend note is absent', () => {
    expect(toRequestRecord({ ...event, note: null }).timeline).toEqual([['11-13 10:03', '事件已上报']])
  })

  it('maps every backend status to the same copy used by the SOS page', () => {
    expect(toRequestRecord({ ...event, status: 'pending' }).state).toBe('已上报 · 等待处理')
    expect(toRequestRecord({ ...event, status: 'processing' }).state).toBe('处理中 · 家人/社区已介入')
    expect(toRequestRecord({ ...event, status: 'resolved' }).state).toBe('已解决')
  })

  it('sorts newest first without mutating the input array', () => {
    const older = { ...event, id: 'old', created_at: '2026-11-12T00:00:00Z' }
    const newer = { ...event, id: 'new', created_at: '2026-11-14T00:00:00Z' }
    const input = [older, newer]
    expect(toRequestRecords(input).map((item) => item.id)).toEqual(['new', 'old'])
    expect(input.map((item) => item.id)).toEqual(['old', 'new'])
  })

  it('formats in Asia/Shanghai and returns an empty string for invalid input', () => {
    expect(formatSosTime('2026-11-13T02:03:00Z')).toBe('11-13 10:03')
    expect(formatSosTime('not-a-date')).toBe('')
  })
})
