/** SOS 状态文案单一来源：老人端进度页与求助记录页共用。 */

import type { SosEventStatus } from '../types/sos'

export const SOS_STATUS_TITLES: Record<SosEventStatus, string> = {
  pending: '已上报 · 等待处理',
  processing: '处理中 · 家人/社区已介入',
  resolved: '已解决',
}

export function sosStatusTitle(status: SosEventStatus): string {
  return SOS_STATUS_TITLES[status]
}
