<script setup lang="ts">
import type { ElderApp, Page } from '../composables/useElderApp'
import PageHero from '../components/PageHero.vue'
import AppIcon from '../components/AppIcon.vue'
import CourseList from '../components/CourseList.vue'
defineProps<{ app: ElderApp }>()
const date = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())
const tiles: { page: Page; title: string; detail: string; color: string }[] = [
 {page:'chat',title:'AI陪伴',detail:'聊聊天 问问题',color:'blue'}, {page:'learn',title:'数字教学',detail:'学手机 学知识',color:'gold'}, {page:'service',title:'社区服务',detail:'查流程 办事情',color:'green'}, {page:'sos',title:'一键求助',detail:'紧急情况求助',color:'red'},
]
</script>
<template><PageHero :title="app.state.data ? `您好，${app.state.data.profile.name}！` : '您好，欢迎回来'" :subtitle="date + ' · 愿您今天心情愉快'"/><div class="content"><div class="grid"><button v-for="tile in tiles" :key="tile.page" class="tile" :class="tile.color" :data-testid="tile.page === 'sos' ? 'help' : undefined" @click="tile.page === 'sos' ? app.help() : app.go(tile.page)"><AppIcon :name="tile.page"/><strong>{{ tile.title }}</strong><small>{{ tile.detail }}</small></button></div><section class="card warm"><div class="section-title"><h2>今日提醒</h2><button @click="app.go('messages')">查看 ›</button></div><button v-if="app.state.data" class="reminder" @click="app.go('message-detail', 'class')"><strong>{{ app.state.data.reminder.title }}</strong><p>{{ app.state.data.reminder.text }}</p><small>演示提醒 ›</small></button><p v-else class="empty">提醒服务尚未接入</p></section><section class="card"><div class="section-title"><h2>为您推荐</h2><button @click="app.go('learn')">更多 ›</button></div><CourseList v-if="app.state.data" :courses="app.state.data.courses.slice(0, 2)" @select="app.go('course-detail', $event)"/><p v-else class="empty">课程内容尚未接入</p></section></div></template>
