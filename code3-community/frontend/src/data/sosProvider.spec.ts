import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiSosProvider, createMockSosProvider, createSosProvider } from '../data/sosProvider'
import type { SosEventDto, SosEventStatus } from '../types/sosEvents'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

const dto: SosEventDto = {
  id: 'sos-1',
  elder_id: 'elder-001',
  created_at: '2026-11-08T09:12:00',
  status: 'pending',
  note: null,
}

describe('sosProvider 列表', () => {
  it('mock provider returns demo events marked as demo data', () => {
    const provider = createMockSosProvider()
    expect(provider.mode).toBe('mock')
    return provider.list().then((events) => {
      expect(events.length).toBeGreaterThan(0)
      expect(events.every((event) => event.note.includes('演示数据'))).toBe(true)
    })
  })

  it('api provider maps dtos and sorts newest first', () => {
    const older: SosEventDto = { ...dto, id: 'sos-0', created_at: '2026-11-07T08:00:00' }
    const fetch = () => Promise.resolve([older, dto])
    const provider = createApiSosProvider(fetch)
    expect(provider.mode).toBe('api')
    return provider.list().then((events) => {
      expect(events[0]?.id).toBe('sos-1')
      expect(events[1]?.id).toBe('sos-0')
    })
  })

  it('factory defaults to mock and switches to api via mode argument', () => {
    expect(createSosProvider('mock').mode).toBe('mock')
    expect(createSosProvider('api').mode).toBe('api')
  })

  // 默认值来自环境变量，必须把 env 固定住再断言，避免本机 .env.local 让用例随环境漂移。
  it.each([
    ['mock', 'mock'],
    ['api', 'api'],
  ])('VITE_SOS_DATA_MODE=%s 时工厂产出 %s', async (env, expected) => {
    vi.stubEnv('VITE_SOS_DATA_MODE', env)
    vi.resetModules()
    const fresh = await import('../data/sosProvider')

    expect(fresh.createSosProvider().mode).toBe(expected)
  })

  it('视图保留后端原始状态，供页面判断可执行动作', () => {
    const provider = createApiSosProvider(() => Promise.resolve([dto]))
    return provider.list().then((events) => {
      expect(events[0]?.status).toBe('pending')
      expect(events[0]?.statusLabel).toBe('待响应')
    })
  })
})

describe('sosProvider 状态推进', () => {
  it('api provider 把推进请求原样转发给后端，并返回最新视图', async () => {
    const sent: { id: string; to: SosEventStatus; note?: string }[] = []
    const transitionFn = async (id: string, to: SosEventStatus, note?: string): Promise<SosEventDto> => {
      sent.push({ id, to, note })
      return { ...dto, status: to, note: note ?? null }
    }
    const provider = createApiSosProvider(
      () => Promise.resolve([dto]),
      'elder-001',
      transitionFn,
    )

    const result = await provider.transition('sos-1', 'processing', '已安排社区工作人员')

    expect(sent).toEqual([{ id: 'sos-1', to: 'processing', note: '已安排社区工作人员' }])
    expect(result).toMatchObject({ id: 'sos-1', status: 'processing', statusLabel: '处理中' })
  })

  it('mock provider 不伪造状态推进', async () => {
    const provider = createMockSosProvider()

    await expect(provider.transition('demo-sos-1', 'processing')).rejects.toThrow('演示模式')
  })
})
