<script setup lang="ts">
import { ICONS } from '../assets/icons'
import type { TabKey } from '../types'

const props = defineProps<{ current: TabKey }>()

const tabs: Array<{ key: TabKey; label: string; icon: string; url: string }> = [
  { key: 'home', label: '老人画像', icon: 'home', url: '/pages/index/index' },
  { key: 'advice', label: 'AI建议', icon: 'robot', url: '/pages/advice/index' },
  { key: 'messages', label: '消息', icon: 'chat', url: '/pages/messages/index' },
  { key: 'profile', label: '我的', icon: 'user', url: '/pages/profile/index' },
]

function iconSrc(key: string, active: boolean): string {
  return ICONS[active ? `${key}Blue` : `${key}Gray`]
}

function go(key: TabKey, url: string) {
  if (key !== props.current) {
    uni.redirectTo({ url })
  }
}
</script>

<template>
  <view class="tabbar">
    <view
      v-for="t in tabs"
      :key="t.key"
      class="tab-item"
      @tap="go(t.key, t.url)"
    >
      <image class="tab-icon" :src="iconSrc(t.icon, t.key === current)" mode="aspectFit" />
      <text class="tab-label" :class="{ active: t.key === current }">{{ t.label }}</text>
    </view>
  </view>
</template>

<style scoped>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  background: #ffffff;
  border-top: 1rpx solid #e8edf5;
  padding: 14rpx 0 calc(14rpx + env(safe-area-inset-bottom));
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.tab-icon {
  width: 46rpx;
  height: 46rpx;
}
.tab-label {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #9aa3b2;
}
.tab-label.active {
  color: #2563eb;
  font-weight: 500;
}
</style>
