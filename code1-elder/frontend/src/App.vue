<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useElderApp } from './composables/useElderApp'
import type { Page } from './composables/useElderApp'
import HomePage from './pages/HomePage.vue'
import ChatPage from './pages/ChatPage.vue'
import LearningPage from './pages/LearningPage.vue'
import SosPage from './pages/SosPage.vue'
import AppIcon from './components/AppIcon.vue'
import AccountHomePage from './pages/account/AccountHomePage.vue'
import SettingsPage from './pages/account/SettingsPage.vue'
import ProfilePage from './pages/account/ProfilePage.vue'
import DevicesPage from './pages/account/DevicesPage.vue'
import FamilyPage from './pages/account/FamilyPage.vue'
import FamilyDetailPage from './pages/account/FamilyDetailPage.vue'
import RequestsPage from './pages/account/RequestsPage.vue'
import MessagesPage from './pages/account/MessagesPage.vue'
import MessageDetailPage from './pages/account/MessageDetailPage.vue'
import ChatHistoryPage from './pages/account/ChatHistoryPage.vue'
import ServicePage from './pages/service/ServicePage.vue'
import ServiceDetailPage from './pages/service/ServiceDetailPage.vue'
const app = useElderApp()
const screen = ref<HTMLElement>()
const modal = ref<HTMLElement>()
let previousFocus: HTMLElement | null = null
const mainPages: Page[] = ['home', 'chat', 'learn', 'me']
const learnPages: Page[] = ['learn', 'course-detail', 'learning-history']
const titles: Partial<Record<Page, string>> = { settings:'使用设置', profile:'个人资料', devices:'我的设备', family:'家人绑定与共享权限', 'family-detail':'共享权限', 'course-detail':'课程详情', 'learning-history':'学习记录', service:'社区服务', 'service-detail':'办事流程详情', messages:'消息通知', 'message-detail':'消息详情', 'chat-history':'聊天记录', requests:'我的求助', sos:'求助进度' }
const activeTab = computed(() => learnPages.includes(app.state.page) ? 'learn' : app.state.page === 'chat-history' ? 'chat' : ['service','service-detail','sos'].includes(app.state.page) ? 'home' : mainPages.includes(app.state.page) ? app.state.page : 'me')
const tabs: {page: Page; label: string; icon: string}[] = [{page:'home',label:'首页',icon:'home'},{page:'chat',label:'陪伴',icon:'chat'},{page:'learn',label:'教学',icon:'learn'},{page:'me',label:'我的',icon:'user'}]
watch(() => app.state.page, async () => { await nextTick(); if(screen.value)screen.value.scrollTop = 0 })
watch(() => app.state.modal, async (value) => {
 if(value){previousFocus=document.activeElement as HTMLElement;await nextTick();modal.value?.querySelector<HTMLButtonElement>('.secondary')?.focus()}
 else previousFocus?.focus()
})
function modalKeys(event: KeyboardEvent) {
 if(event.key==='Escape')app.state.modal=null
 if(event.key!=='Tab')return
 const buttons=modal.value?.querySelectorAll<HTMLButtonElement>('button');if(!buttons?.length)return
 const first=buttons[0]!,last=buttons[buttons.length-1]!
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
}
const nativeBack=(event:Event)=>{if(app.state.modal || app.state.page !== 'home'){event.preventDefault();app.back()}}
onMounted(()=>window.addEventListener('elder-back',nativeBack))
onBeforeUnmount(()=>window.removeEventListener('elder-back',nativeBack))
</script>
<template><div class="app" :class="{ large: app.state.large }"><div class="app-main" :inert="app.state.modal !== null"><div class="mode"><span>{{ app.state.demo ? '演示模式 · 全部业务数据为模拟' : '业务模式 · 服务尚未接入' }}</span><button data-testid="mode-toggle" @click="app.toggleDemo()">{{ app.state.demo ? '关闭演示' : '开启演示' }}</button></div><div ref="screen" class="screen"><header v-if="!mainPages.includes(app.state.page)" class="bar"><button aria-label="返回" class="back" @click="app.back()">‹</button><h1>{{ titles[app.state.page] }}</h1></header><HomePage v-if="app.state.page==='home'" :app="app"/><ChatPage v-else-if="app.state.page==='chat'" :app="app"/><LearningPage v-else-if="learnPages.includes(app.state.page)" :app="app"/><SosPage v-else-if="app.state.page==='sos'" :app="app"/><AccountHomePage v-else-if="app.state.page==='me'" :app="app"/><SettingsPage v-else-if="app.state.page==='settings'" :app="app"/><ProfilePage v-else-if="app.state.page==='profile'" :app="app"/><DevicesPage v-else-if="app.state.page==='devices'" :app="app"/><FamilyPage v-else-if="app.state.page==='family'" :app="app"/><FamilyDetailPage v-else-if="app.state.page==='family-detail'" :app="app"/><RequestsPage v-else-if="app.state.page==='requests'" :app="app"/><MessagesPage v-else-if="app.state.page==='messages'" :app="app"/><MessageDetailPage v-else-if="app.state.page==='message-detail'" :app="app"/><ChatHistoryPage v-else-if="app.state.page==='chat-history'" :app="app"/><ServicePage v-else-if="app.state.page==='service'" :app="app"/><ServiceDetailPage v-else-if="app.state.page==='service-detail'" :app="app"/></div><div v-if="app.state.feedback" class="feedback" role="status"><span>{{ app.state.feedback }}</span><button aria-label="关闭提示" @click="app.state.feedback=''">×</button></div><nav aria-label="主导航"><button v-for="tab in tabs" :key="tab.page" :data-testid="'nav-'+tab.page" :class="{active:activeTab===tab.page}" :aria-current="activeTab===tab.page?'page':undefined" @click="app.go(tab.page)"><AppIcon :name="tab.icon"/><span>{{ tab.label }}</span></button></nav></div><div v-if="app.state.modal" class="overlay" @keydown="modalKeys"><section ref="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" class="modal"><h1 id="dialog-title">{{ app.state.modal==='start'?'向家人和社区求助？':'确认取消本次求助？' }}</h1><p>{{ app.state.modal==='start'?'无需填写原因，确认后进入模拟发送流程。':app.state.reached?'演示流程中，已收到求助的对象会同步收到取消通知。':'将停止本次演示发送流程。' }}</p><p class="demo-note">模拟求助 · 不会实际通知任何人</p><button v-if="app.state.modal==='start'" class="primary wide" data-testid="confirm-help" @click="app.startHelp()">确认求助</button><button v-else class="primary wide" data-testid="confirm-cancel" @click="app.cancelHelp()">确认取消求助</button><button class="secondary wide" @click="app.state.modal=null">{{ app.state.modal==='start'?'取消':'继续求助' }}</button></section></div></div></template>
