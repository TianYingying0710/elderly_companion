import { describe, expect, it, vi } from 'vitest'

import { createSosPolling } from './sosAutoRefresh'
import type { MessageItem } from '../types'

function sosMessage(id: string): MessageItem {
  return {
    id,
    category: '老人求助',
    title: '母亲发起紧急求助',
    description: '按下了一键求助',
    time: '10:00',
    icon: 'sos',
  }
}

function setup(items: MessageItem[], fail = false) {
  const fetch = vi.fn(async () => {
    if (fail) throw new Error('HTTP 500')
    return items
  })
  const apply = vi.fn()
  const notifyNew = vi.fn()
  const setIntervalFn = vi.fn((_fn: () => void, ms: number) => ({ id: 1, ms }))
  const clearIntervalFn = vi.fn()
  const polling = createSosPolling({
    fetch,
    apply,
    notifyNew,
    intervalMs: 30_000,
    setIntervalFn,
    clearIntervalFn,
  })
  return { polling, fetch, apply, notifyNew, setIntervalFn, clearIntervalFn }
}

describe('createSosPolling（SOS 消息轮询）', () => {
  it('onShow 立即拉取一次并启动 30s 定时器；onHide 停止', async () => {
    const { polling, apply, setIntervalFn, clearIntervalFn } = setup([sosMessage('e1')])
    polling.onShow()
    await Promise.resolve()
    await Promise.resolve()
    expect(apply).toHaveBeenCalledWith([expect.objectContaining({ id: 'e1' })])
    expect(setIntervalFn).toHaveBeenCalledTimes(1)
    expect(setIntervalFn.mock.calls[0][1]).toBe(30_000)

    polling.onHide()
    expect(clearIntervalFn).toHaveBeenCalledTimes(1)
    // 再 onShow 重新启动定时器
    polling.onShow()
    expect(setIntervalFn).toHaveBeenCalledTimes(2)
  })

  it('重复 onShow 不叠加定时器；重复 onHide 不重复清理', () => {
    const { polling, setIntervalFn, clearIntervalFn } = setup([])
    polling.onShow()
    polling.onShow()
    polling.onShow()
    expect(setIntervalFn).toHaveBeenCalledTimes(1)
    polling.onHide()
    polling.onHide()
    expect(clearIntervalFn).toHaveBeenCalledTimes(1)
  })

  it('首次加载不提示新事件；之后出现新 id 才通知数量', async () => {
    const state = { items: [sosMessage('e1')] }
    const { polling, notifyNew } = setup([])

    const fetch = vi.fn(async () => state.items)
    const apply = vi.fn()
    const polling2 = createSosPolling({
      fetch,
      apply,
      notifyNew,
      intervalMs: 30_000,
      setIntervalFn: vi.fn(),
      clearIntervalFn: vi.fn(),
    })
    polling2.onShow()
    await Promise.resolve()
    await Promise.resolve()
    expect(notifyNew).not.toHaveBeenCalled()

    state.items = [sosMessage('e2'), sosMessage('e1')]
    void fetch
    polling2.refresh()
    await Promise.resolve()
    await Promise.resolve()
    expect(notifyNew).toHaveBeenCalledWith(1)
  })

  it('拉取失败静默：不 apply、不通知、不破坏既有列表与定时器', async () => {
    const { polling, apply, notifyNew, setIntervalFn } = setup([], true)
    polling.onShow()
    await Promise.resolve()
    await Promise.resolve()
    expect(apply).not.toHaveBeenCalled()
    expect(notifyNew).not.toHaveBeenCalled()
    expect(setIntervalFn).toHaveBeenCalledTimes(1)
  })

  it('refresh 直接调用可手动刷新（如 onShow 场景外）', async () => {
    const { polling, apply } = setup([sosMessage('e9')])
    await polling.refresh()
    expect(apply).toHaveBeenCalledTimes(1)
  })
})
