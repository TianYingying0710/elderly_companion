<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { ICONS } from '../../assets/icons'
import { createSosEventsProvider } from '../../data/sosEventsProvider'
import { messages } from '../../mock/data'
import type { MessageCategory, MessageItem } from '../../types'

// 数字 id 走本地演示消息；SOS 事件 id 为 32 位 hex（后端 uuid4().hex），直查老人端后端
const SOS_EVENT_ID_PATTERN = /^[0-9a-f]{32}$/

const sosProvider = createSosEventsProvider()
const messageId = ref<number | null>(null)
const sosEventId = ref<string | null>(null)
const sosMessage = ref<MessageItem | null>(null)

const message = computed(() => {
  if (sosEventId.value !== null) return sosMessage.value
  return messages.find((m) => m.id === messageId.value) ?? null
})

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
      .findById(raw)
      .then((item) => {
        sosMessage.value = item
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
    <!-- 消息详情（虚构演示数据，仅复用 mock/data.ts 现有字段） -->
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
      </view>
      <view class="title-row">
        <text class="title">{{ message.title }}</text>
        <text class="demo-tag">演示数据</text>
      </view>
      <text class="summary">{{ message.summary }}</text>
    </view>

    <view v-else class="card empty">
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
