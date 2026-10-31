<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <view class="page-header">
    <view class="header-main">
      <view class="title">{{ title }}</view>
      <view v-if="subtitle" class="subtitle">{{ subtitle }}</view>
    </view>
    <view class="header-aside">
      <slot name="action" />
    </view>
  </view>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 21rpx;
  margin-bottom: 45rpx;
}

.header-main {
  min-width: 0;
}

.title {
  font-size: 51rpx;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.7rpx;
}

.subtitle {
  margin-top: 10rpx;
  color: #748097;
  font-size: 24rpx;
  line-height: 1.5;
}

.header-aside {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12rpx;
}
</style>
