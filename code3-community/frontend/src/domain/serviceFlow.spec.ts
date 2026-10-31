import { describe, expect, it } from 'vitest'
import { SERVICE_GROUPS, groupServices, nextServiceStatus, serviceActionLabel, serviceCardLabel } from './serviceFlow'
import type { ServiceTask } from '../types/community'

const task = (id: string, status: ServiceTask['status']): ServiceTask => ({
  id,
  title: `${id} 标题`,
  name: '某老人',
  type: '代办服务',
  time: '今天 10:00',
  location: '社区服务中心',
  description: '说明',
  status,
})

describe('serviceFlow', () => {
  it('三个分组且顺序固定', () => {
    expect(SERVICE_GROUPS).toEqual(['待接收', '服务中', '已完成'])
  })

  it('状态按 待接收 → 服务中 → 已完成 推进', () => {
    expect(nextServiceStatus('待接收')).toBe('服务中')
    expect(nextServiceStatus('服务中')).toBe('已完成')
  })

  it('已完成不再推进', () => {
    expect(nextServiceStatus('已完成')).toBe('已完成')
  })

  it('弹层按钮与卡片提示文案与原型一致', () => {
    expect(serviceActionLabel('待接收')).toBe('接收任务')
    expect(serviceActionLabel('服务中')).toBe('完成并保存记录')
    expect(serviceActionLabel('已完成')).toBe('关闭')
    expect(serviceCardLabel('待接收')).toBe('接收任务')
    expect(serviceCardLabel('服务中')).toBe('完成')
    expect(serviceCardLabel('已完成')).toBe('')
  })

  it('分组保留空组，便于渲染「暂无任务」', () => {
    const groups = groupServices([task('a', '待接收'), task('b', '已完成')])
    expect(groups).toHaveLength(3)
    expect(groups[0].items.map((item) => item.id)).toEqual(['a'])
    expect(groups[1].items).toHaveLength(0)
    expect(groups[2].items.map((item) => item.id)).toEqual(['b'])
  })

  it('状态变化后卡片落到对应分组', () => {
    const tasks = [task('a', '待接收')]
    tasks[0].status = nextServiceStatus(tasks[0].status)
    const groups = groupServices(tasks)
    expect(groups[0].items).toHaveLength(0)
    expect(groups[1].items.map((item) => item.id)).toEqual(['a'])
  })
})
