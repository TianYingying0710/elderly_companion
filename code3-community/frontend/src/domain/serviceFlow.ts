import type { ServiceStatus, ServiceTask } from '../types/community'

/** 社区服务三分组，顺序即页面展示顺序。 */
export const SERVICE_GROUPS: ServiceStatus[] = ['待接收', '服务中', '已完成']

/** 状态推进：待接收 → 服务中 → 已完成，已完成不再变化。 */
export function nextServiceStatus(status: ServiceStatus): ServiceStatus {
  if (status === '待接收') return '服务中'
  if (status === '服务中') return '已完成'
  return '已完成'
}

/** 详情弹层主按钮文案。 */
export function serviceActionLabel(status: ServiceStatus): string {
  if (status === '待接收') return '接收任务'
  if (status === '服务中') return '完成并保存记录'
  return '关闭'
}

/** 卡片右侧提示文案；已完成返回空串，由 ✓ 标记代替。 */
export function serviceCardLabel(status: ServiceStatus): string {
  if (status === '待接收') return '接收任务'
  if (status === '服务中') return '完成'
  return ''
}

export interface ServiceGroup {
  status: ServiceStatus
  items: ServiceTask[]
}

/** 按状态分组。计数为 0 的分组保留，由页面渲染「暂无任务」。 */
export function groupServices(tasks: ServiceTask[]): ServiceGroup[] {
  return SERVICE_GROUPS.map((status) => ({
    status,
    items: tasks.filter((task) => task.status === status),
  }))
}
