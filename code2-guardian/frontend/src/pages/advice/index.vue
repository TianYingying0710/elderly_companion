<script setup lang="ts">
import TabBar from '../../components/TabBar.vue'
import { ICONS } from '../../assets/icons'
import { adviceBanner, adviceList } from '../../mock/data'
import type { AdviceIcon } from '../../types'

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
</script>

<template>
  <view class="page">
    <!-- 演示横幅 -->
    <view class="banner">
      <view class="banner-robot">
        <image :src="ICONS.robotBlue" mode="aspectFit" />
      </view>
      <view class="banner-text">
        <view class="banner-title-row">
          <text class="banner-title">{{ adviceBanner.title }}</text>
          <text class="demo-tag">演示数据</text>
        </view>
        <text class="banner-desc">{{ adviceBanner.desc }}</text>
      </view>
    </view>

    <!-- 建议列表 -->
    <view class="list">
      <view v-for="a in adviceList" :key="a.id" class="advice-card">
        <view class="advice-icon" :style="{ background: adviceIconBgs[a.icon] }">
          <image :src="adviceIcons[a.icon]" mode="aspectFit" />
        </view>
        <view class="advice-info">
          <text class="advice-title">{{ a.title }}</text>
          <text class="advice-desc">{{ a.desc }}</text>
        </view>
        <view class="chevron" />
      </view>
    </view>

    <TabBar current="advice" />
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f0f4fa;
  padding: 24rpx 32rpx 160rpx;
  box-sizing: border-box;
}
.banner {
  display: flex;
  flex-direction: row;
  align-items: center;
  background: #dfeaff;
  border-radius: 24rpx;
  padding: 28rpx;
}
.banner-robot {
  width: 88rpx;
  height: 88rpx;
  border-radius: 20rpx;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.banner-robot image {
  width: 52rpx;
  height: 52rpx;
}
.banner-text {
  flex: 1;
  margin-left: 24rpx;
}
.banner-title-row {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.banner-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #2563eb;
}
.demo-tag {
  margin-left: 16rpx;
  font-size: 20rpx;
  color: #8a94a6;
  background: #eef2f8;
  border-radius: 999rpx;
  padding: 4rpx 16rpx;
}
.banner-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6b7280;
}
.list {
  margin-top: 8rpx;
}
.advice-card {
  display: flex;
  flex-direction: row;
  align-items: center;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 30rpx 28rpx;
  margin-top: 24rpx;
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
.advice-info {
  flex: 1;
  margin-left: 24rpx;
  margin-right: 16rpx;
}
.advice-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
}
.advice-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #8a94a6;
  line-height: 1.6;
}
.chevron {
  width: 16rpx;
  height: 16rpx;
  border-top: 3rpx solid #c3cad6;
  border-right: 3rpx solid #c3cad6;
  transform: rotate(45deg);
  flex-shrink: 0;
}
</style>
