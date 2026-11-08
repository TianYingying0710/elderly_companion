// SOS 事件流 composable：页面 onShow 时 refresh 拉取（进页面才刷新，无推送）
import { ref } from 'vue'
import { createSosProvider, type SosDataSourceMode } from '../data/sosProvider'
import type { SosEventView } from '../types/sosEvents'

export function useSosEvents() {
  const provider = createSosProvider()
  const events = ref<SosEventView[]>([])
  const loading = ref(false)
  const errorMessage = ref('')

  async function refresh() {
    loading.value = true
    errorMessage.value = ''
    try {
      events.value = await provider.list()
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '加载 SOS 事件失败'
    } finally {
      loading.value = false
    }
  }

  return { mode: provider.mode as SosDataSourceMode, events, loading, errorMessage, refresh }
}
