<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { ICONS } from '../../assets/icons'
import { createSosEventsProvider } from '../../data/sosEventsProvider'
import { nextSosAction, sosStatusLabel } from '../../domain/sosStatus'
import { messages } from '../../mock/data'
import type { MessageCategory, MessageItem } from '../../types'
import type { SosEventDto } from '../../types/sosEvents'

// 数字 id 走本地演示消息；SOS 事件 id 为 32 位 hex（后端 uuid4().hex），直查老人端后端
const SOS_EVENT_ID_PATTERN = /^[0-9a-f]{32}$/

const sosProvider = createSosEventsProvider()
const messageId = ref<number | null>(null)
const sosEventId = ref<string | null>(null)
const sosMessage = ref<MessageItem | null>(null)
const sosEvent = ref<SosEventDto | null>(null)
const sosNote = ref('')
const acting = ref(false)

const message = computed(() => {
  if (sosEventId.value !== null) return sosMessage.value
  return messages.find((m) => m.id === messageId.value) ?? null
})

// SOS 事件的状态标签与下一步处置动作（mock 模式无真实事件，不显示处置区）
const sosStatus = computed(() => (sosEvent.value === null ? null : sosStatusLabel(sosEvent.value.status)))
const sosAction = computed(() => (sosEvent.value === null ? null : nextSosAction(sosEvent.value.status)))

async function actOnSos() {
  const event = sosEvent.value
  const action = sosAction.value
  if (!event || !action || acting.value) return
  acting.value = true
  try {
    const note = action.asksNote && sosNote.value.trim().length > 0 ? sosNote.value.trim() : undefined
    sosEvent.value = await sosProvider.transition(event.id, action.to, note)
    sosNote.value = ''
    uni.showToast({ title: '已更新处理状态', icon: 'success' })
  } catch (error) {
    const text = error instanceof Error ? error.message : ''
    uni.showToast({
      title: text.includes('409') ? '状态已被更新，请返回重试' : '操作失败，请重试',
      icon: 'none',
    })
  } finally {
    acting.value = false
  }
}

const categoryIcons: Record<MessageCategory, string> = {
  健康提醒: ICONS.heartRed,
  求助消息: '',
  社区通知: ICONS.speakerBlue,
  系统消息: ICONS.bellBlue,
}

const categoryBgs: Record<MessageCategory, string> = {
  健康提醒: '#fdecec',
  求助消息: '#fdecec',
  社区通知: '#e8f1fd',
  系统消息: '#eef2f8',
}

onLoad((options) => {
  const raw = options?.id ?? ''
  if (SOS_EVENT_ID_PATTERN.test(raw)) {
    sosEventId.value = raw
    sosProvider
      .findEvent(raw)
      .then((event) => {
        if (event === null) {
          uni.showToast({ title: '未找到该求助事件', icon: 'none' })
          return
        }
        sosEvent.value = event
        return sosProvider.findById(raw).then((item) => {
          sosMessage.value = item
        })
      })
      .catch(() => {
        uni.showToast({ title: '求助事件加载失败', icon: 'none' })
      })
    return
  }
  const id = Number(raw)
  messageId.value = Number.isInteger(id) && id > 0 ? id : null
})
</script>

<template>
  <view class="page">
    <!-- 消息详情：SOS 事件为真实数据（api 模式），其余为虚构演示数据 -->
    <view v-if="message" class="card">
      <view class="head">
        <view class="msg-icon" :style="{ background: categoryBgs[message.category] }">
          <text v-if="message.category === '求助消息'" class="sos">SOS</text>
          <image v-else :src="categoryIcons[message.category]" mode="aspectFit" />
        </view>
        <view class="head-info">
          <text class="category">{{ message.category }}</text>
          <text class="time">{{ message.time }}</text>
        </view>
        <text v-if="sosStatus" class="status-chip" :class="'status-' + sosEvent?.status">{{ sosStatus }}</text>
      </view>
      <view class="title-row">
        <text class="title">{{ message.title }}</text>
        <text v-if="!sosEvent" class="demo-tag">演示数据</text>
      </view>
      <text class="summary">{{ message.summary }}</text>
      <text v-if="sosEvent?.note" class="event-note">处理备注：{{ sosEvent.note }}</text>
    </view>

    <!-- SOS 处置区：仅 api 模式且有真实事件时显示 -->
    <view v-if="sosEvent && sosAction" class="card action-card">
      <text class="action-title">处理操作</text>
      <input
        v-if="sosAction.asksNote"
        v-model="sosNote"
        class="note-input"
        placeholder="处理备注（选填，如：已电话确认老人安全）"
        :disabled="acting"
      />
      <button class="action-btn" :disabled="acting" @tap="actOnSos">
        {{ acting ? '提交中…' : sosAction.label }}
      </button>
    </view>

    <view v-if="!message" class="card empty">
      <text class="empty-text">未找到该消息，请返回重试</text>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f3f6fc;
  padding: 24rpx 32rpx 60rpx;
  box-sizing: border-box;
}
.card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 28rpx;
}
.head {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.msg-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.msg-icon image {
  width: 44rpx;
  height: 44rpx;
}
.sos {
  font-size: 24rpx;
  font-weight: 700;
  color: #ffffff;
  background: #ef4444;
  border-radius: 50%;
  width: 64rpx;
  height: 64rpx;
  line-height: 64rpx;
  text-align: center;
}
.head-info {
  flex: 1;
  margin-left: 24rpx;
}
.category {
  display: block;
  font-size: 24rpx;
  color: #8a94a6;
}
.time {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #9aa3b2;
}
.status-chip {
  flex-shrink: 0;
  margin-left: 16rpx;
  font-size: 22rpx;
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
}
.status-pending {
  color: #b45309;
  background: #fef3c7;
}
.status-processing {
  color: #1d4ed8;
  background: #dbeafe;
}
.status-resolved {
  color: #15803d;
  background: #dcfce7;
}
.title-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: 28rpx;
}
.title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2937;
}
.demo-tag {
  margin-left: 16rpx;
  font-size: 20rpx;
  color: #8a94a6;
  background: #eef2f8;
  border-radius: 999rpx;
  padding: 4rpx 16rpx;
}
.summary {
  display: block;
  margin-top: 20rpx;
  font-size: 26rpx;
  color: #6b7280;
  line-height: 1.7;
}
.event-note {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #8a94a6;
}
.action-card {
  margin-top: 24rpx;
}
.action-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #1f2937;
}
.note-input {
  margin-top: 20rpx;
  box-sizing: border-box;
  width: 100%;
  background: #f3f6fc;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  font-size: 26rpx;
  color: #1f2937;
}
.action-btn {
  margin-top: 24rpx;
  background: #ef4444;
  color: #ffffff;
  font-size: 28rpx;
  border-radius: 16rpx;
}
.action-btn[disabled] {
  opacity: 0.6;
}
.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80rpx 28rpx;
}
.empty-text {
  font-size: 26rpx;
  color: #9aa3b2;
}
</style>
