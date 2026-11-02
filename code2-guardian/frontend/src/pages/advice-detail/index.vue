<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { ICONS } from '../../assets/icons'
import { adviceList } from '../../mock/data'
import type { AdviceIcon } from '../../types'

const adviceId = ref<number | null>(null)

const advice = computed(() => adviceList.find((item) => item.id === adviceId.value) ?? null)

const adviceIcons: Record<AdviceIcon, string> = {
  walk: ICONS.walkGreen,
  chat: ICONS.chatSky,
  sleep: ICONS.bedIndigo,
  diet: ICONS.dietOrange,
}

const adviceIconBgs: Record<AdviceIcon, string> = {
  walk: '#e7f8ef',
  chat: '#e8f1fd',
  sleep: '#eceefd',
  diet: '#fdf3e7',
}

onLoad((options) => {
  const id = Number(options?.id)
  adviceId.value = Number.isInteger(id) && id > 0 ? id : null
})
</script>

<template>
  <view class="page">
    <!-- AI 建议详情（虚构演示数据，仅复用 mock/data.ts 现有字段） -->
    <view v-if="advice" class="card">
      <view class="head">
        <view class="advice-icon" :style="{ background: adviceIconBgs[advice.icon] }">
          <image :src="adviceIcons[advice.icon]" mode="aspectFit" />
        </view>
        <view class="title-row">
          <text class="title">{{ advice.title }}</text>
          <text class="demo-tag">演示数据</text>
        </view>
      </view>
      <text class="desc">{{ advice.desc }}</text>
    </view>

    <view v-else class="card empty">
      <text class="empty-text">未找到该建议，请返回重试</text>
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
.advice-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.advice-icon image {
  width: 44rpx;
  height: 44rpx;
}
.title-row {
  flex: 1;
  margin-left: 24rpx;
  display: flex;
  flex-direction: row;
  align-items: center;
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
.desc {
  display: block;
  margin-top: 28rpx;
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
