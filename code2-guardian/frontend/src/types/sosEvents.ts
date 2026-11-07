// SOS 求助事件 DTO：与 code1-elder 后端 /api/v1/sos-events 契约对齐。
// 字段集合以后端 tests/test_sos_events_api.py 的响应形态为基准。

export const SOS_EVENT_STATUSES = ['pending', 'processing', 'resolved'] as const

export type SosEventStatus = (typeof SOS_EVENT_STATUSES)[number]

export interface SosEventDto {
  id: string
  elder_id: string
  created_at: string
  status: SosEventStatus
  note: string | null
}
