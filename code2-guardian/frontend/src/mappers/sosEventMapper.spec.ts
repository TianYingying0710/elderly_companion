import { describe, expect, it } from 'vitest'

import { formatSosTime, toSosMessageItem } from './sosEventMapper'
import type { SosEventDto } from '../types/sosEvents'

function dto(overrides: Partial<SosEventDto> = {}): SosEventDto {
  return {
    id: '0123456789abcdef0123456789abcdef',
    elder_id: 'elder-001',
    created_at: '2026-11-08T02:30:00.000000+00:00',
    status: 'pending',
    note: null,
    ...overrides,
  }
}

describe('sos event mapper', () => {
  it('maps a pending event to a rescue message with status summary', () => {
    const item = toSosMessageItem(dto())

    expect(item).toMatchObject({
      id: '0123456789abcdef0123456789abcdef',
      category: '求助消息',
      title: '老人发起SOS求助',
      summary: '老人发起SOS求助，请及时查看。',
    })
  })

  it('prefers the elder note as summary when present', () => {
    const item = toSosMessageItem(dto({ note: '客厅需要帮助', status: 'processing' }))

    expect(item.summary).toBe('客厅需要帮助')
  })

  it('maps processing and resolved statuses', () => {
    expect(toSosMessageItem(dto({ status: 'processing' })).summary).toBe('老人发起SOS求助，社区已介入处理。')
    expect(toSosMessageItem(dto({ status: 'resolved' })).summary).toBe('老人发起SOS求助，已处理完成。')
  })

  it('formats created_at as MM-DD HH:mm', () => {
    const item = toSosMessageItem(dto())

    expect(item.time).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  it('returns the raw string when created_at cannot be parsed', () => {
    expect(formatSosTime('not-a-date')).toBe('not-a-date')
  })
})
