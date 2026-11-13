/** SOS 求助事件 DTO：与 code1-elder 后端 schemas/sos_events.py 对齐（snake_case）。 */

export const SOS_EVENT_STATUSES = ['pending', 'processing', 'resolved'] as const

export type SosEventStatus = (typeof SOS_EVENT_STATUSES)[number]

export interface SosEventDto {
  id: string
  elder_id: string
  created_at: string
  status: SosEventStatus
  note: string | null
}
