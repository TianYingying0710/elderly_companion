<script setup lang="ts">
import { computed, ref } from 'vue'
import AppToast from '../../components/AppToast.vue'
import BottomSheet from '../../components/BottomSheet.vue'
import SubPageHeader from '../../components/SubPageHeader.vue'
import { useCoursePublish } from '../../composables/useCoursePublish'
import { useToast } from '../../composables/useToast'
import { courseAfterAction, coursePublishLabel } from '../../domain/contentFlow'
import { COURSE_CATEGORIES, createCourses } from '../../mock/community'
import type { CourseFormDraft } from '../../types/elderCourses'
import type { Course, CourseStatus } from '../../types/community'

const courses = ref<Course[]>(createCourses())
const activeCategory = ref('全部')
const { toastText, tip } = useToast()

// api 模式：课程目录与发布直查老人端后端（课程单一内容源；VITE_COURSE_DATA_MODE 开关）
const catalog = useCoursePublish()
const isApi = catalog.mode === 'api'
if (isApi) catalog.load()

const emptyApiDraft = (category: string): CourseFormDraft => ({
  title: '',
  category,
  description: '',
  outlineText: '',
  durationSeconds: '0',
  videoPath: '',
  videoName: '',
  videoSize: 0,
})
const apiDraft = ref<CourseFormDraft>(emptyApiDraft('手机基础'))

function chooseVideo() {
  uni.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['mp4'],
    success: (res) => {
      const file = res.tempFiles[0]
      if (!file) return
      apiDraft.value.videoPath = file.path
      apiDraft.value.videoName = file.name
      apiDraft.value.videoSize = file.size
      tip(`已选择视频：${file.name}`)
    },
    fail: () => tip('未选择视频文件'),
  })
}

function clearVideo() {
  apiDraft.value.videoPath = ''
  apiDraft.value.videoName = ''
  apiDraft.value.videoSize = 0
}

async function publishApiCourse() {
  const ok = await catalog.publish(apiDraft.value)
  if (!ok) return
  apiDraft.value = emptyApiDraft(apiDraft.value.category)
  tip('课程已发布到老人端')
  closeSheet()
}

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
  apiDraft.value = emptyApiDraft('手机基础')
  mode.value = 'create'
}

function closeSheet() {
  mode.value = null
  editingId.value = ''
}

function saveDraft() {
  if (isApi) {
    publishApiCourse()
    return
  }
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

    <template v-if="isApi">
      <view class="api-banner">演示环境：课程发布至老人端课程服务（进程内存储，重启即清）。</view>
      <view v-if="catalog.loading.value" class="course-empty">课程目录加载中…</view>
      <view v-else-if="catalog.loadError.value" class="course-empty">{{ catalog.loadError.value }}</view>
      <view v-else class="course-list">
        <view v-for="course in catalog.courses.value" :key="course.id" class="course-card">
          <view class="course-top">
            <view class="course-title">{{ course.title }}</view>
            <view class="tag" :class="course.hasVideo ? 'tag-green' : 'tag-blue'">
              {{ course.hasVideo ? '有视频' : '无视频' }}
            </view>
          </view>
          <view class="course-meta">{{ course.category }} · {{ course.durationText }}</view>
          <view class="course-note">{{ course.description }}</view>
        </view>
        <view v-if="catalog.courses.value.length === 0" class="course-empty">暂无课程</view>
      </view>
    </template>

    <template v-else>
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
    </template>
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

    <!-- api 模式：字段对齐老人端后端课程契约，先传视频拿 video_id 再建课 -->
    <template v-if="isApi">
      <view class="form-field">
        <view class="form-label">课程标题（≤50 字）</view>
        <input v-model="apiDraft.title" class="form-input" placeholder="例如：怎样调大手机字体" />
      </view>
      <view class="form-field">
        <view class="form-label">分类（≤20 字）</view>
        <view class="chip-row">
          <view
            v-for="category in COURSE_CATEGORIES.filter((c) => c !== '全部')"
            :key="category"
            class="category-chip"
            :class="{ active: apiDraft.category === category }"
            @tap="apiDraft.category = category"
          >{{ category }}</view>
        </view>
      </view>
      <view class="form-field">
        <view class="form-label">课程简介（≤200 字）</view>
        <textarea v-model="apiDraft.description" class="form-textarea" placeholder="一句话说明这门课教什么" />
      </view>
      <view class="form-field">
        <view class="form-label">课程大纲（每行一条，1-20 条）</view>
        <textarea v-model="apiDraft.outlineText" class="form-textarea" placeholder="第一步&#10;第二步&#10;第三步" />
      </view>
      <view class="form-field">
        <view class="form-label">视频时长（秒，≥0）</view>
        <input v-model="apiDraft.durationSeconds" class="form-input" type="number" placeholder="例如：180" />
      </view>
      <view class="form-field">
        <view class="form-label">课程视频（可选，仅 .mp4、≤200MB）</view>
        <view class="upload-button" @tap="chooseVideo">选择视频文件</view>
        <view v-if="apiDraft.videoPath" class="upload-file">
          <text class="upload-name">{{ apiDraft.videoName }}</text>
          <text class="upload-remove" @tap="clearVideo">移除</text>
        </view>
        <view v-if="catalog.progressText.value" class="upload-progress">{{ catalog.progressText.value }}</view>
      </view>
      <view v-if="catalog.publishError.value" class="publish-error">{{ catalog.publishError.value }}</view>
      <view class="accept" @tap="saveDraft">{{ catalog.publishing.value ? '发布中…' : '发布课程' }}</view>
    </template>

    <template v-else>
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

.create-button {
  padding: 14rpx 21rpx;
  border-radius: 999rpx;
  color: #2e63c3;
  background: #e8eefc;
  font-size: 21rpx;
  font-weight: 700;
  white-space: nowrap;
}

.api-banner {
  margin-bottom: 31rpx;
  padding: 24rpx 28rpx;
  border-radius: 26rpx;
  color: #667187;
  background: #edf2fb;
  font-size: 21rpx;
  line-height: 1.55;
}

.upload-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 78rpx;
  border: 1rpx dashed #a9bcd9;
  border-radius: 20rpx;
  color: #4968a9;
  background: #f4f7fd;
  font-size: 24rpx;
  font-weight: 700;
}

.upload-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 17rpx;
  margin-top: 14rpx;
  padding: 17rpx 21rpx;
  border-radius: 18rpx;
  background: #eef3fb;
}

.upload-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #3f4652;
  font-size: 21rpx;
}

.upload-remove {
  flex: none;
  color: #ef4136;
  font-size: 21rpx;
  font-weight: 700;
}

.upload-progress {
  margin-top: 14rpx;
  color: #2e63c3;
  font-size: 21rpx;
}

.publish-error {
  margin-top: 24rpx;
  padding: 17rpx 21rpx;
  border-radius: 18rpx;
  color: #ef4136;
  background: #fff0ef;
  font-size: 21rpx;
  line-height: 1.5;
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
