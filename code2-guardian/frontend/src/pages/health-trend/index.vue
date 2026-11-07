<script setup lang="ts">
import { computed, getCurrentInstance, onMounted, watch } from 'vue'
import { buildTrendPoints } from '../../domain/healthTrend'
import {
  DEFAULT_PIXEL_RATIO,
  buildTrendAreaPath,
  isCanvasMeasurable,
  resolveCanvasBitmap,
  resolveTouchRegion,
} from '../../domain/trendCanvas'
import { summarizeTrend } from '../../domain/trendSummary'
import { useHealthData } from '../../composables/useHealthData'
import { createHealthDataProvider } from '../../data/healthDataProvider'

const instance = getCurrentInstance()

// 健康数据只通过 Provider 获取，不直接读 mock 常量。
const healthProvider = createHealthDataProvider()
const { snapshot: healthSnapshot } = useHealthData(healthProvider)

const trend = computed(() => healthSnapshot.value?.trend ?? [])
const summary = computed(() => summarizeTrend(trend.value))

const formatValue = (value: number | null) => (value === null ? '--' : String(value))

const summaryItems = computed(() => [
  { label: '最高', value: formatValue(summary.value.max) },
  { label: '最低', value: formatValue(summary.value.min) },
  { label: '平均', value: formatValue(summary.value.average) },
])

/** 绘制近 7 天静息心率折线（复用 Provider 提供的趋势序列） */
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
      // 二级页是 navigateTo 进入的，进场动画期间尺寸可能为 0，此处直接跳过绘制
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
      const pts = buildTrendPoints(trend.value.map((point) => point.value), touch.width, touch.height, padding)
      if (pts.length === 0) return
      const { top, baseline } = buildTrendAreaPath(pts, metrics, padding)

      ctx.save()
      ctx.beginPath()
      ctx.rect(padding.left, padding.top, touch.width - padding.left - padding.right, touch.height - padding.top - padding.bottom)
      ctx.clip()

      ctx.beginPath()
      ctx.moveTo(top[0].x, top[0].y)
      for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y)
      ctx.lineTo(top[top.length - 1].x, baseline)
      ctx.lineTo(top[0].x, baseline)
      ctx.closePath()
      ctx.fillStyle = 'rgba(37, 99, 235, 0.08)'
      ctx.fill()

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
watch(healthSnapshot, () => drawTrend())
</script>

<template>
  <view class="page">
    <!-- 有数据 / 过期：显示趋势与统计 -->
    <template v-if="healthSnapshot && (healthSnapshot.state === 'has_data' || healthSnapshot.state === 'stale')">
      <!-- 趋势曲线 -->
      <view class="card">
        <view class="card-head">
          <view>
            <view class="title-row">
              <text class="card-title">近7天健康趋势</text>
              <text class="demo-tag">演示数据</text>
            </view>
            <text class="trend-metric">每日平均静息心率（次/分）</text>
          </view>
          <text class="card-extra">{{ healthSnapshot.updatedAt }}</text>
        </view>
        <view class="trend-canvas-box">
          <canvas id="trendCanvas" type="2d" class="trend-canvas" />
        </view>
        <view class="trend-dates">
          <text v-for="point in trend" :key="point.dateLabel">{{ point.dateLabel }}</text>
        </view>
      </view>

      <view class="card">
        <view class="card-head">
          <text class="card-title">统计</text>
          <text class="card-extra">单位：次/分</text>
        </view>
        <view class="summary">
          <view v-for="item in summaryItems" :key="item.label" class="summary-item">
            <text class="summary-label">{{ item.label }}</text>
            <text class="summary-value">{{ item.value }}</text>
          </view>
        </view>
      </view>

      <view class="card">
        <text class="card-title">每日数值</text>
        <view v-for="point in trend" :key="point.dateLabel" class="day-row">
          <text class="day-label">{{ point.dateLabel }}</text>
          <text class="day-value">{{ point.value }} 次/分</text>
        </view>
      </view>
    </template>

    <!-- 空态：未接入 / 连接中 / 暂无数据 / 异常 -->
    <view v-else class="card empty">
      <text class="empty-text">{{ healthSnapshot?.message ?? '正在连接' }}</text>
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
  overflow: hidden;
}
.card-head {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
}
.title-row {
  display: flex;
  align-items: center;
}
.card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
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
.card-extra {
  display: block;
  font-size: 22rpx;
  color: #9aa3b2;
}
/* 画布外层固定显示尺寸：位图分辨率可以更大，但布局框不外扩。
   原生 canvas 的显示框由这一层约束，父级 overflow 不参与裁剪。 */
.trend-canvas-box {
  position: relative;
  display: block;
  width: 100%;
  height: 320rpx;
  margin-top: 20rpx;
  overflow: hidden;
}
.trend-canvas {
  display: block;
  width: 100%;
  height: 320rpx;
}
.trend-dates {
  display: flex;
  justify-content: space-between;
  margin-top: 8rpx;
  color: #9aa3b2;
  font-size: 18rpx;
}
.summary {
  display: flex;
  flex-direction: row;
  margin-top: 24rpx;
}
.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.summary-label {
  font-size: 24rpx;
  color: #6b7280;
}
.summary-value {
  margin-top: 8rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2937;
}
.day-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 0;
  border-bottom: 1rpx solid #f1f4fa;
}
.day-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.day-label {
  font-size: 26rpx;
  color: #6b7280;
}
.day-value {
  font-size: 26rpx;
  color: #1f2937;
  font-weight: 500;
}
.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80rpx 28rpx;
}
.empty-text {
  font-size: 26rpx;
  color: #9aa3b2;
}

</style>
