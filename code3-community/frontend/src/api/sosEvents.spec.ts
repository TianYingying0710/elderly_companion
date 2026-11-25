import { describe, expect, it, vi } from 'vitest'

import type { SosEventDto } from '../types/sosEvents'
import { ApiError } from './client'
import { getSosEvents, transitionSosEvent } from './sosEvents'

const dto: SosEventDto = {
  id: 'sos-1',
  elder_id: 'elder-001',
  created_at: '2026-11-14T02:03:00+00:00',
  status: 'processing',
  note: null,
}

function recorder(result: unknown) {
  const calls: { path: string; options?: Record<string, unknown> }[] = []
  const request = vi.fn(async (path: string, options?: Record<string, unknown>) => {
    calls.push({ path, options })
    return result
  })
  return { request, calls }
}

function bodyOf(call: { options?: Record<string, unknown> }): unknown {
  return JSON.parse(String(call.options?.data))
}

describe('sosEvents API', () => {
  it('按 elder_id 读取事件列表', async () => {
    const { request, calls } = recorder([dto])

    await expect(getSosEvents('elder-001', request)).resolves.toEqual([dto])
    expect(calls[0].path).toBe('/api/v1/sos-events?elder_id=elder-001')
  })

  it('非数组响应直接失败，不用空列表掩盖错误', async () => {
    const { request } = recorder({})

    await expect(getSosEvents('elder-001', request)).rejects.toThrow('invalid sos events payload')
  })

  it('状态推进走 POST /transitions，路径与方法符合后端契约', async () => {
    const { request, calls } = recorder({ ...dto, status: 'resolved' })

    const result = await transitionSosEvent('sos-1', 'resolved', '已联系家属确认平安', request)

    expect(result.status).toBe('resolved')
    expect(calls).toHaveLength(1)
    expect(calls[0].path).toBe('/api/v1/sos-events/sos-1/transitions')
    expect(calls[0].options).toMatchObject({
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
    })
    expect(bodyOf(calls[0])).toEqual({ status: 'resolved', note: '已联系家属确认平安' })
  })

  it('事件 id 被编码，避免路径拼接错误', async () => {
    const { request, calls } = recorder(dto)

    await transitionSosEvent('a/b', 'processing', undefined, request)

    expect(calls[0].path).toBe('/api/v1/sos-events/a%2Fb/transitions')
  })

  it('空白备注不进入请求体（后端 note 有 min_length=1）', async () => {
    const { request, calls } = recorder(dto)

    await transitionSosEvent('sos-1', 'processing', '   ', request)

    expect(bodyOf(calls[0])).toEqual({ status: 'processing' })
  })

  it('409 原样抛出，由编排层决定提示与刷新', async () => {
    const request = vi.fn(async () => {
      throw new ApiError(409, 'invalid_state_transition', 'conflict')
    })

    await expect(transitionSosEvent('sos-1', 'processing', undefined, request)).rejects.toMatchObject({
      statusCode: 409,
      code: 'invalid_state_transition',
    })
  })
})
