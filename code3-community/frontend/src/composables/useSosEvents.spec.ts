import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../api/client'
import type { SosEventProvider } from '../data/sosProvider'
import type { SosEventStatus, SosEventView } from '../types/sosEvents'
import { useSosEvents } from './useSosEvents'

function view(id: string, status: SosEventStatus, note = ''): SosEventView {
  return {
    id,
    elderId: 'elder-001',
    time: '2026-11-14 10:00:00',
    status,
    statusLabel: status === 'pending' ? '待响应' : status === 'processing' ? '处理中' : '已完成处理',
    statusKind: 'blue',
    note,
  }
}

function providerOf(overrides: Partial<SosEventProvider> = {}): SosEventProvider {
  return {
    mode: 'api',
    list: async () => [view('sos-1', 'pending')],
    transition: async (id: string, to: SosEventStatus) => view(id, to),
    ...overrides,
  }
}

describe('useSosEvents 待响应数量', () => {
  it('API 模式只统计后端返回的 pending 事件', async () => {
    const store = useSosEvents(
      providerOf({ list: async () => [view('a', 'pending'), view('b', 'processing'), view('c', 'pending')] }),
    )

    await store.refresh()

    expect(store.pendingCount.value).toBe(2)
  })

  it('不做本地假数据补充：后端为空就是 0', async () => {
    const store = useSosEvents(providerOf({ list: async () => [] }))

    await store.refresh()

    expect(store.events.value).toEqual([])
    expect(store.pendingCount.value).toBe(0)
  })
})

describe('useSosEvents 状态推进', () => {
  it('pending → processing 成功后刷新为后端最新状态', async () => {
    let remote = [view('sos-1', 'pending')]
    const list = vi.fn(async () => remote)
    const transition = vi.fn(async (id: string, to: SosEventStatus) => {
      remote = [view(id, to)]
      return remote[0]
    })
    const store = useSosEvents(providerOf({ list, transition }))

    await store.refresh()
    const ok = await store.transition('sos-1', 'processing')

    expect(ok).toBe(true)
    expect(transition).toHaveBeenCalledWith('sos-1', 'processing', undefined)
    expect(store.events.value[0].status).toBe('processing')
    expect(store.actionError.value).toBe('')
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('processing → resolved 携带备注', async () => {
    let remote = [view('sos-1', 'processing')]
    const transition = vi.fn(async (id: string, to: SosEventStatus, note?: string) => {
      remote = [view(id, to, note ?? '')]
      return remote[0]
    })
    const store = useSosEvents(providerOf({ list: async () => remote, transition }))

    await store.refresh()
    const ok = await store.transition('sos-1', 'resolved', '已联系家属')

    expect(ok).toBe(true)
    expect(transition).toHaveBeenCalledWith('sos-1', 'resolved', '已联系家属')
    expect(store.events.value[0].note).toBe('已联系家属')
  })

  it('未在列表中的事件不发起请求', async () => {
    const transition = vi.fn()
    const store = useSosEvents(providerOf({ list: async () => [], transition }))

    await store.refresh()
    const ok = await store.transition('ghost', 'processing')

    expect(ok).toBe(false)
    expect(transition).not.toHaveBeenCalled()
    expect(store.actionError.value).toContain('不存在')
  })

  it('非法状态回退在本地即拦截，不打后端', async () => {
    const transition = vi.fn()
    const store = useSosEvents(providerOf({ list: async () => [view('sos-1', 'resolved')], transition }))

    await store.refresh()
    const ok = await store.transition('sos-1', 'processing')

    expect(ok).toBe(false)
    expect(transition).not.toHaveBeenCalled()
    expect(store.actionError.value).toContain('状态已变化')
  })

  it('重复点击并发提交只推进一次', async () => {
    let remote = [view('sos-1', 'pending')]
    let release = () => {}
    const transition = vi.fn(
      (id: string, to: SosEventStatus) =>
        new Promise<SosEventView>((resolve) => {
          release = () => {
            remote = [view(id, to)]
            resolve(remote[0])
          }
        }),
    )
    const store = useSosEvents(providerOf({ list: async () => remote, transition }))

    await store.refresh()
    const first = store.transition('sos-1', 'processing')
    const second = await store.transition('sos-1', 'processing')
    release()
    const firstResult = await first

    expect(second).toBe(false)
    expect(firstResult).toBe(true)
    expect(transition).toHaveBeenCalledTimes(1)
  })

  it('409 冲突：提示已刷新并保留列表', async () => {
    const list = vi.fn(async () => [view('sos-1', 'pending')])
    const transition = vi.fn(async () => {
      throw new ApiError(409, 'invalid_state_transition', 'conflict')
    })
    const store = useSosEvents(providerOf({ list, transition }))

    await store.refresh()
    const ok = await store.transition('sos-1', 'processing')

    expect(ok).toBe(false)
    expect(store.actionError.value).toContain('状态已变化')
    expect(store.events.value).toHaveLength(1)
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('503 不可用：明确报错，不假装成功', async () => {
    const store = useSosEvents(
      providerOf({
        list: async () => [view('sos-1', 'pending')],
        transition: async () => {
          throw new ApiError(503, 'sos_storage_unavailable', 'unavailable')
        },
      }),
    )

    await store.refresh()
    const ok = await store.transition('sos-1', 'processing')

    expect(ok).toBe(false)
    expect(store.actionError.value).toContain('暂不可用')
    expect(store.events.value[0].status).toBe('pending')
  })

  it('推进成功后清空上一次操作错误', async () => {
    let fail = true
    const store = useSosEvents(
      providerOf({
        list: async () => [view('sos-1', 'pending')],
        transition: async (id: string, to: SosEventStatus) => {
          if (fail) throw new ApiError(503, 'sos_storage_unavailable', '')
          return view(id, to)
        },
      }),
    )

    await store.refresh()
    await store.transition('sos-1', 'processing')
    expect(store.actionError.value).not.toBe('')

    fail = false
    await store.transition('sos-1', 'processing')
    expect(store.actionError.value).toBe('')
  })
})

describe('useSosEvents 刷新失败', () => {
  it('已有列表时刷新失败保留旧数据并给出明确提示', async () => {
    let calls = 0
    const list = vi.fn(async () => {
      calls += 1
      if (calls === 1) return [view('sos-1', 'pending')]
      throw new ApiError(0, 'network', 'request:fail')
    })
    const store = useSosEvents(providerOf({ list }))

    await store.refresh()
    await store.refresh()

    expect(store.events.value).toHaveLength(1)
    expect(store.errorMessage.value).toContain('刷新失败')
    expect(store.errorMessage.value).toContain('网络')
  })

  it('首次加载失败显示错误且列表为空，不塞假数据', async () => {
    const store = useSosEvents(
      providerOf({
        list: async () => {
          throw new ApiError(503, 'sos_storage_unavailable', '')
        },
      }),
    )

    await store.refresh()

    expect(store.events.value).toEqual([])
    expect(store.errorMessage.value).toContain('暂不可用')
    expect(store.loading.value).toBe(false)
  })
})

describe('useSosEvents 轮询生命周期', () => {
  it('mock 模式不启动轮询、不请求后端', async () => {
    const list = vi.fn(async () => [])
    const setIntervalFn = vi.fn()
    const store = useSosEvents(providerOf({ mode: 'mock', list }), { setIntervalFn })

    store.startPolling()

    expect(setIntervalFn).not.toHaveBeenCalled()
    expect(list).not.toHaveBeenCalled()
    expect(store.isPolling()).toBe(false)
  })

  it('api 模式启动即刷新一次，重复 start 不叠加计时器', async () => {
    const list = vi.fn(async () => [view('sos-1', 'pending')])
    const setIntervalFn = vi.fn(() => 'handle')
    const store = useSosEvents(providerOf({ list }), { setIntervalFn, clearIntervalFn: () => {} })

    store.startPolling()
    store.startPolling()
    await Promise.resolve()

    expect(setIntervalFn).toHaveBeenCalledTimes(1)
    expect(list).toHaveBeenCalledTimes(2)
    expect(store.isPolling()).toBe(true)
  })

  it('stopPolling 停止计时器，页面隐藏后不再轮询', async () => {
    const clearIntervalFn = vi.fn()
    const store = useSosEvents(providerOf(), {
      setIntervalFn: () => 'handle',
      clearIntervalFn,
    })

    store.startPolling()
    store.stopPolling()

    expect(clearIntervalFn).toHaveBeenCalledWith('handle')
    expect(store.isPolling()).toBe(false)
  })
})
