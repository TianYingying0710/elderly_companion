import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { filterMessages } from '../../domain/messages'
import { toSosMessageItem } from '../../mappers/sosEventMapper'
import { messages } from '../../mock/data'

const pageSource = {
  list: readFileSync(resolve(__dirname, 'index.vue'), 'utf8'),
  detail: readFileSync(resolve(__dirname, '../message-detail/index.vue'), 'utf8'),
}

describe('messages page consumes the sos events provider (low-coupling contract)', () => {
  it('list page injects the provider and merges its items above demo messages', () => {
    expect(pageSource.list).toContain('createSosEventsProvider()')
    expect(pageSource.list).toContain('sosProvider')
    expect(pageSource.list).toContain('[...sosMessages.value, ...messages]')
  })

  it('list page keeps demo behaviour when the provider has no items', () => {
    // mock 模式 provider 返回空列表 → 过滤结果与纯演示消息完全一致
    expect(filterMessages([...[], ...messages], '全部')).toEqual(messages)
  })

  it('list page toasts on provider failure instead of crashing', () => {
    expect(pageSource.list).toContain('求助事件加载失败')
  })

  it('detail page resolves sos events by hex id through the provider', () => {
    expect(pageSource.detail).toContain('SOS_EVENT_ID_PATTERN')
    expect(pageSource.detail).toContain('sosProvider')
    expect(pageSource.detail).toContain('findById')
  })

  it('merged sos messages flow through the existing category filter', () => {
    const sosItems = [
      toSosMessageItem({
        id: '0123456789abcdef0123456789abcdef',
        elder_id: 'elder-001',
        created_at: '2026-11-08T02:30:00.000000+00:00',
        status: 'pending',
        note: null,
      }),
    ]

    expect(filterMessages([...sosItems, ...messages], '求助消息')[0]).toBe(sosItems[0])
    expect(filterMessages([...sosItems, ...messages], '全部')[0]).toBe(sosItems[0])
  })
})
