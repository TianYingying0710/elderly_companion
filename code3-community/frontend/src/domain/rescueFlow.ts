import type { RescueStatus } from '../types/community'

export interface RescueStep {
  status: RescueStatus
  /** 时间轴上的步骤名 */
  name: string
  /** 详情弹层主按钮文案 */
  action: string
}

/** 社区处置 4 态。全流程不使用「接单 / 抢单 / 派单」措辞。 */
export const RESCUE_STEPS: RescueStep[] = [
  { status: '待响应', name: '收到求助', action: '派员前往现场' },
  { status: '已赶往现场', name: '已赶往现场', action: '确认已到达' },
  { status: '已到达', name: '已到达', action: '完成处理' },
  { status: '已完成处理', name: '已完成处理', action: '关闭' },
]

export const RESCUE_FLOW: RescueStatus[] = RESCUE_STEPS.map((step) => step.status)

/** 当前状态在流程中的下标；未知状态按起点处理。 */
export function flowIndex(status: RescueStatus): number {
  return Math.max(0, RESCUE_FLOW.indexOf(status))
}

export function isTerminal(status: RescueStatus): boolean {
  return status === '已完成处理'
}

export function nextStatus(status: RescueStatus): RescueStatus {
  const index = RESCUE_FLOW.indexOf(status)
  if (index < 0 || index >= RESCUE_FLOW.length - 1) return status
  return RESCUE_FLOW[index + 1]
}

/** 只有「已到达 → 已完成处理」这一步强校验处理结果。 */
export function requiresResult(status: RescueStatus): boolean {
  return status === '已到达'
}

/** 统一时间戳格式 MM-DD HH:mm。 */
export function stamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
