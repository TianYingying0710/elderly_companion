/** 服务任务页面的编排层：加载、空、错误、操作互斥与刷新。不含 SQL 与 HTTP 细节。 */

import { ref, type Ref } from 'vue'

import { errorMessage, toServiceTaskError } from '../api/errors'
import { createServiceTasksApi, type ServiceTasksApi } from '../api/serviceTasks'
import {
  ServiceTaskMappingError,
  toCreatePayload,
  toServiceTaskList,
} from '../mappers/serviceTaskMapper'
import type { ServiceTask, ServiceTaskDraft } from '../types/serviceTask'

export type ServiceTasksState = 'loading' | 'ready' | 'error'

export interface ServiceTasksController {
  tasks: Ref<ServiceTask[]>
  state: Ref<ServiceTasksState>
  errorMessage: Ref<string>
  actionError: Ref<string>
  busy: Ref<boolean>
  busyId: Ref<string>
  load: () => Promise<void>
  retry: () => Promise<void>
  createTask: (draft: ServiceTaskDraft) => Promise<boolean>
  accept: (taskId: string) => Promise<boolean>
  complete: (taskId: string, note: string) => Promise<boolean>
  clearActionError: () => void
}

export function useServiceTasks(api: ServiceTasksApi = createServiceTasksApi()): ServiceTasksController {
  const tasks = ref<ServiceTask[]>([])
  const state = ref<ServiceTasksState>('loading')
  const errorMessage = ref('')
  const actionError = ref('')
  const busy = ref(false)
  const busyId = ref('')

  async function load(): Promise<void> {
    // 已有真实列表时把这次加载视为「刷新」：不整页切走，失败也不隐藏旧数据。
    const hadData = tasks.value.length > 0
    if (!hadData) {
      state.value = 'loading'
    }
    try {
      const raw = await api.list()
      const next = toServiceTaskList(raw)
      tasks.value = next
      state.value = 'ready'
      errorMessage.value = ''
      actionError.value = ''
    } catch (error) {
      const reason = messageOf(error)
      if (hadData) {
        state.value = 'ready'
        errorMessage.value = ''
        actionError.value = `刷新失败，列表可能不是最新：${reason}`
        return
      }
      // 首次加载没有任何真实数据可保留，才允许整页错误。
      state.value = 'error'
      errorMessage.value = reason
    }
  }

  async function retry(): Promise<void> {
    actionError.value = ''
    await load()
  }

  async function run(taskId: string, action: () => Promise<unknown>): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    busyId.value = taskId
    actionError.value = ''
    try {
      await action()
      await load()
      return true
    } catch (error) {
      if (error instanceof ServiceTaskMappingError) {
        // 本地 mapper 校验是确定性的输入问题：保留它给出的具体原因，不降级成通用失败文案。
        actionError.value = error.message
        return false
      }
      const normalized = toServiceTaskError(error)
      const reason = messageOf(error)
      if (normalized.kind === 'conflict' || normalized.kind === 'notFound') {
        // 服务端状态是唯一真值：冲突或已被撤销时重新拉取。
        // 先重载再写错误，避免刷新成功时的清理动作覆盖掉本次操作的真实原因。
        await load()
      }
      actionError.value = reason
      return false
    } finally {
      busy.value = false
      busyId.value = ''
    }
  }

  async function createTask(draft: ServiceTaskDraft): Promise<boolean> {
    return run('', async () => {
      const payload = toCreatePayload(draft)
      await api.create(payload)
    })
  }

  async function accept(taskId: string): Promise<boolean> {
    return run(taskId, () => api.accept(taskId))
  }

  async function complete(taskId: string, note: string): Promise<boolean> {
    const trimmed = note.trim()
    if (!trimmed) {
      actionError.value = '请先填写服务记录'
      return false
    }
    return run(taskId, () => api.complete(taskId, trimmed))
  }

  function clearActionError(): void {
    actionError.value = ''
  }

  return {
    tasks,
    state,
    errorMessage,
    actionError,
    busy,
    busyId,
    load,
    retry,
    createTask,
    accept,
    complete,
    clearActionError,
  }
}

function messageOf(error: unknown): string {
  return errorMessage(toServiceTaskError(error).kind)
}
