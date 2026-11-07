// SOS 事件 api 层：直查 code1-elder 后端（单一事件源，低耦合原则 1/2）。
// 消费端不实现事件模型与状态流转，只读展示。

import { createApiClient } from './client'
import { SOS_EVENT_STATUSES, type SosEventDto, type SosEventStatus } from '../types/sosEvents'

const elderApiBaseUrl = import.meta.env.VITE_ELDER_API_BASE_URL ?? 'http://127.0.0.1:8001'
const elderApiRequest = createApiClient(elderApiBaseUrl)

function isSosEventStatus(value: unknown): value is SosEventStatus {
  return typeof value === 'string' && (SOS_EVENT_STATUSES as readonly string[]).includes(value)
}

/** 校验单条事件响应，字段集合必须与后端契约一致，多余字段忽略 */
export function parseSosEvent(raw: unknown): SosEventDto {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('invalid sos event payload')
  }
  const record = raw as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id.length === 0) throw new Error('invalid sos event id')
  if (typeof record.elder_id !== 'string') throw new Error('invalid sos event elder_id')
  if (typeof record.created_at !== 'string') throw new Error('invalid sos event created_at')
  if (!isSosEventStatus(record.status)) throw new Error('invalid sos event status')
  const note = record.note
  if (note !== null && typeof note !== 'string') throw new Error('invalid sos event note')
  return {
    id: record.id,
    elder_id: record.elder_id,
    created_at: record.created_at,
    status: record.status,
    note,
  }
}

export function getSosEvents(
  elderId: string,
  request: ReturnType<typeof createApiClient> = elderApiRequest,
): Promise<SosEventDto[]> {
  return request(`/api/v1/sos-events?elder_id=${encodeURIComponent(elderId)}`).then(
    (raw: unknown) => {
      if (!Array.isArray(raw)) throw new Error('invalid sos events payload')
      return raw.map(parseSosEvent)
    },
  )
}
