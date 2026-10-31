<script setup lang="ts">
import { computed, ref } from 'vue'
import AppToast from '../../components/AppToast.vue'
import SubPageHeader from '../../components/SubPageHeader.vue'
import { useToast } from '../../composables/useToast'
import { courseAfterAction, coursePublishLabel } from '../../domain/contentFlow'
import { COURSE_CATEGORIES, createCourses } from '../../mock/community'
import type { Course, CourseStatus } from '../../types/community'

const courses = ref<Course[]>(createCourses())
const activeCategory = ref('全部')
const { toastText, tip } = useToast()

const visibleCourses = computed(() =>
  activeCategory.value === '全部'
    ? courses.value
    : courses.value.filter((course) => course.category === activeCategory.value),
)

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

function notReady(label: string) {
  tip(`${label}功能待接入`)
}
</script>

<template>
  <view class="page">
    <SubPageHeader title="助老课程" subtitle="发布老人端数字学习课程">
      <template #action>
        <view class="create-button" @tap="notReady('新建助老课程')">＋ 新建</view>
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
              @tap="notReady('预览课程')"
            >预览</view>
            <view v-else class="small-action" @tap="notReady('编辑课程')">编辑</view>

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
</style>
