<script setup lang="ts">
import { ICONS } from '../../assets/icons'
import { reminders } from '../../mock/data'

// 只读列表：条目本身不绑定点击，页面上没有任何可操作控件。
const reminderIcons: Record<string, string> = {
  pill: ICONS.pillOrange,
  walk: ICONS.walkGreen,
}
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="card-head">
        <text class="card-title">今日提醒（{{ reminders.length }}）</text>
        <text class="demo-tag">演示数据</text>
      </view>
      <view v-for="item in reminders" :key="item.id" class="reminder">
        <view class="reminder-icon">
          <image :src="reminderIcons[item.icon]" mode="aspectFit" />
        </view>
        <view class="reminder-info">
          <text class="reminder-title">{{ item.title }}</text>
          <text class="reminder-time">{{ item.time }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f3f6fc;
  padding: 24rpx 32rpx 60rpx;
}
.card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 28rpx;
}
.card-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
.card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
}
.demo-tag {
  padding: 3rpx 12rpx;
  border-radius: 999rpx;
  background: #eef2f8;
  color: #8a94a6;
  font-size: 20rpx;
}
.reminder {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: 28rpx;
}
.reminder-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  background: #fdf3e7;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.reminder-icon image {
  width: 40rpx;
  height: 40rpx;
}
.reminder-info {
  flex: 1;
  margin-left: 22rpx;
}
.reminder-title {
  display: block;
  font-size: 28rpx;
  color: #1f2937;
  font-weight: 500;
}
.reminder-time {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #9aa3b2;
}
</style>
