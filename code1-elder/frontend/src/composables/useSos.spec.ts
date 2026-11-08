import { beforeEach, describe, expect, it, vi } from 'vitest'

// 环境变量先于被测模块载入
vi.mock('../data/sosProvider', async () => {
  const actual = await vi.importActual<typeof import('../data/sosProvider')>('../data/sosProvider')
  return { ...actual }
})

import { canTransition, useSos } from './useSos'

function makeState() {
  return {
    demo: true,
    sos: null as string | null,
    reached: false,
    modal: null as string | null,
    feedback: '',
    currentRequest: null as any,
    data: {
      requests: [] as any[],
      sos: {
        states: {
          sending: { title: '发送中' },
          delivered: { title: '已送达' },
          responded: { title: '已响应' },
        },
      },
    },
  }
}

describe('canTransition guard', () => {
  it('allows only legal sos state transitions', () => {
    expect(canTransition('sending', 'delivered')).toBe(true)
    expect(canTransition('sending', 'failed')).toBe(true)
    expect(canTransition('delivered', 'responded')).toBe(true)
    expect(canTransition('delivered', 'sending')).toBe(false)
    expect(canTransition(null, 'sending')).toBe(false)
  })
})

describe('useSos mock mode (default)', () => {
  let state: ReturnType<typeof makeState>
  let sos: ReturnType<typeof useSos>

  beforeEach(() => {
    vi.stubEnv('VITE_SOS_DATA_MODE', 'mock')
    vi.resetModules()
    state = makeState()
    sos = useSos(state, () => {})
  })

  it('blocks help when demo mode is off', () => {
    state.demo = false
    sos.help()
    expect(state.feedback).toContain('尚未接入')
    expect(state.modal).toBeNull()
  })

  it('startHelp records a demo request locally', async () => {
    state.modal = 'start'
    await sos.startHelp()
    expect(state.sos).toBe('sending')
    expect(state.data.requests).toHaveLength(1)
    expect(state.data.requests[0].title).toContain('模拟')
    expect(state.data.requests[0].id).toMatch(/^local-/)
  })

  it('startHelp does nothing unless modal is start', async () => {
    state.modal = null
    await sos.startHelp()
    expect(state.sos).toBeNull()
    expect(state.data.requests).toHaveLength(0)
  })

  it('progress follows legal transitions and flags reached', () => {
    state.modal = 'start'
    return sos.startHelp().then(() => {
      sos.progress('delivered')
      expect(state.sos).toBe('delivered')
      expect(state.reached).toBe(true)
      sos.progress('delivered')
      expect(state.currentRequest.timeline.length).toBe(2)
    })
  })

  it('cancelHelp closes the request as cancelled', () => {
    state.modal = 'start'
    return sos.startHelp().then(() => {
      state.modal = 'cancel'
      sos.cancelHelp()
      expect(state.sos).toBe('cancelled')
      expect(state.currentRequest.state).toContain('已取消')
    })
  })
})

describe('useSos api mode', () => {
  it('startHelp reports to backend and records the real event id', async () => {
    vi.stubEnv('VITE_SOS_DATA_MODE', 'api')
    vi.stubEnv('VITE_ELDER_API_BASE_URL', 'http://mock-api')
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'sos-42' }) }),
      ),
    )
    vi.resetModules()
    const { useSos: freshUseSos } = await import('./useSos')
    const state = makeState()
    const sos = freshUseSos(state, () => {})
    state.modal = 'start'
    await sos.startHelp()
    expect(fetch).toHaveBeenCalledOnce()
    expect(state.sos).toBe('sending')
    expect(state.data.requests[0].id).toBe('sos-42')
    expect(state.data.requests[0].title).toContain('演示')
    expect(state.currentRequest.timeline[0][1]).toContain('sos-42')
  })

  it('startHelp surfaces backend failure and does not create a request', async () => {
    vi.stubEnv('VITE_SOS_DATA_MODE', 'api')
    vi.stubEnv('VITE_ELDER_API_BASE_URL', 'http://mock-api')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 500 })),
    )
    vi.resetModules()
    const { useSos: freshUseSos } = await import('./useSos')
    const state = makeState()
    const sos = freshUseSos(state, () => {})
    state.modal = 'start'
    await sos.startHelp()
    expect(state.sos).toBeNull()
    expect(state.data.requests).toHaveLength(0)
    expect(state.feedback).toContain('SOS 上报失败')
  })

  it('progress and cancel are no-ops in api mode', async () => {
    vi.stubEnv('VITE_SOS_DATA_MODE', 'api')
    vi.stubEnv('VITE_ELDER_API_BASE_URL', 'http://mock-api')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'sos-7' }) })),
    )
    vi.resetModules()
    const { useSos: freshUseSos } = await import('./useSos')
    const state = makeState()
    const sos = freshUseSos(state, () => {})
    state.modal = 'start'
    await sos.startHelp()
    sos.progress('delivered')
    expect(state.sos).toBe('sending')
    state.modal = 'cancel'
    sos.cancelHelp()
    expect(state.sos).toBe('sending')
  })
})
