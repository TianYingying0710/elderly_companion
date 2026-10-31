<script setup lang="ts">
import { computed, ref } from 'vue'
import AppToast from '../../components/AppToast.vue'
import BottomSheet from '../../components/BottomSheet.vue'
import SubPageHeader from '../../components/SubPageHeader.vue'
import { useToast } from '../../composables/useToast'
import { courseAfterAction, coursePublishLabel } from '../../domain/contentFlow'
import { COURSE_CATEGORIES, createCourses } from '../../mock/community'
import type { Course, CourseStatus } from '../../types/community'

const courses = ref<Course[]>(createCourses())
const activeCategory = ref('全部')
const { toastText, tip } = useToast()

type Mode = 'preview' | 'edit' | 'create' | null
const mode = ref<Mode>(null)
const editingId = ref('')

// 编辑/新建表单草稿
const draft = ref({
  title: '',
  category: '手机基础',
  format: '图文教程',
  duration: '约 3 分钟',
  note: '',
  content: '',
})

const visibleCourses = computed(() =>
  activeCategory.value === '全部'
    ? courses.value
    : courses.value.filter((course) => course.category === activeCategory.value),
)

const current = computed(() => courses.value.find((course) => course.id === editingId.value) ?? null)

const tagClass = (status: CourseStatus) => {
  if (status === '已发布') return 'tag-green'
  if (status === '已下架') return 'tag-red'
  return 'tag-blue'
}

function publish(id: string) {
  const course = courses.value.find((item) => item.id === id)
  if (!course) return
  const republish = course.status === '已下架'
  course.status = courseAfterAction(course.status, 'publish')
  tip(republish ? '重新发布成功' : '发布课程成功')
}

function unpublish(id: string) {
  const course = courses.value.find((item) => item.id === id)
  if (!course) return
  course.status = courseAfterAction(course.status, 'unpublish')
  tip('内容已下架')
}

function openPreview(id: string) {
  editingId.value = id
  mode.value = 'preview'
}

function openEdit(id: string) {
  const course = courses.value.find((item) => item.id === id)
  if (!course) return
  editingId.value = id
  draft.value = {
    title: course.title,
    category: course.category,
    format: course.format,
    duration: course.duration,
    note: course.note,
    content: course.content ?? '',
  }
  mode.value = 'edit'
}

function openCreate() {
  editingId.value = ''
  draft.value = { title: '', category: '手机基础', format: '图文教程', duration: '约 3 分钟', note: '', content: '' }
  mode.value = 'create'
}

function closeSheet() {
  mode.value = null
  editingId.value = ''
}

function saveDraft() {
  const title = draft.value.title.trim()
  if (!title) {
    tip('请先填写课程标题')
    return
  }
  if (mode.value === 'create') {
    const id = `course-${Date.now()}`
    courses.value.unshift({
      id,
      title,
      category: draft.value.category,
      format: draft.value.format,
      duration: draft.value.duration,
      note: draft.value.note,
      content: draft.value.content,
      status: '草稿',
    })
    tip('课程已创建（草稿）')
  } else if (mode.value === 'edit' && editingId.value) {
    const course = courses.value.find((item) => item.id === editingId.value)
    if (course) {
      course.title = title
      course.category = draft.value.category
      course.format = draft.value.format
      course.duration = draft.value.duration
      course.note = draft.value.note
      course.content = draft.value.content
      tip('课程已更新')
    }
  }
  closeSheet()
}
</script>

<template>
  <view class="page">
    <SubPageHeader title="助老课程" subtitle="发布老人端数字学习课程">
      <template #action>
        <view class="create-button" @tap="openCreate">＋ 新建</view>
      </template>
    </SubPageHeader>

    <view class="category-row">
      <view
        v-for="category in COURSE_CATEGORIES"
        :key="category"
        class="category-chip"
        :class="{ active: activeCategory === category }"
        @tap="activeCategory = category"
      >{{ category }}</view>
    </view>

    <view class="course-list">
      <view v-for="course in visibleCourses" :key="course.id" class="course-card">
        <view class="course-top">
          <view class="course-title">{{ course.title }}</view>
          <view class="tag" :class="tagClass(course.status)">{{ course.status }}</view>
        </view>
        <view class="course-meta">{{ course.category }} · {{ course.format }} · {{ course.duration }}</view>
        <view class="course-footer">
          <view class="course-note">{{ course.note }}</view>
          <view class="course-actions">
            <view
              v-if="course.status === '草稿'"
              class="small-action"
              @tap="openPreview(course.id)"
            >预览</view>
            <view v-else class="small-action" @tap="openEdit(course.id)">编辑</view>

            <view v-if="course.status === '已发布'" class="small-action" @tap="unpublish(course.id)">下架</view>
            <view v-else class="small-action" @tap="publish(course.id)">
              {{ coursePublishLabel(course.status) }}
            </view>
          </view>
        </view>
      </view>

      <view v-if="visibleCourses.length === 0" class="course-empty">该分类暂无课程</view>
    </view>
  </view>

  <!-- 预览弹层 -->
  <BottomSheet :visible="mode === 'preview'" @close="closeSheet">
    <template v-if="current">
      <view class="sheet-title">{{ current.title }}</view>
      <view class="sheet-meta">{{ current.category }} · {{ current.format }} · {{ current.duration }}</view>
      <view class="sheet-tag" :class="tagClass(current.status)">{{ current.status }}</view>
      <view class="sheet-note">{{ current.note || '暂无说明' }}</view>
      <view class="sheet-section">课程正文</view>
      <view class="sheet-content">{{ current.content || '（尚未填写正文内容）' }}</view>
    </template>
  </BottomSheet>

  <!-- 编辑 / 新建表单弹层 -->
  <BottomSheet :visible="mode === 'edit' || mode === 'create'" @close="closeSheet">
    <view class="sheet-title">{{ mode === 'create' ? '新建助老课程' : '编辑课程' }}</view>
    <view class="form-field">
      <view class="form-label">课程标题</view>
      <input v-model="draft.title" class="form-input" placeholder="例如：怎样调大手机字体" />
    </view>
    <view class="form-field">
      <view class="form-label">分类</view>
      <view class="chip-row">
        <view
          v-for="category in COURSE_CATEGORIES.filter((c) => c !== '全部')"
          :key="category"
          class="category-chip"
          :class="{ active: draft.category === category }"
          @tap="draft.category = category"
        >{{ category }}</view>
      </view>
    </view>
    <view class="form-field">
      <view class="form-label">格式</view>
      <view class="chip-row">
        <view
          v-for="format in ['图文教程', '视频教程']"
          :key="format"
          class="category-chip"
          :class="{ active: draft.format === format }"
          @tap="draft.format = format"
        >{{ format }}</view>
      </view>
    </view>
    <view class="form-field">
      <view class="form-label">时长</view>
      <input v-model="draft.duration" class="form-input" placeholder="例如：约 3 分钟" />
    </view>
    <view class="form-field">
      <view class="form-label">说明</view>
      <input v-model="draft.note" class="form-input" placeholder="适合人群、注意事项等" />
    </view>
    <view class="form-field">
      <view class="form-label">正文内容</view>
      <textarea v-model="draft.content" class="form-textarea" placeholder="填写课程正文内容" />
    </view>
    <view class="accept" @tap="saveDraft">保存</view>
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

.create-button {
  padding: 14rpx 21rpx;
  border-radius: 999rpx;
  color: #2e63c3;
  background: #e8eefc;
  font-size: 21rpx;
  font-weight: 700;
  white-space: nowrap;
}

.category-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-bottom: 31rpx;
}

.category-chip {
  padding: 12rpx 21rpx;
  border-radius: 999rpx;
  color: #5f697c;
  background: #fff;
  font-size: 21rpx;
}

.category-chip.active {
  color: #2e63c3;
  background: #e8eefc;
  font-weight: 700;
}

.course-card {
  padding: 31rpx;
  border-radius: 30rpx;
  background: #fff;
}

.course-card + .course-card {
  margin-top: 26rpx;
}

.course-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 21rpx;
}

.course-title {
  flex: 1;
  min-width: 0;
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

.tag-green {
  color: #12a86b;
  background: #e9f8f0;
}

.tag-blue {
  color: #2e63c3;
  background: #e8eefc;
}

.tag-red {
  color: #ef4136;
  background: #fff0ef;
}

.course-meta {
  margin-top: 14rpx;
  color: #667187;
  font-size: 23rpx;
}

.course-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 17rpx;
  margin-top: 26rpx;
  padding-top: 23rpx;
  border-top: 1rpx solid #edf0f5;
}

.course-note {
  flex: 1;
  min-width: 0;
  color: #7a8497;
  font-size: 21rpx;
}

.course-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 21rpx;
}

.small-action {
  color: #4968a9;
  font-size: 21rpx;
  font-weight: 700;
}

.course-empty {
  padding: 42rpx 0;
  color: #98a2b3;
  font-size: 23rpx;
  text-align: center;
}

.sheet-title {
  font-size: 42rpx;
  font-weight: 700;
}

.sheet-meta {
  margin-top: 18rpx;
  color: #667187;
  font-size: 23rpx;
}

.sheet-tag {
  display: inline-flex;
  align-items: center;
  min-height: 50rpx;
  padding: 8rpx 16rpx;
  margin-top: 18rpx;
  border-radius: 999rpx;
  font-size: 21rpx;
  font-weight: 700;
}

.sheet-note {
  margin-top: 24rpx;
  color: #7a8497;
  font-size: 21rpx;
  line-height: 1.6;
}

.sheet-section {
  margin: 35rpx 0 14rpx;
  font-size: 30rpx;
  font-weight: 700;
}

.sheet-content {
  padding: 28rpx;
  border-radius: 24rpx;
  background: #fff;
  color: #3f4652;
  font-size: 24rpx;
  line-height: 1.7;
}

.form-field {
  margin-top: 32rpx;
}

.form-label {
  margin-bottom: 14rpx;
  color: #5f697c;
  font-size: 23rpx;
  font-weight: 700;
}

.form-input {
  height: 78rpx;
  padding: 0 24rpx;
  border: 1rpx solid #dfe4ee;
  border-radius: 20rpx;
  background: #fff;
  color: #1f2024;
  font-size: 24rpx;
}

.form-textarea {
  width: 100%;
  height: 180rpx;
  padding: 21rpx 24rpx;
  border: 1rpx solid #dfe4ee;
  border-radius: 20rpx;
  background: #fff;
  color: #1f2024;
  font-size: 24rpx;
  box-sizing: border-box;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.accept {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 87rpx;
  margin-top: 38rpx;
  margin-bottom: 20rpx;
  border-radius: 999rpx;
  color: #fff;
  background: #4968a9;
  font-size: 28rpx;
  font-weight: 800;
}
</style>
