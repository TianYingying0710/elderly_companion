/** 社区服务状态的展示规则。纯函数：不依赖 Vue、uni、HTTP 或存储。 */

import type { ServiceTask, ServiceTaskStatus } from '../types/serviceTask'

/** 三个分组，顺序即页面展示顺序。 */
export const SERVICE_STATUS_ORDER: ServiceTaskStatus[] = ['pending', 'in_service', 'completed']

const LABELS: Record<ServiceTaskStatus, string> = {
  pending: '待接收',
  in_service: '服务中',
  completed: '已完成',
}

export interface ServiceGroup {
  status: ServiceTaskStatus
  label: string
  items: ServiceTask[]
}

export function statusLabel(status: ServiceTaskStatus): string {
  return LABELS[status] ?? '未知状态'
}

/** 只有 pending 可接收；权威规则在后端，这里只控制按钮可用性。 */
export function canAccept(status: ServiceTaskStatus): boolean {
  return status === 'pending'
}

/** 只有 in_service 可完成，且必须填写服务记录。 */
export function canComplete(status: ServiceTaskStatus): boolean {
  return status === 'in_service'
}

/** 列表卡片右侧提示；已完成返回空串，由 ✓ 标记代替。 */
export function cardActionLabel(status: ServiceTaskStatus): string {
  if (canAccept(status)) return '接收任务'
  if (canComplete(status)) return '完成'
  return ''
}

/** 详情弹层主按钮文案。 */
export function detailActionLabel(status: ServiceTaskStatus): string {
  if (canAccept(status)) return '接收任务'
  if (canComplete(status)) return '完成并保存记录'
  return '关闭'
}

/** 按状态分组；计数为 0 的分组保留，由页面渲染「暂无任务」。 */
export function groupServices(tasks: ServiceTask[]): ServiceGroup[] {
  return SERVICE_STATUS_ORDER.map((status) => ({
    status,
    label: statusLabel(status),
    items: tasks.filter((task) => task.status === status),
  }))
}
