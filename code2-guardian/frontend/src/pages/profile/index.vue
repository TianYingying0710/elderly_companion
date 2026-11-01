<script setup lang="ts">
import { ICONS } from '../../assets/icons'
import { guardianInfo, menuItems } from '../../mock/data'
</script>

<template>
  <view class="page">
    <!-- 监护人信息 -->
    <view class="profile">
      <view class="avatar">
        <image :src="ICONS.userWhite" mode="aspectFit" />
      </view>
      <view class="profile-info">
        <text class="profile-name">{{ guardianInfo.name }}</text>
        <text class="profile-phone">{{ guardianInfo.phone }}</text>
      </view>
    </view>

    <!-- 功能列表（只读展示） -->
    <view class="menu">
      <view v-for="(item, idx) in menuItems" :key="item.id" class="menu-item">
        <view class="menu-row">
          <image class="menu-icon" :src="ICONS[item.icon]" mode="aspectFit" />
          <text class="menu-label">{{ item.label }}</text>
          <view class="chevron" />
        </view>
        <view v-if="idx < menuItems.length - 1" class="divider" />
      </view>
    </view>

  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f0f4fa;
  padding: 24rpx 32rpx 160rpx;
  box-sizing: border-box;
}
.profile {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 20rpx 8rpx 32rpx;
}
.avatar {
  width: 108rpx;
  height: 108rpx;
  border-radius: 50%;
  background: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.avatar image {
  width: 60rpx;
  height: 60rpx;
}
.profile-info {
  margin-left: 28rpx;
}
.profile-name {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #1f2937;
}
.profile-phone {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  color: #8a94a6;
}
.menu {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 8rpx 28rpx;
}
.menu-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 30rpx 0;
}
.menu-icon {
  width: 40rpx;
  height: 40rpx;
  flex-shrink: 0;
}
.menu-label {
  flex: 1;
  margin-left: 24rpx;
  font-size: 30rpx;
  color: #1f2937;
}
.chevron {
  width: 16rpx;
  height: 16rpx;
  border-top: 3rpx solid #c3cad6;
  border-right: 3rpx solid #c3cad6;
  transform: rotate(45deg);
  flex-shrink: 0;
}
.divider {
  height: 1rpx;
  background: #f0f2f7;
}
</style>
