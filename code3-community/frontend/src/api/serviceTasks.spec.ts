import { describe, expect, it, vi } from 'vitest'

import type { ServiceTaskCreatePayload, ServiceTaskDto } from '../types/serviceTask'
import { ApiError } from './client'
import { ServiceTaskRequestError } from './errors'
import { createServiceTasksApi } from './serviceTasks'

const dto: ServiceTaskDto = {
  id: 'task-1',
  title: '代缴水电费',
  elder_name: '示例老人 B',
  category: '代办服务',
  scheduled_at: '2026-11-01T14:30:00+08:00',
  location: 'XX 社区服务中心窗口',
  description: '说明',
  status: 'pending',
  note: null,
}

const payload: ServiceTaskCreatePayload = {
  title: '代缴水电费',
  elder_name: '示例老人 B',
  category: '代办服务',
  scheduled_at: '2026-11-01T14:30:00+08:00',
  location: 'XX 社区服务中心窗口',
  description: '说明',
}

function recorder(result: unknown) {
  const calls: { path: string; options?: Record<string, unknown> }[] = []
  const request = vi.fn(async (path: string, options?: Record<string, unknown>) => {
    calls.push({ path, options })
    return result
  })
  return { request, calls }
}

function failing(statusCode: number, code: string, fields: unknown[] = []) {
  return vi.fn(async () => {
    throw new ApiError(statusCode, code, `failed ${statusCode}`, fields as never)
  })
}

describe('serviceTasks API', () => {
  it('列出任务使用 GET /api/v1/service-tasks', async () => {
    const { request, calls } = recorder([dto])

    await expect(createServiceTasksApi(request).list()).resolves.toEqual([dto])
    expect(calls[0]).toEqual({ path: '/api/v1/service-tasks', options: { method: 'GET' } })
  })

  it('详情与命令端点路径正确，ID 被编码', async () => {
    const { request, calls } = recorder(dto)
    const api = createServiceTasksApi(request)

    await api.get('task-1')
    await api.get('a/b')
    await api.accept('task-1')
    await api.complete('task-1', '已代缴')

    expect(calls.map((call) => call.path)).toEqual([
      '/api/v1/service-tasks/task-1',
      '/api/v1/service-tasks/a%2Fb',
      '/api/v1/service-tasks/task-1/accept',
      '/api/v1/service-tasks/task-1/complete',
    ])
    expect(calls.every((call) => call.options?.method === 'GET' || call.options?.method === 'POST')).toBe(
      true,
    )
  })

  it('新建提交完整请求体，完成只提交 note', async () => {
    const { request, calls } = recorder(dto)
    const api = createServiceTasksApi(request)

    await api.create(payload)
    await api.complete('task-1', '已代缴')

    expect(calls[0].options).toMatchObject({ method: 'POST', data: payload })
    expect(calls[1].options).toMatchObject({ method: 'POST', data: { note: '已代缴' } })
  })

  it.each([
    [401, 'unauthenticated', 'unauthorized'],
    [403, 'forbidden', 'forbidden'],
    [404, 'task_not_found', 'notFound'],
    [409, 'invalid_state_transition', 'conflict'],
    [422, 'validation_failed', 'validation'],
    [501, 'capability_not_implemented', 'capabilityMissing'],
    [503, 'service_unavailable', 'unavailable'],
    [500, 'internal_error', 'server'],
    [418, 'teapot', 'unexpected'],
  ])('状态码 %s 归一为 %s', async (status, code, kind) => {
    const api = createServiceTasksApi(failing(status, code))

    await expect(api.list()).rejects.toMatchObject({ kind, statusCode: status, code })
  })

  it('网络失败归一为 network，且不返回空数组', async () => {
    const request = vi.fn(async () => {
      throw new ApiError(0, 'network', 'request:fail')
    })

    const promise = createServiceTasksApi(request).list()

    await expect(promise).rejects.toBeInstanceOf(ServiceTaskRequestError)
    await expect(promise).rejects.toMatchObject({ kind: 'network', statusCode: 0 })
  })

  it('保留后端字段级校验错误', async () => {
    const api = createServiceTasksApi(
      failing(422, 'validation_failed', [{ path: 'body.note', code: 'missing', message: 'Field required' }]),
    )

    await expect(api.complete('task-1', '')).rejects.toMatchObject({
      kind: 'validation',
      fields: [{ path: 'body.note', code: 'missing', message: 'Field required' }],
    })
  })
})
