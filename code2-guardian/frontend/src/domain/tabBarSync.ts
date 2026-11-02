// 微信自定义 tabBar 选中态同步。
//
// custom-tab-bar 是原生组件，页面切换不会触发它的 pageLifetimes.show，
// 只靠「点击 tab」更新 selected，会让高亮停留在上一次点击的 tab 上。
// 因此每个 tab 页都要在 onShow 时，把当前路由同步给组件，避免高亮与实际页面脱节。
//
// syncTabBar 是纯函数，依赖注入便于脱离小程序运行时做单测。

export interface SyncableTabBar {
  syncSelected?: () => void
}

/** 微信小程序 Page 实例上暴露 getTabBar 的最小契约（uni-app 类型未声明，需窄化断言） */
export interface TabBarPage {
  getTabBar?: () => SyncableTabBar | undefined
}

export function syncTabBar(tabBar: SyncableTabBar | undefined): void {
  if (tabBar && typeof tabBar.syncSelected === 'function') {
    tabBar.syncSelected()
  }
}
