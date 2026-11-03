<script setup lang="ts">
// 使用帮助：纯静态说明页，无数据依赖，无跳转。
// 内容仅描述已实现的功能。
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="head">
        <text class="title">使用帮助</text>
        <text class="demo-tag">演示数据</text>
      </view>

      <view class="section">
        <text class="section-title">首页 · 老人画像</text>
        <text class="section-text">查看已绑定老人的基本信息、健康概况与近 7 天静息心率趋势。</text>
      </view>

      <view class="section">
        <text class="section-title">AI 建议</text>
        <text class="section-text">查看基于演示数据生成的关怀建议，点击卡片可查看详情。</text>
      </view>

      <view class="section">
        <text class="section-title">消息</text>
        <text class="section-text">按分类查看健康提醒、求助消息与社区通知。</text>
      </view>

      <view class="section">
        <text class="section-title">我的</text>
        <text class="section-text">查看监护人信息与功能入口。</text>
      </view>

      <view class="footer">
        <text class="footer-text">当前为演示版本，页面数据均为虚构示例。</text>
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
  padding: 32rpx 28rpx;
}
.head {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 8rpx;
}
.title {
  font-size: 34rpx;
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
.section {
  margin-top: 32rpx;
}
.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #2563eb;
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
}
.footer-text {
  font-size: 24rpx;
  color: #9aa3b2;
  line-height: 1.6;
}
</style>
