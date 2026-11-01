<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import AppToast from '../../components/AppToast.vue'
import BottomSheet from '../../components/BottomSheet.vue'
import PageHeader from '../../components/PageHeader.vue'
import ScreenIdentity from '../../components/ScreenIdentity.vue'
import { useServiceTasks } from '../../composables/useServiceTasks'
import { useToast } from '../../composables/useToast'
import {
  canAccept,
  canComplete,
  cardActionLabel,
  detailActionLabel,
  groupServices,
  statusLabel,
} from '../../domain/serviceFlow'
import type { ServiceTaskDraft } from '../../types/serviceTask'

const {
  tasks,
  state,
  errorMessage,
  actionError,
  busy,
  load,
  retry,
  createTask,
  accept,
  complete,
  clearActionError,
} = useServiceTasks()
const { toastText, tip } = useToast()

const emptyDraft = (): ServiceTaskDraft => ({
  title: '',
  elderName: '',
  category: '',
  scheduledDate: '',
  scheduledTime: '',
  location: '',
  description: '',
})

const openId = ref('')
const note = ref('')
const createVisible = ref(false)
const draft = ref<ServiceTaskDraft>(emptyDraft())
const draftError = ref('')

const grouped = computed(() => groupServices(tasks.value))
const current = computed(() => tasks.value.find((task) => task.id === openId.value) ?? null)

onMounted(() => {
  void load()
})

function openDetail(id: string) {
  clearActionError()
  openId.value = id
  note.value = ''
}

function closeDetail() {
  openId.value = ''
}

function openCreate() {
  clearActionError()
  draft.value = emptyDraft()
  draftError.value = ''
  createVisible.value = true
}

function closeCreate() {
  if (busy.value) return
  createVisible.value = false
}

async function advance() {
  const task = current.value
  if (!task || busy.value) return

  // 已完成是终态：主按钮文案为「关闭」，必须真的关闭详情，不留点击无效的按钮。
  if (task.status === 'completed') {
    closeDetail()
    return
  }

  if (canAccept(task.status)) {
    const ok = await accept(task.id)
    if (ok) {
      tip('已接收该社区服务')
      closeDetail()
    } else {
      tip(actionError.value || '接收失败，请重试')
    }
    return
  }

  if (canComplete(task.status)) {
    if (!note.value.trim()) {
      tip('请先填写服务记录')
      return
    }
    const ok = await complete(task.id, note.value)
    if (ok) {
      tip('服务记录已保存')
      closeDetail()
    } else {
      tip(actionError.value || '完成失败，请重试')
    }
  }
}

async function submitCreate() {
  if (busy.value) return
  draftError.value = ''
  const ok = await createTask(draft.value)
  if (ok) {
    tip('服务任务已创建')
    createVisible.value = false
    draft.value = emptyDraft()
    return
  }
  // 失败时保留用户已填内容，只提示原因。
  draftError.value = actionError.value || '创建失败，请重试'
  tip(draftError.value)
}
</script>

<template>
  <view class="page">
    <ScreenIdentity />

    <PageHeader title="社区服务协同" subtitle="承接社区点位内的线下协助，上门陪护由陪护端负责" />

    <view v-if="actionError && !current && !createVisible" class="refresh-banner">{{ actionError }}</view>

    <view v-if="state === 'loading' && tasks.length === 0" class="state-block">
      <view class="state-text">正在加载服务任务…</view>
    </view>

    <view v-else-if="state === 'error'" class="state-block">
      <view class="state-text">{{ errorMessage }}</view>
      <view class="state-action" @tap="retry">重新加载</view>
    </view>

    <view v-else-if="tasks.length === 0" class="state-block">
      <view class="state-text">暂无服务任务</view>
      <view class="state-action" @tap="openCreate">新建服务任务</view>
    </view>

    <template v-else>
      <view class="create-entry" @tap="openCreate">＋ 新建服务任务</view>

      <view v-for="group in grouped" :key="group.status" class="group">
        <view class="group-title">{{ group.label }}（{{ group.items.length }}）</view>

        <view v-if="group.items.length === 0" class="group-empty">暂无任务</view>

        <view v-for="task in group.items" :key="task.id" class="task-card" @tap="openDetail(task.id)">
          <view class="round-icon">{{ task.status === 'completed' ? '◇' : '♡' }}</view>
          <view class="task-main">
            <view class="task-title">{{ task.title }}</view>
            <view class="task-meta">{{ task.elderName }} · {{ task.category }}</view>
            <view class="task-meta">{{ task.scheduledText }}</view>
          </view>
          <view v-if="cardActionLabel(task.status)" class="task-action">{{ cardActionLabel(task.status) }}</view>
          <view v-else class="done-mark">✓</view>
        </view>
      </view>
    </template>
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
          <view class="detail-value">{{ current.elderName }}</view>
        </view>
        <view class="detail-row">
          <view class="detail-label">服务类型</view>
          <view class="detail-value">{{ current.category }}</view>
        </view>
        <view class="detail-row">
          <view class="detail-label">预约时间</view>
          <view class="detail-value">{{ current.scheduledText }}</view>
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
          <view class="detail-value">{{ statusLabel(current.status) }}</view>
        </view>
        <view v-if="current.record" class="detail-row">
          <view class="detail-label">服务记录</view>
          <view class="detail-value">{{ current.record }}</view>
        </view>
      </view>

      <textarea
        v-if="canComplete(current.status)"
        v-model="note"
        class="service-note"
        placeholder="填写服务记录"
        placeholder-class="note-placeholder"
      />

      <view class="accept" :class="{ disabled: busy }" @tap="advance">
        {{ busy ? '处理中…' : detailActionLabel(current.status) }}
      </view>
      <view v-if="actionError" class="action-error">{{ actionError }}</view>
    </template>
  </BottomSheet>

  <BottomSheet :visible="createVisible" height="88vh" @close="closeCreate">
    <view class="sheet-title">新建服务任务</view>
    <view class="form-hint">仅用于本地开发演示，请勿填写真实姓名、住址或联系方式。</view>

    <view class="form-field">
      <view class="form-label">服务项目</view>
      <input v-model="draft.title" class="form-input" placeholder="例如：代缴水电费" placeholder-class="note-placeholder" />
    </view>
    <view class="form-field">
      <view class="form-label">服务对象</view>
      <input v-model="draft.elderName" class="form-input" placeholder="例如：示例老人 A" placeholder-class="note-placeholder" />
    </view>
    <view class="form-field">
      <view class="form-label">服务类型</view>
      <input v-model="draft.category" class="form-input" placeholder="例如：代办服务" placeholder-class="note-placeholder" />
    </view>
    <view class="form-field">
      <view class="form-label">服务日期</view>
      <input v-model="draft.scheduledDate" class="form-input" placeholder="2026-11-01" placeholder-class="note-placeholder" />
    </view>
    <view class="form-field">
      <view class="form-label">服务时间</view>
      <input v-model="draft.scheduledTime" class="form-input" placeholder="14:30" placeholder-class="note-placeholder" />
    </view>
    <view class="form-field">
      <view class="form-label">服务地点</view>
      <input v-model="draft.location" class="form-input" placeholder="例如：XX 社区服务中心" placeholder-class="note-placeholder" />
    </view>
    <view class="form-field">
      <view class="form-label">服务说明</view>
      <textarea v-model="draft.description" class="form-textarea" placeholder="例如：按老人委托到窗口代缴本月水电费" placeholder-class="note-placeholder" />
    </view>

    <view v-if="draftError" class="action-error">{{ draftError }}</view>

    <view class="accept" :class="{ disabled: busy }" @tap="submitCreate">
      {{ busy ? '提交中…' : '创建任务' }}
    </view>
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

.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
  color: #4f5663;
  font-size: 26rpx;
}

.state-text {
  line-height: 1.6;
  text-align: center;
}

.state-action {
  margin-top: 30rpx;
  padding: 18rpx 44rpx;
  border: 1rpx solid #4968a9;
  border-radius: 999rpx;
  color: #4968a9;
  font-size: 26rpx;
  font-weight: 700;
}

.create-entry {
  margin-bottom: 32rpx;
  padding: 24rpx 0;
  border: 1rpx dashed #b7c2d8;
  border-radius: 24rpx;
  color: #4968a9;
  font-size: 26rpx;
  font-weight: 700;
  text-align: center;
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

.form-hint {
  margin-top: 18rpx;
  color: #7c879d;
  font-size: 23rpx;
  line-height: 1.5;
}

.form-field {
  margin-top: 28rpx;
}

.form-label {
  margin-bottom: 12rpx;
  color: #4f5663;
  font-size: 24rpx;
  font-weight: 700;
}

.form-input {
  width: 100%;
  height: 84rpx;
  padding: 0 24rpx;
  border: 1rpx solid #dfe4ee;
  border-radius: 23rpx;
  background: #fff;
  color: #1f2024;
  font-size: 24rpx;
  box-sizing: border-box;
}

.form-textarea {
  width: 100%;
  height: 136rpx;
  padding: 21rpx 24rpx;
  border: 1rpx solid #dfe4ee;
  border-radius: 23rpx;
  background: #fff;
  color: #1f2024;
  font-size: 24rpx;
  box-sizing: border-box;
}

.action-error {
  margin-bottom: 20rpx;
  color: #c0392b;
  font-size: 23rpx;
  line-height: 1.5;
}

.refresh-banner {
  margin-bottom: 28rpx;
  padding: 21rpx 26rpx;
  border-radius: 20rpx;
  background: #fdecea;
  color: #c0392b;
  font-size: 23rpx;
  line-height: 1.5;
}

.accept {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 87rpx;
  margin-top: 20rpx;
  margin-bottom: 20rpx;
  border-radius: 999rpx;
  color: #fff;
  background: #4968a9;
  font-size: 28rpx;
  font-weight: 800;
}

.accept.disabled {
  background: #9aa8c6;
}
</style>
