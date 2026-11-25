import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 环境变量先于被测模块载入
vi.mock('../data/sosProvider', async () => {
  const actual = await vi.importActual<typeof import('../data/sosProvider')>('../data/sosProvider')
  return { ...actual }
})

import { canTransition, useSos } from './useSos'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function makeState() {
  return {
    demo: true,
    sos: null as string | null,
    reached: false,
    modal: null as string | null,
    feedback: '',
    currentRequest: null as any,
    apiRequests: [] as any[],
    requestsLoading: false,
    requestsFailed: false,
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

  it('refreshStatus pulls the latest backend status into the request timeline', async () => {
    vi.stubEnv('VITE_SOS_DATA_MODE', 'api')
    vi.stubEnv('VITE_ELDER_API_BASE_URL', 'http://mock-api')
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/v1/sos-events?')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([{ id: 'sos-42', elder_id: 'elder-001', created_at: '2026-11-14T00:00:00Z', status: 'processing', note: null }]),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'sos-42' }) })
      }),
    )
    vi.resetModules()
    const { useSos: freshUseSos } = await import('./useSos')
    const state = makeState()
    const sos = freshUseSos(state, () => {})
    expect(sos.isSosApi).toBe(true)
    state.modal = 'start'
    await sos.startHelp()
    const timelineBefore = state.currentRequest.timeline.length
    await sos.refreshStatus()
    expect(state.currentRequest.state).toContain('处理中')
    expect(state.currentRequest.timeline.length).toBe(timelineBefore + 1)
    expect(state.currentRequest.timeline.at(-1)?.[1]).toContain('处理进度更新')
    expect(state.feedback).toBe('')
  })

  it('refreshStatus 带出社区端写入的最新处置备注，且不重复堆叠', async () => {
    vi.stubEnv('VITE_SOS_DATA_MODE', 'api')
    vi.stubEnv('VITE_ELDER_API_BASE_URL', 'http://mock-api')
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/v1/sos-events?')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  id: 'sos-42',
                  elder_id: 'elder-001',
                  created_at: '2026-11-14T00:00:00Z',
                  status: 'resolved',
                  note: '已联系家属，确认平安',
                },
              ]),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'sos-42' }) })
      }),
    )
    vi.resetModules()
    const { useSos: freshUseSos } = await import('./useSos')
    const state = makeState()
    const sos = freshUseSos(state, () => {})
    state.modal = 'start'
    await sos.startHelp()

    await sos.refreshStatus()

    expect(state.currentRequest.state).toBe('已解决')
    const lines = state.currentRequest.timeline.map((entry: string[]) => entry[1])
    expect(lines.some((line: string) => line.includes('已联系家属，确认平安'))).toBe(true)

    await sos.refreshStatus()
    expect(
      state.currentRequest.timeline.filter((entry: string[]) =>
        entry[1].includes('已联系家属，确认平安'),
      ),
    ).toHaveLength(1)
  })

  it('refreshStatus writes feedback on failure and ignores local demo requests', async () => {
    vi.stubEnv('VITE_SOS_DATA_MODE', 'api')
    vi.stubEnv('VITE_ELDER_API_BASE_URL', 'http://mock-api')
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/v1/sos-events?')) {
          return Promise.resolve({ ok: false, status: 500 })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'sos-42' }) })
      }),
    )
    vi.resetModules()
    const { useSos: freshUseSos } = await import('./useSos')
    const state = makeState()
    const sos = freshUseSos(state, () => {})
    state.modal = 'start'
    await sos.startHelp()
    await sos.refreshStatus()
    expect(state.feedback).toContain('求助状态刷新失败')

    const localState = makeState()
    const localSos = freshUseSos(localState, () => {})
    localState.currentRequest = { id: 'local-1' }
    await localSos.refreshStatus()
    expect(localState.feedback).toBe('')
  })
})

describe('useSos request history', () => {
  it('loads api history and clears loading/failure flags', async () => {
    vi.stubEnv('VITE_SOS_DATA_MODE', 'api')
    vi.stubEnv('VITE_ELDER_API_BASE_URL', 'http://mock-api')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
      { id: 'sos-42', elder_id: 'elder-001', created_at: '2026-11-13T02:03:00Z', status: 'pending', note: '已按SOS按钮' },
    ]), { status: 200 })))
    vi.resetModules()
    const { useSos: freshUseSos } = await import('./useSos')
    const state = makeState()
    const sos = freshUseSos(state, () => {})

    await sos.loadRequests()

    expect(state.apiRequests).toHaveLength(1)
    expect(state.apiRequests[0]).toMatchObject({ id: 'sos-42', state: '已上报 · 等待处理' })
    expect(state.requestsLoading).toBe(false)
    expect(state.requestsFailed).toBe(false)
    expect(state.feedback).toBe('')
  })

  it('clears stale history, marks failure and keeps the provider message', async () => {
    vi.stubEnv('VITE_SOS_DATA_MODE', 'api')
    vi.stubEnv('VITE_ELDER_API_BASE_URL', 'http://mock-api')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })))
    vi.resetModules()
    const { useSos: freshUseSos } = await import('./useSos')
    const state = makeState()
    state.apiRequests = [{ id: 'old' }]
    const sos = freshUseSos(state, () => {})

    await sos.loadRequests()

    expect(state.apiRequests).toEqual([])
    expect(state.requestsLoading).toBe(false)
    expect(state.requestsFailed).toBe(true)
    expect(state.feedback).toBe('求助记录加载失败（HTTP 503）')
  })

  it('does nothing in mock mode', async () => {
    vi.stubEnv('VITE_SOS_DATA_MODE', 'mock')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.resetModules()
    const { useSos: freshUseSos } = await import('./useSos')
    const state = makeState()
    const sos = freshUseSos(state, () => {})

    await sos.loadRequests()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(state.apiRequests).toEqual([])
    expect(state.requestsLoading).toBe(false)
    expect(state.requestsFailed).toBe(false)
  })
})
