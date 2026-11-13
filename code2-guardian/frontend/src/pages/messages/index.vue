<script setup lang="ts">
import { computed, ref } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { ICONS } from '../../assets/icons'
import { GUARDIAN_SECONDARY_ROUTES } from '../../domain/routes'
import { createSecondaryNavigator } from '../../domain/secondaryNavigation'
import { createSosPolling } from '../../domain/sosAutoRefresh'
import { syncTabBar, type TabBarPage } from '../../domain/tabBarSync'
import { filterMessages, MESSAGE_FILTERS } from '../../domain/messages'
import { createSosEventsProvider } from '../../data/sosEventsProvider'
import { messages } from '../../mock/data'
import type { MessageCategory, MessageFilter, MessageItem } from '../../types'

// SOS 事件 Provider：mock 模式返回空列表（消息中心维持演示现状）；
// api 模式直查老人端后端，把真实求助事件合并进消息列表（SOS 置顶）。
const sosProvider = createSosEventsProvider()
const sosMessages = ref<MessageItem[]>([])
// 轮询发现的新事件数量（首次加载不提示），点击「知道了」清除
const newSosCount = ref(0)

const current = ref<MessageFilter>('全部')
const filtered = computed(() => filterMessages([...sosMessages.value, ...messages], current.value))

// 页面可见期间每 30 秒轮询一次 SOS 事件（无实时推送前提下的兜底），离开页面即停
const sosPolling = createSosPolling({
  fetch: () => sosProvider.list(),
  apply: (items) => {
    sosMessages.value = items
  },
  notifyNew: (count) => {
    newSosCount.value = count
  },
})

// 二级页面统一走 navigateTo，由 navigator 内部拦截重复点击、失败时提示。
const navigator = createSecondaryNavigator({
  navigateTo: (options) =>
    uni.navigateTo({ url: options.url, fail: options.fail, complete: options.complete }),
  showToast: (options) => uni.showToast({ title: options.title, icon: options.icon }),
})

function openMessageDetail(id: number | string) {
  navigator.open(`${GUARDIAN_SECONDARY_ROUTES.messageDetail}?id=${id}`)
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

// 同步底部自定义 tabBar 高亮：原生组件不随页面切换刷新选中态；
// 每次进入页面刷新 SOS 事件并恢复轮询（api 模式直查老人端后端，失败提示且保留演示消息）
onShow(() => {
  const page = getCurrentPages()[getCurrentPages().length - 1] as unknown as TabBarPage
  syncTabBar(page?.getTabBar?.())
  sosProvider
    .list()
    .then((items) => {
      sosMessages.value = items
    })
    .catch(() => {
      uni.showToast({ title: '求助事件加载失败', icon: 'none' })
    })
  sosPolling.onShow()
})

onHide(() => {
  sosPolling.onHide()
})

function dismissNewSos() {
  newSosCount.value = 0
}
</script>

<template>
  <view class="page">
    <!-- 新求助提示条：轮询发现新事件时出现，不弹窗打扰 -->
    <view v-if="newSosCount > 0" class="sos-banner" @tap="dismissNewSos">
      <text class="sos-banner-text">有 {{ newSosCount }} 条新的求助消息</text>
      <text class="sos-banner-action">知道了</text>
    </view>

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
      <view v-for="m in filtered" :key="m.id" class="msg-card" @tap="openMessageDetail(m.id)">
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

  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f0f4fa;
  padding: 24rpx 0 160rpx;
  box-sizing: border-box;
}
.sos-banner {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  background: #fdecec;
  border: 2rpx solid #ef4444;
  border-radius: 16rpx;
  padding: 20rpx 28rpx;
  margin: 0 32rpx;
}
.sos-banner-text {
  font-size: 26rpx;
  font-weight: 600;
  color: #b91c1c;
}
.sos-banner-action {
  font-size: 26rpx;
  color: #6b7280;
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
