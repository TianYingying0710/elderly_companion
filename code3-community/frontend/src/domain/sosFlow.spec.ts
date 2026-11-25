import { describe, expect, it } from 'vitest'

import { ApiError } from '../api/client'
import type { SosEventStatus, SosEventView } from '../types/sosEvents'
import { countPending, nextSosStatus, sosActionLabel, sosErrorMessage } from './sosFlow'

function view(id: string, status: SosEventStatus): SosEventView {
  return {
    id,
    elderId: 'elder-001',
    time: '2026-11-14 10:00:00',
    status,
    statusLabel: status,
    statusKind: 'blue',
    note: '',
  }
}

describe('sosFlow 状态推进', () => {
  it('pending → processing → resolved，已解决没有下一步', () => {
    expect(nextSosStatus('pending')).toBe('processing')
    expect(nextSosStatus('processing')).toBe('resolved')
    expect(nextSosStatus('resolved')).toBeNull()
  })

  it('动作文案与状态一一对应', () => {
    expect(sosActionLabel('pending')).toBe('开始处理')
    expect(sosActionLabel('processing')).toBe('完成处理')
    expect(sosActionLabel('resolved')).toBeNull()
  })
})

describe('sosFlow 待响应统计', () => {
  it('只统计 pending，不把处理中/已完成算进去', () => {
    const events = [view('1', 'pending'), view('2', 'processing'), view('3', 'resolved'), view('4', 'pending')]
    expect(countPending(events)).toBe(2)
  })

  it('空列表为 0', () => {
    expect(countPending([])).toBe(0)
  })
})

describe('sosFlow 错误文案', () => {
  it('404 提示事件不存在，409 提示状态已变化并刷新', () => {
    expect(sosErrorMessage(new ApiError(404, 'sos_event_not_found', ''))).toContain('不存在')
    expect(sosErrorMessage(new ApiError(409, 'invalid_state_transition', ''))).toContain('状态已变化')
  })

  it('503 提示服务暂不可用，网络错误提示检查网络', () => {
    expect(sosErrorMessage(new ApiError(503, 'sos_storage_unavailable', ''))).toContain('暂不可用')
    expect(sosErrorMessage(new ApiError(0, 'network', 'request:fail'))).toContain('网络')
  })

  it('本地校验错误保留原文，不降级成通用失败文案', () => {
    expect(sosErrorMessage(new Error('演示模式没有真实求助事件，无法推进状态'))).toBe(
      '演示模式没有真实求助事件，无法推进状态',
    )
  })
})
