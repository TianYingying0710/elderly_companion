/** 自定义导航栏时用于避开手机状态栏。 */
export function getStatusBarHeight(): number {
  try {
    return uni.getSystemInfoSync().statusBarHeight ?? 0
  } catch {
    return 0
  }
}
