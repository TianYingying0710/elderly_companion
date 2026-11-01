import { describe, expect, it } from 'vitest'

import type { ServiceTask, ServiceTaskStatus } from '../types/serviceTask'
import {
  SERVICE_STATUS_ORDER,
  canAccept,
  canComplete,
  cardActionLabel,
  detailActionLabel,
  groupServices,
  statusLabel,
} from './serviceFlow'

const task = (id: string, status: ServiceTaskStatus): ServiceTask => ({
  id,
  title: `${id} 标题`,
  elderName: '示例老人 A',
  category: '代办服务',
  scheduledAt: '2026-11-01T14:00:00+08:00',
  scheduledText: '11-01 14:00',
  location: 'XX 社区服务中心',
  description: '说明',
  status,
  record: null,
})

describe('serviceFlow', () => {
  it('三个分组且顺序固定为 pending → in_service → completed', () => {
    expect(SERVICE_STATUS_ORDER).toEqual(['pending', 'in_service', 'completed'])
  })

  it('中文文案只在展示函数中出现', () => {
    expect(statusLabel('pending')).toBe('待接收')
    expect(statusLabel('in_service')).toBe('服务中')
    expect(statusLabel('completed')).toBe('已完成')
    expect(statusLabel('bogus' as ServiceTaskStatus)).toBe('未知状态')
  })

  it('只有 pending 可接收、只有 in_service 可完成', () => {
    expect([canAccept('pending'), canAccept('in_service'), canAccept('completed')]).toEqual([
      true,
      false,
      false,
    ])
    expect([canComplete('pending'), canComplete('in_service'), canComplete('completed')]).toEqual([
      false,
      true,
      false,
    ])
  })

  it('卡片与弹层按钮文案与状态一致', () => {
    expect(cardActionLabel('pending')).toBe('接收任务')
    expect(cardActionLabel('in_service')).toBe('完成')
    expect(cardActionLabel('completed')).toBe('')
    expect(detailActionLabel('pending')).toBe('接收任务')
    expect(detailActionLabel('in_service')).toBe('完成并保存记录')
    expect(detailActionLabel('completed')).toBe('关闭')
  })

  it('分组保留空组，便于渲染「暂无任务」', () => {
    const groups = groupServices([task('a', 'pending'), task('c', 'completed')])

    expect(groups).toHaveLength(3)
    expect(groups.map((group) => group.label)).toEqual(['待接收', '服务中', '已完成'])
    expect(groups[0].items.map((item) => item.id)).toEqual(['a'])
    expect(groups[1].items).toHaveLength(0)
    expect(groups[2].items.map((item) => item.id)).toEqual(['c'])
  })

  it('服务端状态改变后任务落到对应分组', () => {
    const groups = groupServices([task('a', 'in_service')])

    expect(groups[0].items).toHaveLength(0)
    expect(groups[1].items.map((item) => item.id)).toEqual(['a'])
    expect(groups[2].items).toHaveLength(0)
  })
})
