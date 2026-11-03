import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const MESSAGE_DETAIL = source('./message-detail/index.vue')
const MESSAGES_LIST = source('./messages/index.vue')
const ROUTES = source('../domain/routes.ts')
const PAGES_JSON = JSON.parse(source('../pages.json')) as {
  pages: Array<{ path: string }>
  tabBar: { list: Array<{ pagePath: string }> }
}

// 消息详情页禁止引入的能力（已读/回复/删除/转发/通知/求助等）
// 注意：社区通知 是消息数据中已有的 category 值，不在禁止之列
const FORBIDDEN_CAPABILITIES = ['已读', '回复', '删除', '转发', '发起求助', '标记', '已处理', '拨号', '定位']

describe('message detail page', () => {
  it('is registered as an ordinary page and not added to the tab bar', () => {
    expect(PAGES_JSON.pages.map((p) => p.path)).toContain('pages/message-detail/index')
    expect(PAGES_JSON.tabBar.list.map((t) => t.pagePath)).not.toContain('pages/message-detail/index')
  })

  it('exposes the message detail route as a constant', () => {
    expect(ROUTES).toContain("messageDetail: '/pages/message-detail/index'")
  })

  it('reads the existing message by id instead of copying data', () => {
    expect(MESSAGE_DETAIL).toContain("from '../../mock/data'")
    expect(MESSAGE_DETAIL).toContain('messages')
    expect(MESSAGE_DETAIL).toContain('.find(')
  })

  it('shows only the existing message fields', () => {
    for (const field of ['message.category', 'message.title', 'message.summary', 'message.time']) {
      expect(MESSAGE_DETAIL).toContain(field)
    }
  })

  it('shows an empty state for an invalid id', () => {
    expect(MESSAGE_DETAIL).toContain('未找到')
  })

  it('marks itself as demo data', () => {
    expect(MESSAGE_DETAIL).toContain('演示数据')
  })

  it('does not add read, reply, delete, forward, notify or help-request capabilities', () => {
    for (const term of FORBIDDEN_CAPABILITIES) {
      expect(MESSAGE_DETAIL, `消息详情页不应出现「${term}」`).not.toContain(term)
    }
  })
})

describe('message list cards link to the detail page', () => {
  it('wires every card to the detail route passing its own id', () => {
    expect(MESSAGES_LIST).toContain('GUARDIAN_SECONDARY_ROUTES')
    expect(MESSAGES_LIST).toContain('messageDetail')
    expect(MESSAGES_LIST).toContain('openMessageDetail')
    expect(MESSAGES_LIST).toContain('@tap')
    expect(MESSAGES_LIST).toContain('m.id')
  })

  it('reuses the navigator lock and failure toast', () => {
    expect(MESSAGES_LIST).toContain('createSecondaryNavigator')
  })
})
