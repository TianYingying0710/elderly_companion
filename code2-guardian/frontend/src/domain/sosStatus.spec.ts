import { describe, expect, it } from 'vitest'

import { nextSosAction, sosStatusLabel } from './sosStatus'

describe('sosStatus', () => {
  it.each([
    ['pending', '待处理'],
    ['processing', '处理中'],
    ['resolved', '已解决'],
  ])('label(%s)→%s', (status, label) => {
    expect(sosStatusLabel(status)).toBe(label)
  })

  it('pending 的下一步是开始处理（无需备注）', () => {
    expect(nextSosAction('pending')).toEqual({ to: 'processing', label: '开始处理', asksNote: false })
  })

  it('processing 的下一步是标记已解决（可填备注）', () => {
    expect(nextSosAction('processing')).toEqual({ to: 'resolved', label: '标记已解决', asksNote: true })
  })

  it('resolved 无下一步动作', () => {
    expect(nextSosAction('resolved')).toBeNull()
  })
})
