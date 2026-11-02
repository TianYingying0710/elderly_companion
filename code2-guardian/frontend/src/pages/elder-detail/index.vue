<script setup lang="ts">
import { ICONS } from '../../assets/icons'
import { elderProfile } from '../../mock/data'

// 只呈现 mock/data.ts 中已存在的四个字段，不新增任何演示数据之外的档案信息。
const profileFields = [
  { label: '姓名', value: elderProfile.name },
  { label: '年龄', value: `${elderProfile.age} 岁` },
  { label: '与我的关系', value: elderProfile.relation },
  { label: '绑定状态', value: elderProfile.boundLabel },
]
</script>

<template>
  <view class="page">
    <!-- 老人档案（虚构演示数据） -->
    <view class="card profile-card">
      <view class="avatar">
        <image class="avatar-icon" :src="ICONS.userWhite" mode="aspectFit" />
      </view>
      <view class="profile-text">
        <text class="profile-name">{{ elderProfile.name }} {{ elderProfile.age }}岁</text>
        <text class="profile-sub">{{ elderProfile.relation }}｜{{ elderProfile.boundLabel }}</text>
      </view>
      <text class="demo-tag">演示数据</text>
    </view>

    <view class="card">
      <text class="card-title">档案信息</text>
      <view v-for="field in profileFields" :key="field.label" class="field">
        <text class="field-label">{{ field.label }}</text>
        <text class="field-value">{{ field.value }}</text>
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
  margin-bottom: 24rpx;
}
.profile-card {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.avatar {
  width: 92rpx;
  height: 92rpx;
  border-radius: 50%;
  background: #bfd4f7;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.avatar-icon {
  width: 52rpx;
  height: 52rpx;
}
.profile-text {
  flex: 1;
  margin-left: 24rpx;
}
.profile-name {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2937;
}
.profile-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #8a94a6;
}
.demo-tag {
  padding: 3rpx 12rpx;
  border-radius: 999rpx;
  background: #eef2f8;
  color: #8a94a6;
  font-size: 20rpx;
  flex-shrink: 0;
}
.card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
}
.field {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f1f4fa;
}
.field:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.field-label {
  font-size: 26rpx;
  color: #6b7280;
}
.field-value {
  font-size: 26rpx;
  color: #1f2937;
  font-weight: 500;
}
</style>
