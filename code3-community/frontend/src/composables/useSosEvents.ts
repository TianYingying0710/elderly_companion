// SOS 事件编排层：加载 / 刷新 / 状态推进 / 短轮询生命周期。
// 只依赖 provider 接口，不拼 URL、不判断 HTTP 状态码；状态真值始终来自后端返回值。

import { computed, ref, type ComputedRef, type Ref } from 'vue'

import { toServiceTaskError } from '../api/errors'
import { createSosProvider, type SosDataSourceMode, type SosEventProvider } from '../data/sosProvider'
import { countPending, nextSosStatus, sosErrorMessage } from '../domain/sosFlow'
import { createSosPolling } from '../domain/sosPolling'
import type { SosEventStatus, SosEventView } from '../types/sosEvents'

export interface SosEventsOptions {
  intervalMs?: number
  setIntervalFn?: (fn: () => void, ms: number) => unknown
  clearIntervalFn?: (handle: unknown) => void
}

export interface SosEventsController {
  mode: SosDataSourceMode
  events: Ref<SosEventView[]>
  loading: Ref<boolean>
  /** 列表级错误（加载/刷新失败）；刷新失败时旧列表保留 */
  errorMessage: Ref<string>
  /** 操作级错误（状态推进），独立于列表通道，避免整页被替换 */
  actionError: Ref<string>
  busyId: Ref<string>
  pendingCount: ComputedRef<number>
  refresh: () => Promise<void>
  transition: (id: string, to: SosEventStatus, note?: string) => Promise<boolean>
  startPolling: () => void
  stopPolling: () => void
  isPolling: () => boolean
  clearActionError: () => void
}

export function useSosEvents(
  provider: SosEventProvider = createSosProvider(),
  options: SosEventsOptions = {},
): SosEventsController {
  const events = ref<SosEventView[]>([])
  const loading = ref(false)
  const errorMessage = ref('')
  const actionError = ref('')
  const busyId = ref('')

  const pendingCount = computed(() => countPending(events.value))

  async function refresh(): Promise<void> {
    // 已有真实列表时把这次拉取视为后台刷新：不切整页 loading，失败也不清空旧数据。
    const hadData = events.value.length > 0
    if (!hadData) loading.value = true
    try {
      const next = await provider.list()
      events.value = next
      errorMessage.value = ''
    } catch (error) {
      const reason = sosErrorMessage(error)
      errorMessage.value = hadData ? `刷新失败，列表可能不是最新：${reason}` : reason
    } finally {
      loading.value = false
    }
  }

  const polling = createSosPolling({
    refresh: () => refresh(),
    intervalMs: options.intervalMs,
    setIntervalFn: options.setIntervalFn,
    clearIntervalFn: options.clearIntervalFn,
  })

  function startPolling(): void {
    // mock 模式是纯静态演示，没有跨端真值可拉，不需要轮询。
    if (provider.mode !== 'api') return
    void refresh()
    polling.start()
  }

  function stopPolling(): void {
    polling.stop()
  }

  async function transition(id: string, to: SosEventStatus, note?: string): Promise<boolean> {
    // 提交互斥：双击或并发点击只允许第一次进入，避免重复推进状态。
    if (busyId.value !== '') return false

    const current = events.value.find((event) => event.id === id)
    if (current === undefined) {
      actionError.value = '该求助事件不存在或已被删除'
      return false
    }
    // 本地只做「顺序」防误点，最终合法性仍由后端 409 判定。
    if (nextSosStatus(current.status) !== to) {
      actionError.value = '事件状态已变化，已为你刷新'
      await refresh()
      return false
    }

    busyId.value = id
    actionError.value = ''
    try {
      await provider.transition(id, to, note)
      await refresh()
      return true
    } catch (error) {
      const reason = sosErrorMessage(error)
      const kind = toServiceTaskError(error).kind
      if (kind === 'conflict' || kind === 'notFound') {
        // 冲突或事件已被删除时先对齐后端真值，再写错误，避免刷新覆盖掉本次原因。
        await refresh()
      }
      actionError.value = reason
      return false
    } finally {
      busyId.value = ''
    }
  }

  function clearActionError(): void {
    actionError.value = ''
  }

  return {
    mode: provider.mode,
    events,
    loading,
    errorMessage,
    actionError,
    busyId,
    pendingCount,
    refresh,
    transition,
    startPolling,
    stopPolling,
    isPolling: () => polling.isRunning(),
    clearActionError,
  }
}
