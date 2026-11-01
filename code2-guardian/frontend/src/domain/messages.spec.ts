import { describe, expect, it } from 'vitest'
import { filterMessages, MESSAGE_FILTERS } from './messages'
import type { MessageItem } from '../types'

const items: MessageItem[] = [
  { id: 1, category: '健康提醒', title: '健康提醒', summary: 'a', time: '08:30' },
  { id: 2, category: '求助消息', title: '求助消息', summary: 'b', time: '昨天 19:42' },
  { id: 3, category: '社区通知', title: '社区通知', summary: 'c', time: '10-29' },
  { id: 4, category: '系统消息', title: '系统消息', summary: 'd', time: '10-28' },
]

describe('MESSAGE_FILTERS', () => {
  it('只暴露 UI 图上的四个筛选胶囊', () => {
    expect(MESSAGE_FILTERS).toEqual(['全部', '健康提醒', '求助消息', '社区通知'])
  })
})

describe('filterMessages', () => {
  it('全部：原样返回所有消息', () => {
    expect(filterMessages(items, '全部')).toEqual(items)
  })

  it('按分类过滤：健康提醒', () => {
    expect(filterMessages(items, '健康提醒').map((m) => m.id)).toEqual([1])
  })

  it('按分类过滤：求助消息', () => {
    expect(filterMessages(items, '求助消息').map((m) => m.id)).toEqual([2])
  })

  it('按分类过滤：社区通知', () => {
    expect(filterMessages(items, '社区通知').map((m) => m.id)).toEqual([3])
  })

  it('系统消息不在筛选胶囊中，选任一分类都不包含它', () => {
    const all = [
      ...filterMessages(items, '健康提醒'),
      ...filterMessages(items, '求助消息'),
      ...filterMessages(items, '社区通知'),
    ]
    expect(all.find((m) => m.category === '系统消息')).toBeUndefined()
  })

  it('空列表返回空数组', () => {
    expect(filterMessages([], '健康提醒')).toEqual([])
  })
})
