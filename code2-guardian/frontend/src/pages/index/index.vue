<script setup lang="ts">
import { apiBaseUrl } from '../../api/client'
</script>

<template>
  <view class="shell">
    <text class="eyebrow">Silver Companion</text>
    <text class="title">银龄伴 · 监护人端</text>
    <text class="description">微信小程序空白框架已就绪，业务功能待后续开发。</text>
    <text class="api">后端地址：{{ apiBaseUrl }}</text>
  </view>
</template>

<style scoped>
.shell { padding: 96rpx 48rpx; }
.eyebrow, .title, .description, .api { display: block; }
.eyebrow { color: #2563eb; font-size: 26rpx; }
.title { margin-top: 20rpx; font-size: 48rpx; font-weight: 700; }
.description { margin-top: 28rpx; color: #4b5563; font-size: 30rpx; line-height: 1.7; }
.api { margin-top: 40rpx; color: #6b7280; font-size: 24rpx; word-break: break-all; }
</style>
