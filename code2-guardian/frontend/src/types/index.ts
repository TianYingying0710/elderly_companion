// 领域类型：监护人端 UI 所需的最小集合。DTO/后端契约接入时再扩展。

export interface ElderProfile {
  name: string
  age: number
  relation: string
  boundLabel: string
}

export type HealthMetricKey = 'heartRate' | 'bloodPressure' | 'sleep'

export interface HealthMetric {
  key: HealthMetricKey
  label: string
  value: string
  unit: string
  badge: string
}

export interface HeartRateTrendPoint {
  dateLabel: string
  value: number
}

export interface PlotPadding {
  left: number
  right: number
  top: number
  bottom: number
}

export interface TrendCoordinate {
  x: number
  y: number
}

/** 趋势画布测量结果：CSS 像素尺寸与像素比 */
export interface TrendCanvasMetrics {
  width: number
  height: number
  dpr: number
}

/** 画布位图尺寸：位图边长 = CSS 边长 × 像素比（向下取整） */
export interface TrendCanvasBitmap {
  width: number
  height: number
}

/** 折线区域填充闭合路径：上沿折线 + 下沿基线 */
export interface TrendAreaPath {
  top: TrendCoordinate[]
  baseline: number
}

/** 画布触摸区域（CSS 像素），与布局尺寸一致，不随位图分辨率变化 */
export interface TrendTouchRegion {
  left: number
  top: number
  width: number
  height: number
}

export type ReminderIcon = 'pill' | 'walk'

export interface ReminderItem {
  id: number
  title: string
  time: string
  icon: ReminderIcon
}

export type AdviceIcon = 'walk' | 'chat' | 'sleep' | 'diet'

export interface AdviceItem {
  id: number
  icon: AdviceIcon
  title: string
  desc: string
}

export type MessageCategory = '健康提醒' | '求助消息' | '社区通知' | '系统消息'

export interface MessageItem {
  id: number
  category: MessageCategory
  title: string
  summary: string
  time: string
}

/** 消息筛选胶囊：UI 上只暴露 全部 / 健康提醒 / 求助消息 / 社区通知 */
export type MessageFilter = '全部' | '健康提醒' | '求助消息' | '社区通知'

export interface MenuItem {
  id: number
  icon: string
  label: string
}

export interface GuardianInfo {
  name: string
  phone: string
}

export type TabKey = 'home' | 'advice' | 'messages' | 'profile'
