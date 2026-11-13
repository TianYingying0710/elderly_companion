import type { MessageItem } from '../types'

export interface SosPollingOptions {
  fetch: () => Promise<MessageItem[]>
  apply: (items: MessageItem[]) => void
  /** 发现新事件时回调（首次加载不提示，避免打开页面即打扰） */
  notifyNew: (count: number) => void
  intervalMs?: number
  setIntervalFn?: (fn: () => void, ms: number) => unknown
  clearIntervalFn?: (handle: unknown) => void
}

/**
 * SOS 消息轮询：页面可见期间每 intervalMs 拉取一次，不可见即停。
 * 无实时推送前提下的兜底方案；拉取失败静默保留旧列表（首次加载的失败提示由页面 onShow 负责）。
 */
export function createSosPolling(options: SosPollingOptions) {
  const intervalMs = options.intervalMs ?? 30_000
  const setTimer =
    options.setIntervalFn ?? ((fn: () => void, ms: number) => setInterval(fn, ms))
  const clearTimer =
    options.clearIntervalFn ?? ((handle: unknown) => clearInterval(handle as number))

  let timerHandle: unknown = null
  let knownIds = new Set<string | number>()

  async function refresh(): Promise<void> {
    const items = await options.fetch()
    const fresh = items.filter((item) => !knownIds.has(item.id))
    options.apply(items)
    if (knownIds.size > 0 && fresh.length > 0) {
      options.notifyNew(fresh.length)
    }
    knownIds = new Set(items.map((item) => item.id))
  }

  function onShow(): void {
    void refresh().catch(() => {})
    if (timerHandle === null) {
      timerHandle = setTimer(() => {
        void refresh().catch(() => {})
      }, intervalMs)
    }
  }

  function onHide(): void {
    if (timerHandle !== null) {
      clearTimer(timerHandle)
      timerHandle = null
    }
  }

  return { refresh, onShow, onHide }
}
