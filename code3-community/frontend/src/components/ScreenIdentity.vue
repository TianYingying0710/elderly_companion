<script setup lang="ts">
import { getStatusBarHeight } from '../utils/system'

defineProps<{
  role?: string
}>()

// 自定义导航栏下，微信胶囊按钮占据「状态栏高度 + 44px」这一段，
// 品牌行必须整体下移，否则右侧的角色标签会被胶囊压住。
const topOffset = getStatusBarHeight() + 44
</script>

<template>
  <view class="identity" :style="{ paddingTop: topOffset + 'px' }">
    <view class="brand">银龄伴 · 社区协同端</view>
    <view class="role-pill">{{ role || '社区工作人员' }}</view>
  </view>
</template>

<style scoped>
.identity {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 52rpx;
  box-sizing: content-box;
}

.brand {
  color: #52627d;
  font-size: 21rpx;
  font-weight: 800;
  letter-spacing: 0.7rpx;
}

.role-pill {
  flex: none;
  padding: 10rpx 17rpx;
  border-radius: 999rpx;
  color: #2e63c3;
  background: #e8eefc;
  font-size: 19rpx;
  font-weight: 700;
}
</style>
