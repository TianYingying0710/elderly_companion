/** 把 HTTP 失败归一为可判别的类别。禁止把失败转换成空数组或假成功。 */

import { ApiError as ClientApiError } from './client'

export type ServiceErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'validation'
  | 'capabilityMissing'
  | 'unavailable'
  | 'server'
  | 'unexpected'

export interface ServiceFieldError {
  path: string
  code: string
  message: string
}

export class ServiceTaskRequestError extends Error {
  kind: ServiceErrorKind
  statusCode: number
  code: string
  fields: ServiceFieldError[]

  constructor(
    kind: ServiceErrorKind,
    statusCode: number,
    code: string,
    message: string,
    fields: ServiceFieldError[] = [],
  ) {
    super(message || `service task request failed: ${statusCode}`)
    this.name = 'ServiceTaskRequestError'
    this.kind = kind
    this.statusCode = statusCode
    this.code = code
    this.fields = fields
  }
}

export function kindForStatus(statusCode: number): ServiceErrorKind {
  if (statusCode === 0) return 'network'
  if (statusCode === 401) return 'unauthorized'
  if (statusCode === 403) return 'forbidden'
  if (statusCode === 404) return 'notFound'
  if (statusCode === 409) return 'conflict'
  if (statusCode === 422) return 'validation'
  if (statusCode === 501) return 'capabilityMissing'
  if (statusCode === 503) return 'unavailable'
  if (statusCode >= 500) return 'server'
  return 'unexpected'
}

export function toServiceTaskError(error: unknown): ServiceTaskRequestError {
  if (error instanceof ServiceTaskRequestError) return error
  if (error instanceof ClientApiError) {
    return new ServiceTaskRequestError(
      kindForStatus(error.statusCode),
      error.statusCode,
      error.code,
      error.message,
      error.fields,
    )
  }
  const message = error instanceof Error ? error.message : String(error)
  return new ServiceTaskRequestError('unexpected', 0, 'unexpected', message)
}

/** 类别 → 中文提示。文案只在前端存在。 */
export function errorMessage(kind: ServiceErrorKind): string {
  switch (kind) {
    case 'network':
      return '网络连接失败，请检查网络后重试'
    case 'unauthorized':
      return '登录状态已失效，请重新登录'
    case 'forbidden':
      return '没有该社区服务的操作权限'
    case 'notFound':
      return '任务不存在或已被撤销'
    case 'conflict':
      return '任务状态已变化，已为你刷新'
    case 'validation':
      return '提交内容不合法，请检查后重试'
    case 'capabilityMissing':
      return '该功能尚未开放'
    case 'unavailable':
      return '服务暂时不可用，请稍后重试'
    case 'server':
      return '服务异常，请稍后重试'
    default:
      return '操作失败，请重试'
  }
}
