/** 服务任务的 HTTP 边界：只有这里出现路径与方法。 */

import type { ServiceTaskCreatePayload, ServiceTaskDto } from '../types/serviceTask'
import { apiRequest as defaultRequest } from './client'
import { toServiceTaskError } from './errors'

type RequestOptions = Omit<UniApp.RequestOptions, 'url' | 'success' | 'fail'>

export type ServiceTaskRequest = <T>(path: string, options?: RequestOptions) => Promise<T>

export interface ServiceTasksApi {
  list(): Promise<ServiceTaskDto[]>
  get(taskId: string): Promise<ServiceTaskDto>
  create(payload: ServiceTaskCreatePayload): Promise<ServiceTaskDto>
  accept(taskId: string): Promise<ServiceTaskDto>
  complete(taskId: string, note: string): Promise<ServiceTaskDto>
}

const BASE_PATH = '/api/v1/service-tasks'
const JSON_HEADER = { 'Content-Type': 'application/json' }

export function createServiceTasksApi(request: ServiceTaskRequest = defaultRequest): ServiceTasksApi {
  async function send<T>(path: string, options: RequestOptions): Promise<T> {
    try {
      return await request<T>(path, options)
    } catch (error) {
      throw toServiceTaskError(error)
    }
  }

  const taskPath = (taskId: string) => `${BASE_PATH}/${encodeURIComponent(taskId)}`

  return {
    list: () => send<ServiceTaskDto[]>(BASE_PATH, { method: 'GET' }),
    get: (taskId) => send<ServiceTaskDto>(taskPath(taskId), { method: 'GET' }),
    create: (payload) =>
      send<ServiceTaskDto>(BASE_PATH, { method: 'POST', data: payload, header: JSON_HEADER }),
    accept: (taskId) => send<ServiceTaskDto>(`${taskPath(taskId)}/accept`, { method: 'POST' }),
    complete: (taskId, note) =>
      send<ServiceTaskDto>(`${taskPath(taskId)}/complete`, {
        method: 'POST',
        data: { note },
        header: JSON_HEADER,
      }),
  }
}
