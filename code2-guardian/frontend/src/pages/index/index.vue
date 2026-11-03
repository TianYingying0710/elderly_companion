<script setup lang="ts">
import { getCurrentInstance, onMounted, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { ICONS } from '../../assets/icons'
import { syncTabBar, type TabBarPage } from '../../domain/tabBarSync'
import { buildTrendPoints, heartRateTrend } from '../../domain/healthTrend'
import {
  DEFAULT_PIXEL_RATIO,
  buildTrendAreaPath,
  isCanvasMeasurable,
  resolveCanvasBitmap,
  resolveTouchRegion,
} from '../../domain/trendCanvas'
import { GUARDIAN_SECONDARY_ROUTES } from '../../domain/routes'
import { createSecondaryNavigator } from '../../domain/secondaryNavigation'
import { useHealthData } from '../../composables/useHealthData'
import { MockHealthDataProvider } from '../../data/healthDataProvider'
import {
  elderProfile,
  reminders,
} from '../../mock/data'

const instance = getCurrentInstance()

const statusBarHeight = uni.getSystemInfoSync().statusBarHeight ?? 0

// 健康数据只通过 Provider 获取，不直接读 mock 的健康常量。
const healthProvider = new MockHealthDataProvider()
const { snapshot: healthSnapshot } = useHealthData(healthProvider)

const metricIcons: Record<string, string> = {
  heartRate: ICONS.heartRed,
  bloodPressure: ICONS.dropBlue,
  sleep: ICONS.moonIndigo,
}

const reminderIcons: Record<string, string> = {
  pill: ICONS.pillOrange,
  walk: ICONS.walkGreen,
}

// 二级页面统一走 navigateTo，并由 navigator 内部拦截重复点击、失败时提示。
const navigator = createSecondaryNavigator({
  navigateTo: (options) =>
    uni.navigateTo({ url: options.url, fail: options.fail, complete: options.complete }),
  showToast: (options) => uni.showToast({ title: options.title, icon: options.icon }),
})

function openElderDetail() {
  navigator.open(GUARDIAN_SECONDARY_ROUTES.elderDetail)
}

function openHealthTrend() {
  navigator.open(GUARDIAN_SECONDARY_ROUTES.healthTrend)
}

function openReminders() {
  navigator.open(GUARDIAN_SECONDARY_ROUTES.reminders)
}

/** 绘制近 7 天趋势折线（虚构演示数据） */
function drawTrend() {
  const query = uni.createSelectorQuery().in(instance?.proxy)
  query
    .select('#trendCanvas')
    .fields({ node: true, size: true }, (res) => {
      const { node, width, height } = res as unknown as {
        node: HTMLCanvasElement
        width: number
        height: number
      }
      const dpr = uni.getSystemInfoSync().pixelRatio || DEFAULT_PIXEL_RATIO
      // 尺寸未就绪（0 或 NaN）时不绘制，避免画出一条贴边的假曲线
      if (!node) return
      const metrics = { width, height, dpr }
      if (!isCanvasMeasurable(metrics)) return

      const bitmap = resolveCanvasBitmap(metrics)
      node.width = bitmap.width
      node.height = bitmap.height
      const ctx = node.getContext('2d')
      if (!ctx) return

      // 只缩放绘制坐标系，不改元素布局尺寸：位图比样式尺寸大，但显示框不变
      const touch = resolveTouchRegion(metrics)
      ctx.setTransform(bitmap.width / touch.width, 0, 0, bitmap.height / touch.height, 0, 0)
      ctx.clearRect(0, 0, touch.width, touch.height)

      const padding = { left: 10, right: 10, top: 10, bottom: 12 }
      const trend = healthSnapshot.value?.trend ?? []
      const pts = buildTrendPoints(trend.map((point) => point.value), touch.width, touch.height, padding)
      if (pts.length === 0) return
      const { top, baseline } = buildTrendAreaPath(pts, metrics, padding)

      ctx.save()
      ctx.beginPath()
      ctx.rect(padding.left, padding.top, touch.width - padding.left - padding.right, touch.height - padding.top - padding.bottom)
      ctx.clip()

      // 面积填充
      ctx.beginPath()
      ctx.moveTo(top[0].x, top[0].y)
      for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y)
      ctx.lineTo(top[top.length - 1].x, baseline)
      ctx.lineTo(top[0].x, baseline)
      ctx.closePath()
      ctx.fillStyle = 'rgba(37, 99, 235, 0.08)'
      ctx.fill()

      // 折线
      ctx.beginPath()
      ctx.moveTo(top[0].x, top[0].y)
      for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y)
      ctx.strokeStyle = '#2563eb'
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.stroke()
      ctx.restore()
    })
    .exec()
}

onMounted(drawTrend)

// 快照就绪（含 has_data/stale）后重绘趋势；其余状态 trend 为空，drawTrend 内部会跳过。
watch(healthSnapshot, () => drawTrend())

// 同步底部自定义 tabBar 高亮：原生组件不随页面切换刷新选中态
onShow(() => {
  const page = getCurrentPages()[getCurrentPages().length - 1] as unknown as TabBarPage
  syncTabBar(page?.getTabBar?.())
})
</script>

<template>
  <view class="page">
    <!-- 渐变头部（自定义导航，含状态栏） -->
    <view class="header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="header-row">
        <view class="header-text">
          <text class="header-title">银龄伴·监护人端</text>
          <text class="header-sub">关爱长辈·守护健康</text>
        </view>
        <image class="header-heart" :src="ICONS.heartLight" mode="aspectFit" />
      </view>

      <!-- 老人卡片 -->
      <view class="card elder-card" @tap="openElderDetail">
        <view class="avatar avatar-elder">
          <image class="avatar-icon" :src="ICONS.userWhite" mode="aspectFit" />
        </view>
        <view class="elder-info">
          <text class="elder-name">{{ elderProfile.name }} {{ elderProfile.age }}岁</text>
          <text class="elder-sub">{{ elderProfile.relation }}｜{{ elderProfile.boundLabel }}</text>
        </view>
        <view class="chevron" />
      </view>
    </view>

    <view class="body">
      <!-- 健康概况（状态化：有数据/过期才显示数值，否则空态） -->
      <view class="card">
        <view class="card-head">
          <text class="card-title">健康概况</text>
          <view class="health-meta">
            <text v-if="healthSnapshot?.isDemo" class="demo-tag">演示数据</text>
            <text v-if="healthSnapshot?.updatedAt" class="card-extra">{{ healthSnapshot.updatedAt }}</text>
          </view>
        </view>

        <!-- 有数据 / 过期：显示指标 -->
        <view v-if="healthSnapshot && (healthSnapshot.state === 'has_data' || healthSnapshot.state === 'stale')" class="metrics">
          <view v-for="m in healthSnapshot.metrics" :key="m.key" class="metric">
            <view class="metric-icon">
              <image :src="metricIcons[m.key]" mode="aspectFit" />
            </view>
            <text class="metric-label">{{ m.label }}</text>
            <text class="metric-value">{{ m.value }}</text>
            <text class="metric-unit">{{ m.unit }}</text>
            <text class="badge">{{ m.badge }}</text>
          </view>
        </view>

        <!-- 空态：未接入 / 连接中 / 暂无数据 / 异常 -->
        <view v-else class="health-empty">
          <text class="empty-text">{{ healthSnapshot?.message ?? '正在连接' }}</text>
        </view>
      </view>

      <!-- 健康趋势（状态化：有数据/过期才绘制曲线） -->
      <view class="card trend-card">
        <view class="card-head" @tap="openHealthTrend">
          <view>
            <view class="trend-title-row">
              <text class="card-title">近7天健康趋势</text>
              <text v-if="healthSnapshot?.isDemo" class="demo-tag">演示数据</text>
            </view>
            <text class="trend-metric">每日平均静息心率（次/分）</text>
          </view>
          <view class="chevron" />
        </view>

        <template v-if="healthSnapshot && (healthSnapshot.state === 'has_data' || healthSnapshot.state === 'stale')">
          <view class="trend">
            <view class="trend-canvas-box">
              <canvas id="trendCanvas" type="2d" class="trend-canvas" />
            </view>
          </view>
          <view class="trend-dates">
            <text v-for="point in healthSnapshot.trend" :key="point.dateLabel">{{ point.dateLabel.slice(3) }}</text>
          </view>
        </template>

        <view v-else class="health-empty">
          <text class="empty-text">{{ healthSnapshot?.message ?? '正在连接' }}</text>
        </view>
      </view>

      <!-- 今日提醒（只读展示） -->
      <view class="card">
        <view class="card-head" @tap="openReminders">
          <text class="card-title">今日提醒（{{ reminders.length }}）</text>
          <view class="chevron" />
        </view>
        <view v-for="r in reminders" :key="r.id" class="reminder">
          <view class="reminder-icon">
            <image :src="reminderIcons[r.icon]" mode="aspectFit" />
          </view>
          <view class="reminder-info">
            <text class="reminder-title">{{ r.title }}</text>
            <text class="reminder-time">{{ r.time }}</text>
          </view>
        </view>
      </view>
    </view>

  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f3f6fc;
  padding-bottom: 160rpx;
}
.header {
  background: linear-gradient(180deg, #dbe7fd 0%, #f3f6fc 100%);
  padding-left: 32rpx;
  padding-right: 32rpx;
  padding-bottom: 28rpx;
}
.header-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  padding: 24rpx 8rpx 28rpx;
}
.header-title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #1e3a5f;
}
.header-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #8a94a6;
}
.header-heart {
  width: 56rpx;
  height: 56rpx;
  margin-top: 8rpx;
}
.card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 28rpx;
  margin-top: 24rpx;
}
.trend-card {
  overflow: hidden;
}
.elder-card {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: 8rpx;
}
.avatar {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.avatar-elder {
  width: 92rpx;
  height: 92rpx;
  background: #bfd4f7;
}
.avatar-icon {
  width: 52rpx;
  height: 52rpx;
}
.elder-info {
  flex: 1;
  margin-left: 24rpx;
}
.elder-name {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2937;
}
.elder-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #8a94a6;
}
.chevron {
  width: 16rpx;
  height: 16rpx;
  border-top: 3rpx solid #c3cad6;
  border-right: 3rpx solid #c3cad6;
  transform: rotate(45deg);
  flex-shrink: 0;
}
.body {
  padding: 0 32rpx;
}
.card-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
.card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
}
.card-extra {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #9aa3b2;
}
.health-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.metrics {
  display: flex;
  flex-direction: row;
  margin-top: 28rpx;
}
.metric {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.metric-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #f1f5fd;
  display: flex;
  align-items: center;
  justify-content: center;
}
.metric-icon image {
  width: 36rpx;
  height: 36rpx;
}
.metric-label {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #6b7280;
}
.metric-value {
  margin-top: 8rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2937;
}
.metric-unit {
  font-size: 20rpx;
  color: #9aa3b2;
  margin-top: 2rpx;
}
.badge {
  margin-top: 10rpx;
  font-size: 20rpx;
  color: #16a34a;
  background: #e7f8ef;
  border-radius: 999rpx;
  padding: 4rpx 20rpx;
}
.trend {
  margin-top: 20rpx;
  width: 100%;
  overflow: hidden;
}
/* 画布外层固定显示尺寸：位图分辨率可以更大，但布局框不外扩。
   原生 canvas 的显示框由这一层约束，父级 overflow 不参与裁剪。 */
.trend-canvas-box {
  position: relative;
  display: block;
  width: 100%;
  height: 180rpx;
  overflow: hidden;
}
.trend-title-row {
  display: flex;
  align-items: center;
}
.demo-tag {
  margin-left: 14rpx;
  padding: 3rpx 12rpx;
  border-radius: 999rpx;
  background: #eef2f8;
  color: #8a94a6;
  font-size: 20rpx;
}
.trend-metric {
  display: block;
  margin-top: 8rpx;
  color: #6b7280;
  font-size: 22rpx;
}
.trend-canvas {
  display: block;
  width: 100%;
  height: 180rpx;
}
.trend-dates {
  display: flex;
  justify-content: space-between;
  margin-top: 4rpx;
  color: #9aa3b2;
  font-size: 18rpx;
}
.reminder {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: 28rpx;
}
.reminder-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  background: #fdf3e7;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.reminder-icon image {
  width: 40rpx;
  height: 40rpx;
}
.reminder-info {
  flex: 1;
  margin-left: 22rpx;
}
.reminder-title {
  display: block;
  font-size: 28rpx;
  color: #1f2937;
  font-weight: 500;
}
.reminder-time {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #9aa3b2;
}
.health-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx 0;
  margin-top: 20rpx;
}
.empty-text {
  font-size: 26rpx;
  color: #9aa3b2;
}

</style>
