<script setup lang="ts">
import { computed, ref } from 'vue'
import AppToast from '../../components/AppToast.vue'
import BottomSheet from '../../components/BottomSheet.vue'
import PageHeader from '../../components/PageHeader.vue'
import ScreenIdentity from '../../components/ScreenIdentity.vue'
import { useToast } from '../../composables/useToast'
import { completeWithRecord, groupServices, nextServiceStatus, serviceActionLabel } from '../../domain/serviceFlow'
import { createServices } from '../../mock/community'
import type { ServiceTask } from '../../types/community'

const tasks = ref<ServiceTask[]>(createServices())
const openId = ref('')
const note = ref('')
const { toastText, tip } = useToast()

const grouped = computed(() => groupServices(tasks.value))

const current = computed(() => tasks.value.find((task) => task.id === openId.value) ?? null)

const sheetAction = computed(() => (current.value ? serviceActionLabel(current.value.status) : '关闭'))

function openDetail(id: string) {
  openId.value = id
  note.value = ''
}

function closeDetail() {
  openId.value = ''
}

function advance() {
  const task = current.value
  if (!task) return
  if (task.status === '待接收') {
    task.status = nextServiceStatus(task.status)
    tip('已接收该社区服务')
    closeDetail()
    return
  }
  if (task.status === '服务中') {
    const next = completeWithRecord(task, note.value)
    if (next === '服务中') {
      tip('请先填写服务记录')
      return
    }
    tip('服务记录已保存')
    closeDetail()
  }
}
</script>

<template>
  <view class="page">
    <ScreenIdentity />

    <PageHeader title="社区服务协同" subtitle="承接社区点位内的线下协助，上门陪护由陪护端负责" />

    <view v-for="group in grouped" :key="group.status" class="group">
      <view class="group-title">{{ group.status }}（{{ group.items.length }}）</view>

      <view v-if="group.items.length === 0" class="group-empty">暂无任务</view>

      <view v-for="task in group.items" :key="task.id" class="task-card" @tap="openDetail(task.id)">
        <view class="round-icon">{{ task.status === '已完成' ? '◇' : '♡' }}</view>
        <view class="task-main">
          <view class="task-title">{{ task.title }}</view>
          <view class="task-meta">{{ task.name }} · {{ task.type }}</view>
          <view class="task-meta">{{ task.time }}</view>
        </view>
        <view v-if="task.status === '待接收'" class="task-action">接收任务</view>
        <view v-else-if="task.status === '服务中'" class="task-action">完成</view>
        <view v-else class="done-mark">✓</view>
      </view>
    </view>
  </view>

  <BottomSheet :visible="Boolean(current)" @close="closeDetail">
    <template v-if="current">
      <view class="sheet-title">社区服务详情</view>
      <view class="detail-list">
        <view class="detail-row">
          <view class="detail-label">服务项目</view>
          <view class="detail-value">{{ current.title }}</view>
        </view>
        <view class="detail-row">
          <view class="detail-label">服务对象</view>
          <view class="detail-value">{{ current.name }}</view>
        </view>
        <view class="detail-row">
          <view class="detail-label">服务类型</view>
          <view class="detail-value">{{ current.type }}</view>
        </view>
        <view class="detail-row">
          <view class="detail-label">预约时间</view>
          <view class="detail-value">{{ current.time }}</view>
        </view>
        <view class="detail-row">
          <view class="detail-label">服务地点</view>
          <view class="detail-value">{{ current.location }}</view>
        </view>
        <view class="detail-row">
          <view class="detail-label">服务说明</view>
          <view class="detail-value">{{ current.description }}</view>
        </view>
        <view class="detail-row">
          <view class="detail-label">当前状态</view>
          <view class="detail-value">{{ current.status }}</view>
        </view>
        <view v-if="current.record" class="detail-row">
          <view class="detail-label">服务记录</view>
          <view class="detail-value">{{ current.record }}</view>
        </view>
      </view>

      <textarea v-model="note" class="service-note" placeholder="填写服务记录" placeholder-class="note-placeholder" />

      <view class="accept" @tap="advance">{{ sheetAction }}</view>
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

.group {
  margin-bottom: 54rpx;
}

.group-title {
  margin-bottom: 23rpx;
  font-size: 31rpx;
  font-weight: 700;
}

.group-empty {
  padding: 31rpx 0;
  color: #98a2b3;
  font-size: 23rpx;
}

.task-card {
  display: flex;
  align-items: flex-start;
  gap: 26rpx;
  min-height: 160rpx;
  padding: 26rpx 30rpx;
  border-radius: 30rpx;
  background: #fff;
  box-sizing: border-box;
}

.task-card + .task-card {
  margin-top: 21rpx;
}

.round-icon {
  width: 80rpx;
  height: 80rpx;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #1680ee;
  background: #eaf2ff;
  font-size: 36rpx;
}

.task-main {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: 30rpx;
  font-weight: 700;
}

.task-meta {
  margin-top: 6rpx;
  color: #4f5663;
  font-size: 23rpx;
  line-height: 1.45;
}

.task-action {
  flex: none;
  padding: 14rpx 4rpx;
  color: #4968a9;
  font-size: 24rpx;
  font-weight: 700;
}

.done-mark {
  width: 42rpx;
  height: 42rpx;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  background: #18b978;
  font-size: 24rpx;
  font-weight: 800;
}

.sheet-title {
  font-size: 42rpx;
  font-weight: 700;
}

.detail-list {
  margin-top: 35rpx;
  margin-bottom: 35rpx;
}

.detail-row {
  display: flex;
  gap: 17rpx;
  margin-bottom: 28rpx;
  font-size: 24rpx;
}

.detail-label {
  width: 129rpx;
  flex: none;
  color: #7c879d;
}

.detail-value {
  flex: 1;
  min-width: 0;
  font-weight: 700;
  line-height: 1.5;
}

.service-note {
  width: 100%;
  height: 136rpx;
  margin-bottom: 38rpx;
  padding: 21rpx 24rpx;
  border: 1rpx solid #dfe4ee;
  border-radius: 23rpx;
  background: #fff;
  color: #1f2024;
  font-size: 24rpx;
  box-sizing: border-box;
}

.note-placeholder {
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
