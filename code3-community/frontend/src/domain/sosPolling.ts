// SOS 短轮询：页面可见期间定时拉取，不可见立即停止；不实现 WebSocket。
// 计时器句柄由本模块独占，重复 start 不会叠加（这也是页面 onShow 可重复调用的前提）。

export interface SosPollingOptions {
  refresh: () => void | Promise<void>
  intervalMs?: number
  setIntervalFn?: (fn: () => void, ms: number) => unknown
  clearIntervalFn?: (handle: unknown) => void
}

/** 5~10 秒区间内的取值：社区端救援页轮询周期 */
export const SOS_POLL_INTERVAL_MS = 8000

export interface SosPolling {
  start: () => boolean
  stop: () => boolean
  isRunning: () => boolean
  intervalMs: number
}

export function createSosPolling(options: SosPollingOptions): SosPolling {
  const intervalMs = options.intervalMs ?? SOS_POLL_INTERVAL_MS
  const setTimer =
    options.setIntervalFn ?? ((fn: () => void, ms: number) => setInterval(fn, ms))
  const clearTimer = options.clearIntervalFn ?? ((handle: unknown) => clearInterval(handle as number))

  let handle: unknown = null

  function start(): boolean {
    if (handle !== null) return false
    handle = setTimer(() => {
      void options.refresh()
    }, intervalMs)
    return true
  }

  function stop(): boolean {
    if (handle === null) return false
    clearTimer(handle)
    handle = null
    return true
  }

  return { start, stop, isRunning: () => handle !== null, intervalMs }
}
