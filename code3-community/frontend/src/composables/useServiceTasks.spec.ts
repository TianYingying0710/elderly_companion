import { describe, expect, it, vi } from 'vitest'

import type { ServiceTaskDto } from '../types/serviceTask'
import { ServiceTaskRequestError } from '../api/errors'
import type { ServiceTasksApi } from '../api/serviceTasks'
import { useServiceTasks } from './useServiceTasks'

const dto = (overrides: Partial<ServiceTaskDto> = {}): ServiceTaskDto => ({
  id: 'task-1',
  title: '代缴水电费',
  elder_name: '示例老人 B',
  category: '代办服务',
  scheduled_at: '2026-11-01T06:30:00+00:00',
  location: 'XX 社区服务中心窗口',
  description: '说明',
  status: 'pending',
  note: null,
  ...overrides,
})

function fakeApi(overrides: Partial<ServiceTasksApi> = {}): ServiceTasksApi {
  return {
    list: vi.fn(async () => [] as ServiceTaskDto[]),
    get: vi.fn(async () => dto()),
    create: vi.fn(async () => dto()),
    accept: vi.fn(async () => dto({ status: 'in_service' })),
    complete: vi.fn(async () => dto({ status: 'completed', note: '已代缴' })),
    ...overrides,
  }
}

const draft = {
  title: '公益课程线下答疑',
  elderName: '示例老人 A',
  category: '数字助老',
  scheduledDate: '2026-11-01',
  scheduledTime: '14:30',
  location: 'XX 社区养老服务中心',
  description: '现场一对一指导',
}

describe('useServiceTasks', () => {
  it('加载成功后进入 ready 并映射为 ViewModel', async () => {
    const controller = useServiceTasks(fakeApi({ list: vi.fn(async () => [dto()]) }))

    await controller.load()

    expect(controller.state.value).toBe('ready')
    expect(controller.tasks.value).toHaveLength(1)
    expect(controller.tasks.value[0]).toMatchObject({
      elderName: '示例老人 B',
      scheduledText: '11-01 14:30',
      status: 'pending',
      record: null,
    })
  })

  it('空库进入 ready 且列表为空', async () => {
    const controller = useServiceTasks(fakeApi())

    await controller.load()

    expect(controller.state.value).toBe('ready')
    expect(controller.tasks.value).toEqual([])
  })

  it('加载失败进入 error 并给出可读原因，不伪造空成功', async () => {
    const api = fakeApi({
      list: vi.fn(async () => {
        throw new ServiceTaskRequestError('network', 0, 'network', 'fail')
      }),
    })
    const controller = useServiceTasks(api)

    await controller.load()

    expect(controller.state.value).toBe('error')
    expect(controller.errorMessage.value).toContain('网络')
    expect(controller.tasks.value).toEqual([])
  })

  it('已有列表时刷新失败保持 ready、保留列表并给出非阻塞提示', async () => {
    const list = vi
      .fn<[], Promise<ServiceTaskDto[]>>()
      .mockResolvedValueOnce([dto()])
      .mockRejectedValueOnce(new ServiceTaskRequestError('server', 500, 'internal_error', 'boom'))
    const controller = useServiceTasks(fakeApi({ list }))

    await controller.load()
    await controller.load()

    expect(controller.state.value).toBe('ready')
    expect(controller.tasks.value).toHaveLength(1)
    expect(controller.tasks.value[0].id).toBe('task-1')
    expect(controller.errorMessage.value).toBe('')
    expect(controller.actionError.value).toContain('刷新')
  })

  it('刷新失败后再成功时清理非阻塞提示', async () => {
    const list = vi
      .fn<[], Promise<ServiceTaskDto[]>>()
      .mockResolvedValueOnce([dto()])
      .mockRejectedValueOnce(new ServiceTaskRequestError('server', 500, 'internal_error', 'boom'))
      .mockResolvedValueOnce([dto({ status: 'in_service' })])
    const controller = useServiceTasks(fakeApi({ list }))

    await controller.load()
    await controller.load()
    expect(controller.actionError.value).not.toBe('')

    await controller.load()

    expect(controller.state.value).toBe('ready')
    expect(controller.actionError.value).toBe('')
    expect(controller.tasks.value[0].status).toBe('in_service')
  })

  it('首次加载失败仍使用整页错误状态', async () => {
    const api = fakeApi({
      list: vi.fn(async () => {
        throw new ServiceTaskRequestError('unavailable', 503, 'service_unavailable', 'down')
      }),
    })
    const controller = useServiceTasks(api)

    await controller.load()

    expect(controller.state.value).toBe('error')
    expect(controller.errorMessage.value).not.toBe('')
    expect(controller.actionError.value).toBe('')
  })

  it('重试成功后回到 ready', async () => {
    const list = vi
      .fn<[], Promise<ServiceTaskDto[]>>()
      .mockRejectedValueOnce(new ServiceTaskRequestError('unavailable', 503, 'x', 'x'))
      .mockResolvedValueOnce([dto()])
    const controller = useServiceTasks(fakeApi({ list }))

    await controller.load()
    await controller.retry()

    expect(controller.state.value).toBe('ready')
    expect(controller.tasks.value).toHaveLength(1)
  })

  it('新建提交带 +08:00 的 ISO 时间，成功后重新拉取列表', async () => {
    const api = fakeApi()
    const controller = useServiceTasks(api)

    await controller.createTask(draft)

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ elder_name: '示例老人 A', scheduled_at: '2026-11-01T14:30:00+08:00' }),
    )
    expect(api.list).toHaveBeenCalledTimes(1)
  })

  it('新建失败时不改动列表并给出错误', async () => {
    const api = fakeApi({
      list: vi.fn(async () => [dto()]),
      create: vi.fn(async () => {
        throw new ServiceTaskRequestError('validation', 422, 'validation_failed', 'bad')
      }),
    })
    const controller = useServiceTasks(api)
    await controller.load()

    const ok = await controller.createTask(draft)

    expect(ok).toBe(false)
    expect(controller.actionError.value).toContain('不合法')
    expect(controller.tasks.value).toHaveLength(1)
  })

  it('接收成功后刷新，接收失败不写本地状态', async () => {
    const accept = vi
      .fn<[], Promise<ServiceTaskDto>>()
      .mockRejectedValueOnce(new ServiceTaskRequestError('forbidden', 403, 'forbidden', 'no'))
    const api = fakeApi({ list: vi.fn(async () => [dto()]), accept })
    const controller = useServiceTasks(api)
    await controller.load()

    const failed = await controller.accept('task-1')

    expect(failed).toBe(false)
    expect(controller.tasks.value[0].status).toBe('pending')
    expect(controller.actionError.value).toContain('权限')
  })

  it('空服务记录不发请求', async () => {
    const api = fakeApi()
    const controller = useServiceTasks(api)

    const ok = await controller.complete('task-1', '   ')

    expect(ok).toBe(false)
    expect(api.complete).not.toHaveBeenCalled()
    expect(controller.actionError.value).toContain('服务记录')
  })

  it('完成任务时去掉首尾空白后提交', async () => {
    const api = fakeApi()
    const controller = useServiceTasks(api)

    await controller.complete('task-1', '  已代缴  ')

    expect(api.complete).toHaveBeenCalledWith('task-1', '已代缴')
  })

  it('冲突后自动重新拉取服务端状态', async () => {
    const accept = vi.fn(async () => {
      throw new ServiceTaskRequestError('conflict', 409, 'invalid_state_transition', 'conflict')
    })
    const list = vi.fn(async () => [dto({ status: 'completed', note: '已代缴' })])
    const controller = useServiceTasks(fakeApi({ list, accept }))
    await controller.load()

    const ok = await controller.accept('task-1')

    expect(ok).toBe(false)
    expect(list).toHaveBeenCalledTimes(2)
    expect(controller.tasks.value[0].status).toBe('completed')
    expect(controller.actionError.value).toContain('状态已变化')
  })

  it('clearActionError 清理上一操作的错误', async () => {
    const api = fakeApi({
      complete: vi.fn(async () => {
        throw new ServiceTaskRequestError('validation', 422, 'validation_failed', 'bad')
      }),
    })
    const controller = useServiceTasks(api)

    await controller.complete('task-1', '已代缴')
    expect(controller.actionError.value).not.toBe('')

    controller.clearActionError()

    expect(controller.actionError.value).toBe('')
  })

  it('空标题保留本地校验的具体字段原因，且不发起请求', async () => {
    const api = fakeApi()
    const controller = useServiceTasks(api)

    const ok = await controller.createTask({ ...draft, title: '   ' })

    expect(ok).toBe(false)
    expect(api.create).not.toHaveBeenCalled()
    expect(controller.actionError.value).toContain('title')
    expect(controller.actionError.value).not.toBe('操作失败，请重试')
  })

  it('超长标题显示具体上限而不是通用失败', async () => {
    const api = fakeApi()
    const controller = useServiceTasks(api)

    const ok = await controller.createTask({ ...draft, title: '标'.repeat(101) })

    expect(ok).toBe(false)
    expect(api.create).not.toHaveBeenCalled()
    expect(controller.actionError.value).toContain('最多 100 个字符')
    expect(controller.actionError.value).not.toBe('操作失败，请重试')
  })

  it('非法日期显示日期原因而不是通用失败', async () => {
    const api = fakeApi()
    const controller = useServiceTasks(api)

    const ok = await controller.createTask({ ...draft, scheduledDate: '2026-02-30' })

    expect(ok).toBe(false)
    expect(api.create).not.toHaveBeenCalled()
    expect(controller.actionError.value).toContain('服务日期不合法')
  })

  it('本地校验失败后列表保持不变', async () => {
    const api = fakeApi({ list: vi.fn(async () => [dto()]) })
    const controller = useServiceTasks(api)
    await controller.load()

    await controller.createTask({ ...draft, location: '' })

    expect(controller.tasks.value).toHaveLength(1)
    expect(controller.state.value).toBe('ready')
  })

  it('操作进行中重复点击被拒绝', async () => {
    let release: (value: ServiceTaskDto) => void = () => undefined
    const accept = vi.fn(
      () =>
        new Promise<ServiceTaskDto>((resolve) => {
          release = resolve
        }),
    )
    const api = fakeApi({ accept })
    const controller = useServiceTasks(api)

    const first = controller.accept('task-1')
    const second = await controller.accept('task-1')

    expect(second).toBe(false)
    expect(api.accept).toHaveBeenCalledTimes(1)
    expect(controller.busy.value).toBe(true)

    release(dto({ status: 'in_service' }))
    expect(await first).toBe(true)
    expect(controller.busy.value).toBe(false)
  })
})
