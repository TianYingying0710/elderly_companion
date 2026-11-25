// SOS 消费端流程规则：只描述「当前状态允许点哪个动作」与错误文案，不持有状态。
// 状态机唯一真源在 code1-elder 后端；此处只做前端展示与防误点。

import { toServiceTaskError, type ServiceErrorKind } from '../api/errors'
import type { SosEventStatus, SosEventView } from '../types/sosEvents'

const NEXT_STATUS: Record<SosEventStatus, SosEventStatus | null> = {
  pending: 'processing',
  processing: 'resolved',
  resolved: null,
}

const ACTION_LABELS: Record<SosEventStatus, string | null> = {
  pending: '开始处理',
  processing: '完成处理',
  resolved: null,
}

const ERROR_MESSAGES: Partial<Record<ServiceErrorKind, string>> = {
  network: '网络连接失败，请检查网络后重试',
  unauthorized: '登录状态已失效，请重新登录',
  forbidden: '没有该社区求助事件的操作权限',
  notFound: '该求助事件不存在或已被删除',
  conflict: '事件状态已变化，已为你刷新',
  validation: '提交内容不合法，请检查后重试',
  unavailable: '求助服务暂不可用，请稍后重试',
  server: '求助服务异常，请稍后重试',
  capabilityMissing: '该功能尚未开放',
}

/** 下一步可推进到的状态；已解决返回 null（不提供任何按钮） */
export function nextSosStatus(current: SosEventStatus): SosEventStatus | null {
  return NEXT_STATUS[current] ?? null
}

/** 主按钮文案；已解决返回 null */
export function sosActionLabel(current: SosEventStatus): string | null {
  return ACTION_LABELS[current] ?? null
}

/** 待响应数量只统计后端返回的 pending 事件 */
export function countPending(events: readonly SosEventView[]): number {
  return events.filter((event) => event.status === 'pending').length
}

/** 把 HTTP 失败归一为可执行的中文提示；本地校验错误保留原文 */
export function sosErrorMessage(error: unknown): string {
  const normalized = toServiceTaskError(error)
  if (normalized.kind === 'unexpected' && error instanceof Error) {
    return error.message
  }
  return ERROR_MESSAGES[normalized.kind] ?? '操作失败，请重试'
}
