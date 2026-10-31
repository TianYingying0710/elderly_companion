import { reactive } from 'vue'
import { expect, it, vi } from 'vitest'
import { useNavigation } from './useNavigation'
import { useHealth } from './useHealth'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useElderApp } from './useElderApp'

it('restores the selected item with navigation history', () => {
  const state=reactive({page:'home' as const|'messages'|'message-detail',selected:'',trail:[] as {page:any;selected:string}[],feedback:'x',modal:null})
  const nav=useNavigation(state)
  nav.go('messages');nav.go('message-detail','help');nav.back()
  expect(state).toMatchObject({page:'messages',selected:''})
})
it('keeps SOS and demo workflows outside the app coordinator',()=>{const source=readFileSync(join(process.cwd(),'src/composables/useElderApp.ts'),'utf8');expect(source).not.toContain('function startHelp');expect(source).not.toContain('function toggleDemo')})
it('changes permissions and opens conversations through app actions',()=>{const app=useElderApp();app.go('family-detail','daughter');const before=app.state.data!.family[0]!.permissions['学习记录'];app.togglePermission('学习记录');expect(app.state.data!.family[0]!.permissions['学习记录']).toBe(!before);app.openConversation(1);expect(app.state.page).toBe('chat');expect(app.state.messages[0]?.text).toContain('视频聊天')})

it('prevents concurrent health checks', async () => {
  let release!:()=>void
  const request=vi.fn(()=>new Promise<void>(resolve=>{release=resolve}))
  const state=reactive({health:'尚未检查',checking:false})
  const health=useHealth(state,request)
  const first=health.check();const second=health.check();release();await Promise.all([first,second])
  expect(request).toHaveBeenCalledTimes(1)
})
