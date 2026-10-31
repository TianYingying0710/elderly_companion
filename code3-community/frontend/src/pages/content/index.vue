<script setup lang="ts">
import PageHeader from '../../components/PageHeader.vue'
import ScreenIdentity from '../../components/ScreenIdentity.vue'

function open(url: string) {
  uni.navigateTo({ url })
}
</script>

<template>
  <view class="page">
    <ScreenIdentity />

    <PageHeader title="内容发布" subtitle="管理知识资料与助老课程" />

    <view class="content-list">
      <view class="content-card" @tap="open('/pages/teaching/index')">
        <view class="content-icon">▻</view>
        <view class="content-main">
          <view class="content-name">助老课程</view>
          <view class="content-desc">手机使用、微信、出行挂号与防诈骗教程</view>
        </view>
        <view class="content-side">
          <view>课程发布</view>
          <view class="chevron">›</view>
        </view>
      </view>

      <view class="content-card" @tap="open('/pages/knowledge/index')">
        <view class="content-icon">▤</view>
        <view class="content-main">
          <view class="content-name">知识资料</view>
          <view class="content-desc">上传 Word 资料，确认后提供给老人端 AI 使用</view>
        </view>
        <view class="content-side">
          <view>资料管理</view>
          <view class="chevron">›</view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 0 47rpx 40rpx;
  background: #f5f7fb;
  color: #1f2024;
  box-sizing: border-box;
}

.content-list {
  display: flex;
  flex-direction: column;
  gap: 35rpx;
}

.content-card {
  display: flex;
  align-items: center;
  gap: 30rpx;
  min-height: 230rpx;
  padding: 38rpx 35rpx;
  border-radius: 31rpx;
  background: #fff;
  box-sizing: border-box;
}

.content-icon {
  width: 89rpx;
  height: 89rpx;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #1678ee;
  background: #eaf2ff;
  font-size: 38rpx;
}

.content-main {
  flex: 1;
  min-width: 0;
}

.content-name {
  font-size: 30rpx;
  font-weight: 700;
}

.content-desc {
  margin-top: 12rpx;
  color: #555e6d;
  font-size: 23rpx;
  line-height: 1.6;
}

.content-side {
  flex: none;
  color: #61708c;
  font-size: 21rpx;
  text-align: right;
}

.chevron {
  margin-top: 16rpx;
  color: #4b5058;
  font-size: 52rpx;
  line-height: 0.7;
}
</style>
