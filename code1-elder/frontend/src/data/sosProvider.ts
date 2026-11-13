import { toRequestRecords } from '../mappers/sosMapper'
import type { RequestRecord } from '../types/domain'
import { SOS_EVENT_STATUSES, type SosEventDto, type SosEventStatus } from '../types/sos'

// SOS provider：mock/api 工厂（低耦合：api 模式调 code1 单一事件源，默认 mock 行为不变）
export type SosSourceMode = 'mock' | 'api'

export interface SosCreateResult {
  id: string
}

export interface SosProvider {
  mode: SosSourceMode
  create: () => Promise<SosCreateResult>
  /** 查询事件当前状态（处理进度展示用）；mock 模式不可用 */
  get: (id: string) => Promise<SosEventStatus>
  /** 真实求助记录列表；mock 模式返回空数组 */
  list: () => Promise<RequestRecord[]>
}

const elderApiBaseUrl = import.meta.env.VITE_ELDER_API_BASE_URL ?? 'http://127.0.0.1:8001'

const ELDER_ID = 'elder-001'

const STATUSES: readonly string[] = ['pending', 'processing', 'resolved']

function parseStatus(raw: unknown): SosEventStatus {
  const record = raw as { status?: unknown } | null
  if (typeof record?.status !== 'string' || !STATUSES.includes(record.status)) {
    throw new Error('SOS 状态响应格式异常')
  }
  return record.status as SosEventStatus
}

function parseSosEvent(raw: unknown): SosEventDto {
  const record = raw as Partial<SosEventDto> | null
  if (
    record === null ||
    typeof record.id !== 'string' ||
    record.id.length === 0 ||
    typeof record.elder_id !== 'string' ||
    typeof record.created_at !== 'string' ||
    typeof record.status !== 'string' ||
    !(SOS_EVENT_STATUSES as readonly string[]).includes(record.status) ||
    !(typeof record.note === 'string' || record.note === null)
  ) {
    throw new Error('SOS 事件响应格式异常')
  }
  return {
    id: record.id,
    elder_id: record.elder_id,
    created_at: record.created_at,
    status: record.status as SosEventStatus,
    note: record.note,
  }
}

export function createApiSosProvider(baseUrl = elderApiBaseUrl): SosProvider {
  return {
    mode: 'api',
    create: async () => {
      const response = await fetch(`${baseUrl}/api/v1/sos-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elder_id: ELDER_ID, note: '软件 SOS（演示环境触发）' }),
      })
      if (!response.ok) {
        throw new Error(`SOS 上报失败（HTTP ${response.status}）`)
      }
      const raw = (await response.json()) as { id?: unknown }
      if (typeof raw.id !== 'string' || raw.id.length === 0) {
        throw new Error('SOS 上报响应格式异常')
      }
      return { id: raw.id }
    },
    get: async (id) => {
      // 后端无单条查询路由，复用列表接口按 elder_id 过滤后取本条（演示规模足够）
      const response = await fetch(`${baseUrl}/api/v1/sos-events?elder_id=${encodeURIComponent(ELDER_ID)}`)
      if (!response.ok) {
        throw new Error(`SOS 状态查询失败（HTTP ${response.status}）`)
      }
      const raw = await response.json()
      if (!Array.isArray(raw)) throw new Error('SOS 状态响应格式异常')
      const found = raw.find((event) => (event as { id?: unknown })?.id === id)
      if (found === undefined) throw new Error(`SOS 状态查询失败（HTTP 404）`)
      return parseStatus(found)
    },
    list: async () => {
      const response = await fetch(`${baseUrl}/api/v1/sos-events?elder_id=${encodeURIComponent(ELDER_ID)}`)
      if (!response.ok) {
        throw new Error(`求助记录加载失败（HTTP ${response.status}）`)
      }
      const raw = await response.json()
      if (!Array.isArray(raw)) throw new Error('求助记录响应格式异常')
      return toRequestRecords(raw.map(parseSosEvent))
    },
  }
}

export function createMockSosProvider(): SosProvider {
  return {
    mode: 'mock',
    create: async () => ({ id: `local-${Date.now()}` }),
    get: async () => {
      throw new Error('演示模式没有真实求助事件')
    },
    list: async () => [],
  }
}

export function createSosProvider(mode: SosSourceMode = (import.meta.env.VITE_SOS_DATA_MODE as SosSourceMode) ?? 'mock'): SosProvider {
  return mode === 'api' ? createApiSosProvider() : createMockSosProvider()
}
