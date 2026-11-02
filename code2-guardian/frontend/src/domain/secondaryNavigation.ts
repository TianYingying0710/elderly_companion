// 二级页面导航：普通页面一律 navigateTo，并对外提供并发锁与失败提示。
// 依赖以参数注入，便于在不启动小程序运行时的情况下做纯函数测试。

export interface NavigateOptions {
  url: string
  fail: (error?: unknown) => void
  complete: () => void
}

export interface NavigatorDeps {
  navigateTo: (options: NavigateOptions) => void
  showToast: (options: { title: string; icon: 'none' }) => void
}

export const NAVIGATION_FAILED_MESSAGE = '页面打开失败，请重试'

export interface SecondaryNavigator {
  /** 打开二级页面；已有导航在飞行中时返回 false 且不重复打开 */
  open: (url: string) => boolean
  isOpening: () => boolean
}

export function createSecondaryNavigator(deps: NavigatorDeps): SecondaryNavigator {
  let opening = false

  return {
    open(url: string) {
      if (opening) return false
      opening = true
      deps.navigateTo({
        url,
        fail: () => deps.showToast({ title: NAVIGATION_FAILED_MESSAGE, icon: 'none' }),
        complete: () => {
          opening = false
        },
      })
      return true
    },
    isOpening: () => opening,
  }
}
