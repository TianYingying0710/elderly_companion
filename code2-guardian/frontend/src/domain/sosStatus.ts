// SOS 状态展示纯函数：状态标签与下一步处置动作（状态机真源在 code1 后端）。

import type { SosEventStatus } from '../types/sosEvents'

const STATUS_LABELS: Record<SosEventStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
}

export function sosStatusLabel(status: SosEventStatus): string {
  return STATUS_LABELS[status]
}

export interface SosNextAction {
  to: SosEventStatus
  /** 按钮文案 */
  label: string
  /** 是否需要填写处理备注（标记已解决时） */
  asksNote: boolean
}

/** 下一步处置动作；已解决无动作返回 null */
export function nextSosAction(status: SosEventStatus): SosNextAction | null {
  if (status === 'pending') return { to: 'processing', label: '开始处理', asksNote: false }
  if (status === 'processing') return { to: 'resolved', label: '标记已解决', asksNote: true }
  return null
}
