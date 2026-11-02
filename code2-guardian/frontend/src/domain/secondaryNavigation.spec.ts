import { describe, expect, it, vi } from 'vitest'

import { createSecondaryNavigator, NAVIGATION_FAILED_MESSAGE } from './secondaryNavigation'

function createHarness() {
  const navigateTo = vi.fn<(options: {
    url: string
    fail: () => void
    complete: () => void
  }) => void>()
  const showToast = vi.fn<(options: { title: string; icon: 'none' }) => void>()
  const navigator = createSecondaryNavigator({ navigateTo, showToast })
  return { navigateTo, showToast, navigator }
}

describe('secondary page navigator', () => {
  it('opens the requested route once', () => {
    const { navigateTo, navigator } = createHarness()

    expect(navigator.open('/pages/elder-detail/index')).toBe(true)
    expect(navigateTo).toHaveBeenCalledTimes(1)
    expect(navigateTo.mock.calls[0][0].url).toBe('/pages/elder-detail/index')
  })

  it('ignores repeated taps while a navigation is still in flight', () => {
    const { navigateTo, navigator } = createHarness()

    expect(navigator.open('/pages/health-trend/index')).toBe(true)
    expect(navigator.open('/pages/health-trend/index')).toBe(false)
    expect(navigator.open('/pages/health-trend/index')).toBe(false)
    expect(navigateTo).toHaveBeenCalledTimes(1)
    expect(navigator.isOpening()).toBe(true)
  })

  it('accepts taps again after the previous navigation completes', () => {
    const { navigateTo, navigator } = createHarness()

    navigator.open('/pages/reminders/index')
    navigateTo.mock.calls[0][0].complete()

    expect(navigator.isOpening()).toBe(false)
    expect(navigator.open('/pages/reminders/index')).toBe(true)
    expect(navigateTo).toHaveBeenCalledTimes(2)
  })

  it('shows an explicit message when navigation fails and releases the lock', () => {
    const { navigateTo, showToast, navigator } = createHarness()

    navigator.open('/pages/elder-detail/index')
    navigateTo.mock.calls[0][0].fail()
    navigateTo.mock.calls[0][0].complete()

    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast.mock.calls[0][0]).toEqual({
      title: NAVIGATION_FAILED_MESSAGE,
      icon: 'none',
    })
    expect(navigator.isOpening()).toBe(false)
    expect(navigator.open('/pages/elder-detail/index')).toBe(true)
  })

  it('keeps a non-empty user facing failure message', () => {
    expect(NAVIGATION_FAILED_MESSAGE.trim().length).toBeGreaterThan(0)
  })
})
