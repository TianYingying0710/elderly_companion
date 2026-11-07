<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { ICONS } from '../../assets/icons'
import { GUARDIAN_SECONDARY_ROUTES } from '../../domain/routes'
import { createSecondaryNavigator } from '../../domain/secondaryNavigation'
import { syncTabBar, type TabBarPage } from '../../domain/tabBarSync'
import { guardianInfo, menuItems } from '../../mock/data'

// 二级页面统一走 navigateTo，由 navigator 内部拦截重复点击、失败时提示。
const navigator = createSecondaryNavigator({
  navigateTo: (options) =>
    uni.navigateTo({ url: options.url, fail: options.fail, complete: options.complete }),
  showToast: (options) => uni.showToast({ title: options.title, icon: options.icon }),
})

// 仅「使用帮助」与「关于银龄伴」接入跳转；其余菜单项未规划目标页，统一提示，避免点击无响应。
function openMenuItem(id: number) {
  if (id === 5) {
    navigator.open(GUARDIAN_SECONDARY_ROUTES.help)
    return
  }
  if (id === 6) {
    navigator.open(GUARDIAN_SECONDARY_ROUTES.about)
    return
  }
  uni.showToast({ title: '功能建设中', icon: 'none' })
}

// 同步底部自定义 tabBar 高亮：原生组件不随页面切换刷新选中态
onShow(() => {
  const page = getCurrentPages()[getCurrentPages().length - 1] as unknown as TabBarPage
  syncTabBar(page?.getTabBar?.())
})
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

    <!-- 功能列表：「使用帮助」「关于银龄伴」跳转，其余点击提示「功能建设中」 -->
    <view class="menu">
      <view v-for="(item, idx) in menuItems" :key="item.id" class="menu-item" @tap="openMenuItem(item.id)">
        <view class="menu-row">
          <image class="menu-icon" :src="ICONS[item.icon]" mode="aspectFit" />
          <text class="menu-label">{{ item.label }}</text>
          <view v-if="item.id === 5 || item.id === 6" class="chevron" />
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
