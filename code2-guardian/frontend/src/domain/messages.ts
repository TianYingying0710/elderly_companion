// 消息筛选纯函数：不依赖 Vue，可被 vitest 直接覆盖。

import type { MessageFilter, MessageItem } from '../types'

/** UI 上暴露的筛选胶囊（按 UI 图：全部 / 健康提醒 / 求助消息 / 社区通知） */
export const MESSAGE_FILTERS: MessageFilter[] = ['全部', '健康提醒', '求助消息', '社区通知']

export function filterMessages(items: MessageItem[], filter: MessageFilter): MessageItem[] {
  if (filter === '全部') {
    return items
  }
  return items.filter((m) => m.category === filter)
}
