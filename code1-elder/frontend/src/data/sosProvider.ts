// SOS provider：mock/api 工厂（低耦合：api 模式调 code1 单一事件源，默认 mock 行为不变）
export type SosSourceMode = 'mock' | 'api'

export interface SosCreateResult {
  id: string
}

export interface SosProvider {
  mode: SosSourceMode
  create: () => Promise<SosCreateResult>
}

const elderApiBaseUrl = import.meta.env.VITE_ELDER_API_BASE_URL ?? 'http://127.0.0.1:8001'

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
  }
}

export function createMockSosProvider(): SosProvider {
  return {
    mode: 'mock',
    create: async () => ({ id: `local-${Date.now()}` }),
  }
}

export function createSosProvider(mode: SosSourceMode = (import.meta.env.VITE_SOS_DATA_MODE as SosSourceMode) ?? 'mock'): SosProvider {
  return mode === 'api' ? createApiSosProvider() : createMockSosProvider()
}
