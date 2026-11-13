// SOS provider：mock/api 工厂（低耦合：api 模式调 code1 单一事件源，默认 mock 行为不变）
export type SosSourceMode = 'mock' | 'api'

export type SosEventStatus = 'pending' | 'processing' | 'resolved'

export interface SosCreateResult {
  id: string
}

export interface SosProvider {
  mode: SosSourceMode
  create: () => Promise<SosCreateResult>
  /** 查询事件当前状态（处理进度展示用）；mock 模式不可用 */
  get: (id: string) => Promise<SosEventStatus>
}

const elderApiBaseUrl = import.meta.env.VITE_ELDER_API_BASE_URL ?? 'http://127.0.0.1:8001'

const STATUSES: readonly string[] = ['pending', 'processing', 'resolved']

function parseStatus(raw: unknown): SosEventStatus {
  const record = raw as { status?: unknown } | null
  if (typeof record?.status !== 'string' || !STATUSES.includes(record.status)) {
    throw new Error('SOS 状态响应格式异常')
  }
  return record.status as SosEventStatus
}

export function createApiSosProvider(baseUrl = elderApiBaseUrl): SosProvider {
  return {
    mode: 'api',
    create: async () => {
      const response = await fetch(`${baseUrl}/api/v1/sos-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elder_id: 'elder-001', note: '软件 SOS（演示环境触发）' }),
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
      const response = await fetch(`${baseUrl}/api/v1/sos-events?elder_id=${encodeURIComponent('elder-001')}`)
      if (!response.ok) {
        throw new Error(`SOS 状态查询失败（HTTP ${response.status}）`)
      }
      const raw = await response.json()
      if (!Array.isArray(raw)) throw new Error('SOS 状态响应格式异常')
      const found = raw.find((event) => (event as { id?: unknown })?.id === id)
      if (found === undefined) throw new Error(`SOS 状态查询失败（HTTP 404）`)
      return parseStatus(found)
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
  }
}

export function createSosProvider(mode: SosSourceMode = (import.meta.env.VITE_SOS_DATA_MODE as SosSourceMode) ?? 'mock'): SosProvider {
  return mode === 'api' ? createApiSosProvider() : createMockSosProvider()
}
