<script setup lang="ts">
import { computed, ref } from 'vue'
import AppToast from '../../components/AppToast.vue'
import BottomSheet from '../../components/BottomSheet.vue'
import SubPageHeader from '../../components/SubPageHeader.vue'
import { useToast } from '../../composables/useToast'
import { knowledgeAfterReview, knowledgeAfterToggle, knowledgeMeta } from '../../domain/contentFlow'
import { createKnowledgeDocs } from '../../mock/community'
import type { KnowledgeDoc } from '../../types/community'

type SheetMode = 'review' | 'view'

const docs = ref<KnowledgeDoc[]>(createKnowledgeDocs())
const openId = ref('')
const sheetMode = ref<SheetMode>('review')
const draft = ref('')
const { toastText, tip } = useToast()

const current = computed(() => docs.value.find((item) => item.id === openId.value) ?? null)
const sheetTitle = computed(() => (sheetMode.value === 'review' ? '确认知识内容' : '查看知识内容'))
const confirmLabel = computed(() => (sheetMode.value === 'review' ? '确认并启用' : '保存修改'))

const tagClass = (status: KnowledgeDoc['status']) => {
  if (status === '已启用') return 'tag-green'
  if (status === '已停用') return 'tag-red'
  return 'tag-blue'
}

function chooseFile() {
  uni.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['doc', 'docx'],
    success: (res) => {
      const file = res.tempFiles[0]
      if (!file) return
      docs.value.unshift({
        id: `doc-${Date.now()}`,
        name: file.name,
        content: '',
        status: '待确认',
      })
      tip('文件已添加，请审核内容')
    },
    fail: () => undefined,
  })
}

function openSheet(id: string, mode: SheetMode) {
  const item = docs.value.find((doc) => doc.id === id)
  if (!item) return
  openId.value = id
  sheetMode.value = mode
  draft.value = item.content
}

function closeSheet() {
  openId.value = ''
}

function confirmSheet() {
  const item = current.value
  if (!item) return
  const content = draft.value.trim()
  if (!content) {
    tip('请先填写需要交给 AI 的内容')
    return
  }
  item.content = content
  const reviewing = sheetMode.value === 'review'
  if (reviewing) item.status = knowledgeAfterReview(item.status)
  closeSheet()
  tip(reviewing ? '知识内容已启用' : '修改已保存')
}

function toggle(id: string) {
  const item = docs.value.find((doc) => doc.id === id)
  if (!item) return
  const next = knowledgeAfterToggle(item.status)
  if (next === item.status) return
  item.status = next
  tip(next === '已停用' ? '知识资料已停用' : '知识资料已重新启用')
}
</script>

<template>
  <view class="page">
    <SubPageHeader title="知识资料" subtitle="确认后提供给老人端 AI" />

    <view class="upload-primary" @tap="chooseFile">＋ 上传 Word 资料</view>
    <view class="notice">上传后需人工确认内容，确认后才会提供给老人端 AI 使用。</view>

    <view class="doc-list">
      <view v-for="item in docs" :key="item.id" class="doc-card">
        <view class="doc-top">
          <view class="doc-name">{{ item.name }}</view>
          <view class="tag" :class="tagClass(item.status)">{{ item.status }}</view>
        </view>
        <view class="doc-meta">{{ knowledgeMeta(item.status) }}</view>
        <view class="doc-actions">
          <view
            v-if="item.status === '待确认'"
            class="doc-button"
            @tap="openSheet(item.id, 'review')"
          >审核内容</view>
          <template v-else>
            <view class="doc-button" @tap="openSheet(item.id, 'view')">查看</view>
            <view
              class="doc-button"
              :class="item.status === '已启用' ? 'doc-button-danger' : ''"
              @tap="toggle(item.id)"
            >{{ item.status === '已启用' ? '停用' : '重新启用' }}</view>
          </template>
        </view>
      </view>
    </view>
  </view>

  <BottomSheet :visible="Boolean(current)" @close="closeSheet">
    <template v-if="current">
      <view class="sheet-title">{{ sheetTitle }}</view>
      <view class="sheet-file">{{ current.name }}</view>
      <textarea
        v-model="draft"
        class="editor"
        placeholder="请填写或粘贴需要提供给 AI 的内容"
        placeholder-class="editor-placeholder"
      />
      <view class="dialog-actions">
        <view class="cancel-button" @tap="closeSheet">取消</view>
        <view class="accept" @tap="confirmSheet">{{ confirmLabel }}</view>
      </view>
    </template>
  </BottomSheet>

  <AppToast :text="toastText" />
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 0 47rpx 60rpx;
  background: #f5f7fb;
  color: #1f2024;
  box-sizing: border-box;
}

.upload-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 87rpx;
  margin-bottom: 24rpx;
  border-radius: 28rpx;
  color: #fff;
  background: #4968a9;
  font-size: 28rpx;
  font-weight: 800;
}

.notice {
  margin-bottom: 31rpx;
  padding: 24rpx 28rpx;
  border-radius: 26rpx;
  color: #667187;
  background: #edf2fb;
  font-size: 21rpx;
  line-height: 1.55;
}

.doc-card {
  padding: 31rpx;
  border-radius: 30rpx;
  background: #fff;
}

.doc-card + .doc-card {
  margin-top: 26rpx;
}

.doc-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 21rpx;
}

.doc-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 30rpx;
  font-weight: 700;
}

.tag {
  flex: none;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-size: 21rpx;
  font-weight: 700;
}

.tag-blue {
  color: #2e63c3;
  background: #e8eefc;
}

.tag-green {
  color: #12a86b;
  background: #e9f8f0;
}

.tag-red {
  color: #ef4136;
  background: #fff0ef;
}

.doc-meta {
  margin-top: 14rpx;
  color: #748097;
  font-size: 21rpx;
}

.doc-actions {
  display: flex;
  justify-content: flex-end;
  gap: 17rpx;
  margin-top: 24rpx;
  padding-top: 23rpx;
  border-top: 1rpx solid #edf0f5;
}

.doc-button {
  min-height: 59rpx;
  padding: 0 23rpx;
  display: flex;
  align-items: center;
  border-radius: 999rpx;
  color: #2e63c3;
  background: #e8eefc;
  font-size: 21rpx;
  font-weight: 700;
}

.doc-button-danger {
  color: #ef4136;
  background: #fff0ef;
}

.sheet-title {
  font-size: 42rpx;
  font-weight: 700;
}

.sheet-file {
  margin-top: 12rpx;
  color: #748097;
  font-size: 24rpx;
}

.editor {
  width: 100%;
  height: 340rpx;
  margin: 35rpx 0;
  padding: 24rpx;
  border: 1rpx solid #dfe4ee;
  border-radius: 23rpx;
  background: #fff;
  color: #1f2024;
  font-size: 24rpx;
  line-height: 1.6;
  box-sizing: border-box;
}

.editor-placeholder {
  color: #9aa3b3;
}

.dialog-actions {
  display: flex;
  gap: 17rpx;
  margin-bottom: 20rpx;
}

.cancel-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 87rpx;
  border: 1rpx solid #dbe1ec;
  border-radius: 999rpx;
  color: #5f697c;
  background: #fff;
  font-size: 28rpx;
  font-weight: 700;
}

.accept {
  flex: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 87rpx;
  border-radius: 999rpx;
  color: #fff;
  background: #4968a9;
  font-size: 28rpx;
  font-weight: 800;
}
</style>
