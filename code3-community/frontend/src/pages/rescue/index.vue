<script setup lang="ts">
import { computed, ref } from 'vue'
import AppToast from '../../components/AppToast.vue'
import BottomSheet from '../../components/BottomSheet.vue'
import PageHeader from '../../components/PageHeader.vue'
import ScreenIdentity from '../../components/ScreenIdentity.vue'
import { useToast } from '../../composables/useToast'
import { RESCUE_STEPS, flowIndex, isTerminal, nextStatus, requiresResult, stamp } from '../../domain/rescueFlow'
import { createIncidents, createSimIncident } from '../../mock/community'
import type { RescueIncident } from '../../types/community'

const GUARDIAN_LABELS = ['已通知', '已查看', '已联系老人']

const incidents = ref<RescueIncident[]>(createIncidents())
const openId = ref('')
const resultDraft = ref('')
const simSeq = ref(0)
const { toastText, tip } = useToast()

const pendingCount = computed(() => incidents.value.filter((item) => item.status === '待响应').length)
const current = computed(() => incidents.value.find((item) => item.id === openId.value) ?? null)
const currentIndex = computed(() => (current.value ? flowIndex(current.value.status) : 0))
const actionLabel = computed(() => RESCUE_STEPS[currentIndex.value].action)
const reasonLine = computed(() => {
  const item = current.value
  if (!item) return ''
  return item.reason ? `${item.type} · ${item.reason}` : item.type
})

const stepViews = computed(() => {
  const item = current.value
  if (!item) return []
  const index = flowIndex(item.status)
  const finished = isTerminal(item.status)
  return RESCUE_STEPS.map((step, position) => {
    const complete = finished || position < index
    const isCurrent = !complete && position === index
    const meta = complete
      ? item.stepTimes[position] || '已完成'
      : isCurrent
        ? item.stepTimes[position] || '当前步骤'
        : '等待处理'
    return {
      key: step.status,
      name: step.name,
      meta,
      state: complete ? 'complete' : isCurrent ? 'current' : 'future',
      mark: complete ? '✓' : String(position + 1),
    }
  })
})

const guardianViews = computed(() => {
  const guardian = current.value?.guardian
  if (!guardian) return []
  return GUARDIAN_LABELS.map((label, index) => {
    const done = index <= guardian.stage
    const time = guardian.times[index]
    const suffix = time ? ` · ${time}` : index === guardian.stage + 1 ? ' · 等待中' : ''
    return { label, text: label + suffix, done }
  })
})

const sourceShort = (source: string) => source.split(' · ')[0]

function openDetail(id: string) {
  const item = incidents.value.find((incident) => incident.id === id)
  if (!item) return
  openId.value = id
  resultDraft.value = item.result ?? ''
}

function closeDetail() {
  openId.value = ''
}

function advance() {
  const item = current.value
  if (!item) return
  if (isTerminal(item.status)) {
    closeDetail()
    return
  }
  if (requiresResult(item.status)) {
    const result = resultDraft.value.trim()
    if (!result) {
      tip('请先填写处理结果')
      return
    }
    item.result = result
  }
  const index = flowIndex(item.status)
  if (!item.stepTimes[index]) item.stepTimes[index] = stamp()
  item.status = nextStatus(item.status)
  tip('处理进度已更新')
}

function simulate() {
  incidents.value.unshift(createSimIncident(simSeq.value, new Date()))
  simSeq.value += 1
  tip('收到一条新的紧急求助，请及时响应')
}
</script>

<template>
  <view class="page">
    <ScreenIdentity />

    <PageHeader title="救援处置" subtitle="及时处理社区紧急求助">
      <template #action>
        <view class="count-pill">{{ pendingCount }} 个待响应</view>
        <view class="simulate" @tap="simulate">＋ 模拟新求助</view>
      </template>
    </PageHeader>

    <view class="demo-banner">演示数据：本页老人信息与事件均为虚构示例，仅用于界面演示</view>

    <view class="rescue-list">
      <view v-for="item in incidents" :key="item.id" class="rescue-card" @tap="openDetail(item.id)">
        <view class="card-top">
          <view class="tag tag-red">{{ item.type }}</view>
          <view class="tag" :class="item.status === '已完成处理' ? 'tag-green' : 'tag-blue'">
            {{ item.status }}
          </view>
        </view>
        <view class="card-name">{{ item.name }}</view>
        <view class="info-line">
          <view class="info-icon">⌖</view>
          <view class="info-text">{{ item.location }}</view>
        </view>
        <view class="info-line">
          <view class="info-icon">◷</view>
          <view class="info-text">{{ item.time }} · {{ sourceShort(item.source) }}</view>
        </view>
      </view>
    </view>
  </view>

  <BottomSheet :visible="Boolean(current)" @close="closeDetail">
    <template v-if="current">
      <view class="incident-heading">
        <view class="sheet-title">SOS 事件详情</view>
        <view class="tag" :class="current.status === '已完成处理' ? 'tag-green' : 'tag-blue'">
          {{ current.status }}
        </view>
      </view>

      <view class="incident-summary">
        <view class="incident-name">{{ current.name }}</view>
        <view class="reason">{{ reasonLine }}</view>
        <view class="info-line">
          <view class="info-icon">⌖</view>
          <view class="info-text">{{ current.location }}</view>
        </view>
        <view class="meta">{{ current.time }} · {{ current.source }} · {{ current.id }}</view>
      </view>

      <view class="family">
        <view class="family-heading">
          <view class="section-title">家庭协同</view>
          <view class="family-person">主要监护人：{{ current.guardian.name }}</view>
        </view>
        <view class="guardian-progress">
          <view
            v-for="row in guardianViews"
            :key="row.label"
            class="guardian-step"
            :class="{ done: row.done }"
          >
            <view class="guardian-dot"></view>
            <view class="guardian-label">{{ row.text }}</view>
          </view>
        </view>
        <view class="guardian-feedback">反馈：{{ current.guardian.feedback }}</view>
        <view v-if="current.guardian.otherCount" class="guardian-extra">
          其他监护人：另有 {{ current.guardian.otherCount }} 位已通知
        </view>
      </view>

      <view class="process-title">社区处理进度</view>
      <view class="timeline">
        <view v-for="step in stepViews" :key="step.key" class="process-step" :class="step.state">
          <view class="process-dot">{{ step.mark }}</view>
          <view class="process-body">
            <view class="process-name">{{ step.name }}</view>
            <view class="process-meta">{{ step.meta }}</view>
          </view>
        </view>
      </view>

      <textarea
        v-if="current.status === '已到达'"
        v-model="resultDraft"
        class="result-input"
        placeholder="填写处理结果"
        placeholder-class="result-placeholder"
      />

      <view class="accept" @tap="advance">{{ actionLabel }}</view>
    </template>
  </BottomSheet>

  <AppToast :text="toastText" />
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 0 47rpx 40rpx;
  background: #f5f7fb;
  color: #1f2024;
  box-sizing: border-box;
}

.count-pill {
  padding: 14rpx 21rpx;
  border-radius: 999rpx;
  color: #ef4136;
  background: #ffe9e7;
  font-size: 23rpx;
  font-weight: 700;
}

.simulate {
  min-height: 52rpx;
  padding: 0 19rpx;
  display: flex;
  align-items: center;
  border: 1rpx solid #c9d6ee;
  border-radius: 999rpx;
  color: #3a5c9a;
  background: #fff;
  font-size: 21rpx;
  font-weight: 700;
}

.demo-banner {
  margin-bottom: 24rpx;
  padding: 18rpx 24rpx;
  border-radius: 16rpx;
  color: #8a6d1d;
  background: #fdf6e3;
  font-size: 21rpx;
  line-height: 1.5;
}

.rescue-list {
  display: flex;
  flex-direction: column;
  gap: 31rpx;
}

.rescue-card {
  padding: 31rpx 31rpx 30rpx;
  border-radius: 33rpx;
  background: #fff;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 17rpx;
}

.tag {
  display: flex;
  align-items: center;
  min-height: 50rpx;
  padding: 9rpx 17rpx;
  border-radius: 999rpx;
  font-size: 21rpx;
  font-weight: 700;
}

.tag-red {
  color: #ef4136;
  background: #fff0ef;
}

.tag-blue {
  color: #2e63c3;
  background: #e8eefc;
}

.tag-green {
  color: #12a86b;
  background: #e9f8f0;
}

.card-name {
  margin-top: 30rpx;
  font-size: 35rpx;
  font-weight: 700;
}

.info-line {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 14rpx;
  color: #748097;
  font-size: 23rpx;
}

.info-icon {
  flex: none;
  line-height: 1;
}

.info-text {
  flex: 1;
  min-width: 0;
}

.sheet-title {
  font-size: 42rpx;
  font-weight: 700;
}

.incident-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 21rpx;
}

.incident-summary {
  margin: 35rpx 0 42rpx;
  padding: 28rpx;
  border-radius: 30rpx;
  background: #fff;
}

.incident-name {
  font-size: 35rpx;
  font-weight: 700;
}

.reason {
  margin-top: 12rpx;
  color: #3f4652;
  font-size: 24rpx;
  font-weight: 700;
}

.meta {
  margin-top: 12rpx;
  color: #8992a3;
  font-size: 21rpx;
}

.family {
  margin: 0 0 42rpx;
  padding: 28rpx;
  border-radius: 30rpx;
  background: #fff;
}

.family-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 17rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
}

.family-person {
  color: #667187;
  font-size: 21rpx;
}

.guardian-progress {
  display: flex;
  flex-direction: column;
  gap: 17rpx;
  margin-top: 26rpx;
}

.guardian-step {
  display: flex;
  align-items: center;
  gap: 16rpx;
  color: #8a94a5;
  font-size: 21rpx;
}

.guardian-dot {
  width: 17rpx;
  height: 17rpx;
  flex: none;
  border: 3rpx solid #c9d0dc;
  border-radius: 50%;
  background: #fff;
}

.guardian-step.done {
  color: #45536c;
}

.guardian-step.done .guardian-dot {
  border-color: #4968a9;
  background: #4968a9;
}

.guardian-feedback {
  margin-top: 23rpx;
  padding-top: 21rpx;
  border-top: 1rpx solid #edf0f5;
  color: #5f697c;
  font-size: 21rpx;
  line-height: 1.55;
}

.guardian-extra {
  margin-top: 16rpx;
  color: #8992a3;
  font-size: 19rpx;
}

.process-title {
  margin-bottom: 30rpx;
  font-size: 30rpx;
  font-weight: 700;
}

.timeline {
  margin-bottom: 38rpx;
}

.process-step {
  position: relative;
  display: flex;
  gap: 19rpx;
  min-height: 117rpx;
}

.process-step::after {
  content: '';
  position: absolute;
  left: 28rpx;
  top: 54rpx;
  bottom: 0;
  width: 3rpx;
  background: #d8dde7;
}

.process-step:last-child::after {
  display: none;
}

.process-step.complete::after {
  background: #7692c9;
}

.process-dot {
  position: relative;
  z-index: 1;
  width: 56rpx;
  height: 56rpx;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid #c9d0dc;
  border-radius: 50%;
  color: #8992a3;
  background: #f8f8ff;
  font-size: 21rpx;
  font-weight: 800;
  box-sizing: border-box;
}

.process-step.complete .process-dot {
  border-color: #4968a9;
  color: #fff;
  background: #4968a9;
}

.process-step.current .process-dot {
  border: 12rpx solid #dce6fb;
  color: #4968a9;
  background: #fff;
}

.process-body {
  flex: 1;
  min-width: 0;
  padding: 9rpx 17rpx 23rpx 0;
}

.process-step.current .process-body {
  margin: -9rpx 0 16rpx;
  padding: 17rpx 21rpx;
  border-radius: 23rpx;
  background: #e8eefc;
}

.process-name {
  font-size: 24rpx;
  font-weight: 700;
}

.process-meta {
  margin-top: 7rpx;
  color: #8a94a5;
  font-size: 21rpx;
}

.process-step.current .process-meta {
  color: #61749a;
}

.result-input {
  width: 100%;
  height: 148rpx;
  margin-bottom: 31rpx;
  padding: 21rpx 24rpx;
  border: 1rpx solid #dfe4ee;
  border-radius: 23rpx;
  background: #fff;
  color: #1f2024;
  font-size: 24rpx;
  box-sizing: border-box;
}

.result-placeholder {
  color: #9aa3b3;
}

.accept {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 87rpx;
  margin-bottom: 20rpx;
  border-radius: 999rpx;
  color: #fff;
  background: #4968a9;
  font-size: 28rpx;
  font-weight: 800;
}
</style>
