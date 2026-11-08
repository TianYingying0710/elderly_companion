// SOS 事件领域类型（消费端只读，状态流转在 code1 后端，低耦合原则 1/4）

export const SOS_EVENT_STATUSES = ['pending', 'processing', 'resolved'] as const

export type SosEventStatus = (typeof SOS_EVENT_STATUSES)[number]

export interface SosEventDto {
  id: string
  elder_id: string
  created_at: string
  status: SosEventStatus
  note: string | null
}

export type SosEventStatusKind = 'red' | 'blue' | 'green'

export interface SosEventView {
  id: string
  elderId: string
  time: string
  statusLabel: string
  statusKind: SosEventStatusKind
  note: string
}
