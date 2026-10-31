<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { ElderApp } from '../composables/useElderApp'
import AppIcon from '../components/AppIcon.vue'
const props = defineProps<{ app: ElderApp }>()
const bottom = ref<HTMLElement>()
async function send() { props.app.send(); await nextTick(); bottom.value?.scrollIntoView?.({ block: 'nearest' }) }
</script>
<template><div class="chat-layout"><header class="bar"><h1>AI 陪伴</h1><button @click="app.go('chat-history')">历史记录</button></header><div class="messages"><p class="explanation">{{ app.state.demo ? '预设对话为演示内容 · AI 未接通' : 'AI 服务尚未接入' }}</p><div v-for="(message, i) in app.state.messages" :key="i" class="message" :class="{ outgoing: message.role === 'user' }"><AppIcon :name="message.role === 'user' ? 'user' : 'chat'"/><div>{{ message.text }}<small v-if="message.local">本地草稿 · 未发送至 AI</small></div></div><div ref="bottom"/></div><form class="composer" @submit.prevent="send"><button type="button" aria-label="语音功能尚未开放" @click="app.state.feedback = '语音功能尚未开放，请使用文字输入'">◉</button><textarea v-model="app.state.draft" maxlength="4000" aria-label="聊天内容" placeholder="输入您想说的话"/><button type="submit" class="send" data-testid="send">发送</button></form></div></template>
