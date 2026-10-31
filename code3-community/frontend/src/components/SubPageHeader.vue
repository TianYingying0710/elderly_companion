<script setup lang="ts">
import { getStatusBarHeight } from '../utils/system'

defineProps<{
  title: string
  subtitle?: string
}>()

// 与 ScreenIdentity 保持同一顶距：微信胶囊按钮占「状态栏高度 + 44px」，
// 二级页右侧的新建按钮同样必须让开这一段。
const topOffset = getStatusBarHeight() + 44

function back() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
    return
  }
  uni.switchTab({ url: '/pages/content/index' })
}
</script>

<template>
  <view class="subpage-header" :style="{ paddingTop: topOffset + 'px' }">
    <view class="back-button" @tap="back">‹</view>
    <view class="header-text">
      <view class="title">{{ title }}</view>
      <view v-if="subtitle" class="subtitle">{{ subtitle }}</view>
    </view>
    <view class="header-aside">
      <slot name="action" />
    </view>
  </view>
</template>

<style scoped>
.subpage-header {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding-bottom: 42rpx;
}

.back-button {
  width: 66rpx;
  height: 66rpx;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #fff;
  color: #414753;
  font-size: 44rpx;
  line-height: 1;
}

.header-text {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 44rpx;
  font-weight: 700;
  line-height: 1.2;
}

.subtitle {
  margin-top: 10rpx;
  color: #748097;
  font-size: 24rpx;
}

.header-aside {
  flex: none;
}
</style>
