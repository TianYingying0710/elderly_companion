// 监护人端二级页面路由集中定义：首页入口只允许引用这里的常量，避免路径散落硬编码。
export const GUARDIAN_SECONDARY_ROUTES = {
  elderDetail: '/pages/elder-detail/index',
  healthTrend: '/pages/health-trend/index',
  reminders: '/pages/reminders/index',
  adviceDetail: '/pages/advice-detail/index',
  help: '/pages/help/index',
  about: '/pages/about/index',
} as const

export type GuardianSecondaryRoute =
  (typeof GUARDIAN_SECONDARY_ROUTES)[keyof typeof GUARDIAN_SECONDARY_ROUTES]
