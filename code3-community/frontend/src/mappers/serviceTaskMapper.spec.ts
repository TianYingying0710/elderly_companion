import { describe, expect, it } from 'vitest'

import type { ServiceTaskDraft, ServiceTaskDto } from '../types/serviceTask'
import {
  ServiceTaskMappingError,
  formatScheduled,
  toCreatePayload,
  toServiceTask,
  toServiceTaskList,
} from './serviceTaskMapper'

const dto = (overrides: Partial<ServiceTaskDto> = {}): ServiceTaskDto => ({
  id: 'task-1',
  title: '代缴水电费',
  elder_name: '示例老人 B',
  category: '代办服务',
  scheduled_at: '2026-11-01T06:30:00+00:00',
  location: 'XX 社区服务中心窗口',
  description: '按老人委托到窗口代缴本月水电费',
  status: 'pending',
  note: null,
  ...overrides,
})

const draft = (overrides: Partial<ServiceTaskDraft> = {}): ServiceTaskDraft => ({
  title: '公益课程线下答疑',
  elderName: '示例老人 A',
  category: '数字助老',
  scheduledDate: '2026-11-01',
  scheduledTime: '14:30',
  location: 'XX 社区养老服务中心 2 楼教室',
  description: '现场一对一指导',
  ...overrides,
})

describe('serviceTaskMapper', () => {
  it('把 DTO 字段映射为 ViewModel', () => {
    const task = toServiceTask(dto())

    expect(task).toMatchObject({
      id: 'task-1',
      title: '代缴水电费',
      elderName: '示例老人 B',
      category: '代办服务',
      location: 'XX 社区服务中心窗口',
      description: '按老人委托到窗口代缴本月水电费',
      status: 'pending',
    })
    expect(task.scheduledAt).toBe('2026-11-01T06:30:00+00:00')
  })

  it('note 映射为 record，null 保持 null', () => {
    expect(toServiceTask(dto()).record).toBeNull()
    expect(toServiceTask(dto({ note: '已代缴', status: 'completed' })).record).toBe('已代缴')
  })

  it('服务时间按 +08:00 展示，跨 UTC 日界也正确', () => {
    expect(formatScheduled('2026-11-01T06:30:00+00:00')).toBe('11-01 14:30')
    expect(formatScheduled('2026-10-31T20:05:00+00:00')).toBe('11-01 04:05')
    expect(formatScheduled('2026-11-01T14:30:00+08:00')).toBe('11-01 14:30')
  })

  it('缺少时区的时间被拒绝', () => {
    expect(() => formatScheduled('2026-11-01T14:30:00')).toThrow(ServiceTaskMappingError)
    expect(() => toServiceTask(dto({ scheduled_at: '2026-11-01 14:30' }))).toThrow(
      ServiceTaskMappingError,
    )
  })

  it('未知状态被拒绝而不是回落', () => {
    expect(() => toServiceTask(dto({ status: '待接收' }))).toThrow(ServiceTaskMappingError)
    expect(() => toServiceTask(dto({ status: '' }))).toThrow(ServiceTaskMappingError)
  })

  it('缺失字段被拒绝', () => {
    expect(() => toServiceTask(dto({ title: '   ' }))).toThrow(ServiceTaskMappingError)
    expect(() => toServiceTask(dto({ elder_name: '' }))).toThrow(ServiceTaskMappingError)
    expect(() => toServiceTask(dto({ id: '' }))).toThrow(ServiceTaskMappingError)
  })

  it('列表映射逐条转换，非数组不静默返回空数组', () => {
    expect(toServiceTaskList([dto(), dto({ id: 'task-2' })])).toHaveLength(2)
    expect(() => toServiceTaskList({ items: [] })).toThrow(ServiceTaskMappingError)
    expect(() => toServiceTaskList(null)).toThrow(ServiceTaskMappingError)
  })

  it('表单草稿拼成带 +08:00 的 ISO 时间', () => {
    const payload = toCreatePayload(draft())

    expect(payload.scheduled_at).toBe('2026-11-01T14:30:00+08:00')
    expect(payload.elder_name).toBe('示例老人 A')
    expect(payload.title).toBe('公益课程线下答疑')
    expect(payload).not.toHaveProperty('status')
    expect(payload).not.toHaveProperty('id')
    expect(payload).not.toHaveProperty('note')
  })

  it('草稿缺字段或日期非法时报错', () => {
    expect(() => toCreatePayload(draft({ scheduledTime: '' }))).toThrow(ServiceTaskMappingError)
    expect(() => toCreatePayload(draft({ scheduledDate: '2026-02-30' }))).toThrow(
      ServiceTaskMappingError,
    )
    expect(() => toCreatePayload(draft({ scheduledTime: '25:00' }))).toThrow(ServiceTaskMappingError)
    expect(() => toCreatePayload(draft({ title: '  ' }))).toThrow(ServiceTaskMappingError)
  })

  it('与后端一致的上限内文本可以提交', () => {
    const payload = toCreatePayload(
      draft({
        title: '标'.repeat(100),
        elderName: '老'.repeat(100),
        category: '类'.repeat(100),
        location: '地'.repeat(200),
        description: '述'.repeat(2000),
      }),
    )

    expect(payload.title).toHaveLength(100)
    expect(payload.elder_name).toHaveLength(100)
    expect(payload.category).toHaveLength(100)
    expect(payload.location).toHaveLength(200)
    expect(payload.description).toHaveLength(2000)
  })

  it('上限按去掉首尾空格后的长度计算', () => {
    const payload = toCreatePayload(draft({ title: '标'.repeat(100) + '   ' }))

    expect(payload.title).toHaveLength(100)
  })

  it('超过后端上限的文本在提交前报错', () => {
    expect(() => toCreatePayload(draft({ title: '标'.repeat(101) }))).toThrow(
      ServiceTaskMappingError,
    )
    expect(() => toCreatePayload(draft({ elderName: '老'.repeat(101) }))).toThrow(
      ServiceTaskMappingError,
    )
    expect(() => toCreatePayload(draft({ category: '类'.repeat(101) }))).toThrow(
      ServiceTaskMappingError,
    )
    expect(() => toCreatePayload(draft({ location: '地'.repeat(201) }))).toThrow(
      ServiceTaskMappingError,
    )
    expect(() => toCreatePayload(draft({ description: '述'.repeat(2001) }))).toThrow(
      ServiceTaskMappingError,
    )
  })

  it('超限错误信息指明字段与上限', () => {
    expect(() => toCreatePayload(draft({ location: '地'.repeat(201) }))).toThrow(
      /location.*200/,
    )
  })
})
