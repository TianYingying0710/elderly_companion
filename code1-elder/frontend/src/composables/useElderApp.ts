import { reactive } from 'vue'
import { demoData, type DemoData } from '../demo/data'
import { checkHealth } from '../api/client'
import type { Page } from '../types/navigation'
import type { ChatMessage, RequestRecord, SosState } from '../types/domain'
import { useNavigation } from './useNavigation'
import { useHealth } from './useHealth'
import { useChat } from './useChat'
import { useSos } from './useSos'
import { cloneDemoData, useDemoMode } from './useDemoMode'

export type { Page } from '../types/navigation'
const cloneData = (): DemoData => cloneDemoData(demoData)
export function useElderApp() {
  const initialDemo = import.meta.env.VITE_DEMO_MODE !== 'false'
  const state = reactive({
    demo: initialDemo, data: initialDemo ? cloneData() : null as DemoData | null,
    page: 'home' as Page, trail: [] as { page: Page; selected: string }[], large: false,
    category: '全部', query: '', selected: '', draft: '',
    messages: initialDemo ? JSON.parse(JSON.stringify(demoData.chat)) as ChatMessage[] : [] as ChatMessage[],
    sos: null as SosState | null, reached: false, currentRequest: null as RequestRecord | null,
    modal: null as 'start' | 'cancel' | null, feedback: '', health: '尚未检查', checking: false,
  })
  const {go,back}=useNavigation(state)
  const {toggleDemo}=useDemoMode(state,demoData)
  const {send}=useChat(state)
  const {help,startHelp,progress,cancelHelp}=useSos(state,go)
  function togglePermission(key:string){const family=state.data?.family.find(item=>item.id===state.selected);if(state.demo&&family)family.permissions[key]=!family.permissions[key]}
  function openConversation(index:number){if(!state.data)return;state.messages=cloneDemoData(state.data).conversations[index]??[];go('chat')}
  const health=useHealth(state,checkHealth).check
  return { state, go, back, toggleDemo, send, help, startHelp, progress, cancelHelp, health, togglePermission, openConversation }
}
export type ElderApp = ReturnType<typeof useElderApp>
