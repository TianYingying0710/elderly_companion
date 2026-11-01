<script setup lang="ts">
import { computed, ref } from 'vue'
import TabBar from '../../components/TabBar.vue'
import { ICONS } from '../../assets/icons'
import { filterMessages, MESSAGE_FILTERS } from '../../domain/messages'
import { messages } from '../../mock/data'
import type { MessageCategory, MessageFilter } from '../../types'

const current = ref<MessageFilter>('全部')
const filtered = computed(() => filterMessages(messages, current.value))

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
</script>

<template>
  <view class="page">
    <!-- 筛选胶囊 -->
    <scroll-view class="chips" scroll-x :show-scrollbar="false">
      <view class="chips-row">
        <view
          v-for="f in MESSAGE_FILTERS"
          :key="f"
          class="chip"
          :class="{ active: f === current }"
          @tap="current = f"
        >
          <text>{{ f }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 消息列表 -->
    <view class="list">
      <view v-for="m in filtered" :key="m.id" class="msg-card">
        <view class="msg-icon" :style="{ background: categoryBgs[m.category] }">
          <text v-if="m.category === '求助消息'" class="sos">SOS</text>
          <image v-else :src="categoryIcons[m.category]" mode="aspectFit" />
        </view>
        <view class="msg-info">
          <view class="msg-head">
            <text class="msg-title">{{ m.title }}</text>
            <text class="msg-time">{{ m.time }}</text>
          </view>
          <text class="msg-summary">{{ m.summary }}</text>
        </view>
      </view>
    </view>

    <TabBar current="messages" />
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f0f4fa;
  padding: 24rpx 0 160rpx;
  box-sizing: border-box;
}
.chips {
  width: 100%;
  white-space: nowrap;
}
.chips-row {
  display: flex;
  flex-direction: row;
  padding: 0 32rpx;
}
.chip {
  flex-shrink: 0;
  background: #ffffff;
  border-radius: 999rpx;
  padding: 12rpx 32rpx;
  margin-right: 20rpx;
}
.chip text {
  font-size: 26rpx;
  color: #6b7280;
}
.chip.active {
  background: #2563eb;
}
.chip.active text {
  color: #ffffff;
  font-weight: 500;
}
.list {
  padding: 0 32rpx;
  margin-top: 8rpx;
}
.msg-card {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 30rpx 28rpx;
  margin-top: 24rpx;
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
.msg-info {
  flex: 1;
  margin-left: 24rpx;
}
.msg-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
.msg-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
}
.msg-time {
  font-size: 22rpx;
  color: #9aa3b2;
}
.msg-summary {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #8a94a6;
  line-height: 1.6;
}
</style>
