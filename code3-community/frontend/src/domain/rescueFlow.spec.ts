import { describe, expect, it } from 'vitest'
import { RESCUE_FLOW, RESCUE_STEPS, isTerminal, nextStatus, requiresResult, stamp } from './rescueFlow'

describe('rescueFlow', () => {
  it('按 4 态顺序推进', () => {
    expect(nextStatus('待响应')).toBe('已赶往现场')
    expect(nextStatus('已赶往现场')).toBe('已到达')
    expect(nextStatus('已到达')).toBe('已完成处理')
  })

  it('终态不再推进', () => {
    expect(isTerminal('已完成处理')).toBe(true)
    expect(nextStatus('已完成处理')).toBe('已完成处理')
  })

  it('只有从已到达进入完成处理时需要填写结果', () => {
    expect(requiresResult('待响应')).toBe(false)
    expect(requiresResult('已赶往现场')).toBe(false)
    expect(requiresResult('已到达')).toBe(true)
    expect(requiresResult('已完成处理')).toBe(false)
  })

  it('流程共 4 步且与步骤表对齐', () => {
    expect(RESCUE_FLOW).toHaveLength(4)
    expect(RESCUE_STEPS.map((step) => step.status)).toEqual(RESCUE_FLOW)
  })

  it('按钮文案与原型一致', () => {
    expect(RESCUE_STEPS.map((step) => step.action)).toEqual([
      '派员前往现场',
      '确认已到达',
      '完成处理',
      '关闭',
    ])
  })

  it('时间戳统一为 MM-DD HH:mm', () => {
    expect(stamp(new Date(2026, 9, 31, 9, 5))).toBe('10-31 09:05')
  })
})
