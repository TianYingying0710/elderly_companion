import { describe, expect, it } from 'vitest'
import { mapSosEvent, mapSosEventStatus } from '../mappers/sosEventMapper'
import type { SosEventDto } from '../types/sosEvents'

const dto: SosEventDto = {
  id: 'sos-1',
  elder_id: 'elder-001',
  created_at: '2026-11-08T09:12:00',
  status: 'pending',
  note: null,
}

describe('sosEventMapper', () => {
  it('maps pending to 待响应/red', () => {
    expect(mapSosEventStatus('pending')).toEqual({ label: '待响应', kind: 'red' })
  })

  it('maps processing and resolved to their labels', () => {
    expect(mapSosEventStatus('processing').label).toBe('处理中')
    expect(mapSosEventStatus('resolved')).toEqual({ label: '已完成处理', kind: 'green' })
  })

  it('falls back to 未知状态 for unknown status', () => {
    expect(mapSosEventStatus('weird')).toEqual({ label: '未知状态', kind: 'blue' })
  })

  it('maps dto to view with formatted time and empty note for null', () => {
    const view = mapSosEvent(dto)
    expect(view).toEqual({
      id: 'sos-1',
      elderId: 'elder-001',
      time: '2026-11-08 09:12:00',
      status: 'pending',
      statusLabel: '待响应',
      statusKind: 'red',
      note: '',
    })
  })

  it('keeps note text when present', () => {
    expect(mapSosEvent({ ...dto, note: '已上门' }).note).toBe('已上门')
  })

  it('保留原始状态，页面据此决定能推进到哪一步', () => {
    expect(mapSosEvent({ ...dto, status: 'resolved' }).status).toBe('resolved')
  })
})
