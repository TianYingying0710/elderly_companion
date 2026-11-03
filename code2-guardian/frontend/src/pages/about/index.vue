<script setup lang="ts">
// 关于银龄伴：纯静态说明页，无数据依赖，无跳转。
// 仅展示产品定位与演示说明。
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="hero">
        <text class="name">银龄伴</text>
        <text class="tagline">关爱长辈 · 守护健康</text>
      </view>

      <view class="section">
        <text class="section-title">关于我们</text>
        <text class="section-text">银龄伴是一款面向监护人的健康关怀工具，帮助子女更好地关注家中老人的日常健康与生活状态。</text>
      </view>

      <view class="section">
        <text class="section-title">核心功能</text>
        <text class="section-text">老人健康画像 · AI 关怀建议 · 消息提醒 · 家庭看护</text>
      </view>

      <view class="footer">
        <text class="footer-text">当前为演示版本，页面数据均为虚构示例。</text>
        <text class="demo-tag">演示数据</text>
      </view>
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
  padding: 48rpx 28rpx;
}
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 32rpx;
}
.name {
  font-size: 44rpx;
  font-weight: 700;
  color: #2563eb;
}
.tagline {
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #8a94a6;
}
.section {
  margin-top: 28rpx;
}
.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
}
.section-text {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  color: #6b7280;
  line-height: 1.7;
}
.footer {
  margin-top: 40rpx;
  padding-top: 28rpx;
  border-top: 1rpx solid #f0f2f7;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.footer-text {
  font-size: 24rpx;
  color: #9aa3b2;
  line-height: 1.6;
  text-align: center;
}
.demo-tag {
  margin-top: 16rpx;
  font-size: 20rpx;
  color: #8a94a6;
  background: #eef2f8;
  border-radius: 999rpx;
  padding: 4rpx 16rpx;
}
</style>
