import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiSosProvider, createMockSosProvider } from './sosProvider'

afterEach(() => vi.unstubAllGlobals())

const event = (id: string, createdAt: string, status = 'processing') => ({
  id, elder_id: 'elder-001', created_at: createdAt, status, note: null,
})

describe('sos provider list', () => {
  it('reads elder-001 events and maps newest first', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([
      event('old', '2026-11-12T00:00:00Z'),
      event('new', '2026-11-14T00:00:00Z'),
    ]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const records = await createApiSosProvider('http://mock-api').list()

    expect(fetchMock).toHaveBeenCalledWith('http://mock-api/api/v1/sos-events?elder_id=elder-001')
    expect(records.map((item) => item.id)).toEqual(['new', 'old'])
    expect(records[0]).toMatchObject({
      title: '软件 SOS 求助',
      state: '处理中 · 家人/社区已介入',
      time: '11-14 08:00',
    })
  })

  it('rejects a non-array payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })))
    await expect(createApiSosProvider('http://mock-api').list()).rejects.toThrow('求助记录响应格式异常')
  })

  it('rejects a malformed event element', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{}]), { status: 200 })))
    await expect(createApiSosProvider('http://mock-api').list()).rejects.toThrow('SOS 事件响应格式异常')
  })

  it('surfaces non-2xx responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })))
    await expect(createApiSosProvider('http://mock-api').list()).rejects.toThrow('求助记录加载失败（HTTP 503）')
  })

  it('returns an empty list in mock mode without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(createMockSosProvider().list()).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
