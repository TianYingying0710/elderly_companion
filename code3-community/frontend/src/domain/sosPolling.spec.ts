import { describe, expect, it, vi } from 'vitest'

import { SOS_POLL_INTERVAL_MS, createSosPolling } from './sosPolling'

describe('sosPolling', () => {
  it('默认周期落在 5~10 秒要求区间', () => {
    expect(SOS_POLL_INTERVAL_MS).toBeGreaterThanOrEqual(5000)
    expect(SOS_POLL_INTERVAL_MS).toBeLessThanOrEqual(10000)
  })

  it('重复 start 不叠加计时器', () => {
    const setIntervalFn = vi.fn((_fn: () => void, ms: number) => ({ ms }))
    const polling = createSosPolling({
      refresh: () => {},
      setIntervalFn,
      clearIntervalFn: () => {},
    })

    expect(polling.start()).toBe(true)
    expect(polling.start()).toBe(false)
    expect(setIntervalFn).toHaveBeenCalledTimes(1)
    expect(setIntervalFn.mock.calls[0][1]).toBe(SOS_POLL_INTERVAL_MS)
  })

  it('stop 只清理一次，重复 stop 不重复清理', () => {
    const clearIntervalFn = vi.fn()
    const polling = createSosPolling({
      refresh: () => {},
      setIntervalFn: () => 'handle-1',
      clearIntervalFn,
    })

    polling.start()
    expect(polling.stop()).toBe(true)
    expect(polling.stop()).toBe(false)
    expect(clearIntervalFn).toHaveBeenCalledTimes(1)
    expect(clearIntervalFn).toHaveBeenCalledWith('handle-1')
    expect(polling.isRunning()).toBe(false)
  })

  it('停止后可以重新启动，并拿到新句柄', () => {
    const handles = ['handle-1', 'handle-2']
    const clearIntervalFn = vi.fn()
    const polling = createSosPolling({
      refresh: () => {},
      setIntervalFn: () => handles.shift(),
      clearIntervalFn,
    })

    polling.start()
    polling.stop()
    expect(polling.start()).toBe(true)
    expect(polling.isRunning()).toBe(true)
    expect(clearIntervalFn).toHaveBeenCalledTimes(1)
  })

  it('计时器回调触发 refresh', () => {
    let fire: () => void = () => {}
    const refresh = vi.fn()
    const polling = createSosPolling({
      refresh,
      setIntervalFn: (fn: () => void) => {
        fire = fn
        return 'handle'
      },
      clearIntervalFn: () => {},
    })

    polling.start()
    fire()

    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
