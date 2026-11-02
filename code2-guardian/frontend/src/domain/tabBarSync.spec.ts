import { describe, expect, it, vi } from 'vitest'
import { syncTabBar } from './tabBarSync'

describe('syncTabBar', () => {
  it('tabBar 为 undefined 时不做任何事', () => {
    expect(() => syncTabBar(undefined)).not.toThrow()
  })

  it('tabBar 缺少 syncSelected 方法时不调用', () => {
    expect(() => syncTabBar({})).not.toThrow()
  })

  it('syncSelected 不是函数时不调用', () => {
    const tabBar = { syncSelected: 'not-a-function' } as unknown as {
      syncSelected?: () => void
    }
    expect(() => syncTabBar(tabBar)).not.toThrow()
  })

  it('存在 syncSelected 方法时调用一次', () => {
    const syncSelected = vi.fn()
    syncTabBar({ syncSelected })
    expect(syncSelected).toHaveBeenCalledTimes(1)
  })
})
