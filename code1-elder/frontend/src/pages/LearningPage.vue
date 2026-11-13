<script setup lang="ts">
import { computed } from 'vue'
import type { ElderApp } from '../composables/useElderApp'
import PageHero from '../components/PageHero.vue'
import CourseList from '../components/CourseList.vue'
import { formatUpdatedAt, toProgressPercent } from '../mappers/courseMapper'
const props = defineProps<{ app: ElderApp }>()
const categories = ['全部', '出行打车', '就医挂号', '日常生活', '聊天联络', '防骗安全']
const courses = computed(() => props.app.state.data?.courses.filter(c => (props.app.state.category === '全部' || c.category === props.app.state.category) && (c.title + c.description + c.category).includes(props.app.state.query.trim())) ?? [])
// api 模式：课程来自课程服务（后端预置演示课程 + 社区端发布课程），沿用搜索过滤
const apiCourses = computed(() => props.app.state.apiCourses.filter(c => (c.title + c.description + c.category).includes(props.app.state.query.trim())))
const selected = computed(() => props.app.state.data?.courses.find(c => c.id === props.app.state.selected))
const apiCourse = computed(() => props.app.state.apiCourse)
// api 模式：视频播放进度每提升 10% 且间隔 ≥4 秒写回一次；播完固定写 100
let progressCourseId = ''
let lastSentPercent = -1
let lastSentAt = 0
function onVideoTimeUpdate(event: Event) {
  const course = apiCourse.value
  if (!course) return
  if (progressCourseId !== course.id) {
    progressCourseId = course.id
    lastSentPercent = -1
    lastSentAt = 0
  }
  const video = event.target as HTMLVideoElement
  const percent = toProgressPercent(video.currentTime, video.duration)
  if (percent === lastSentPercent) return
  if (percent < 100 && (percent - lastSentPercent < 10 || Date.now() - lastSentAt < 4000)) return
  lastSentPercent = percent
  lastSentAt = Date.now()
  props.app.recordProgress(course.id, percent)
}
function onVideoEnded() {
  const course = apiCourse.value
  if (!course) return
  progressCourseId = course.id
  lastSentPercent = 100
  lastSentAt = Date.now()
  props.app.recordProgress(course.id, 100)
}
</script>
<template><template v-if="app.state.page === 'learn'"><PageHero title="数字教学" subtitle="一步一步学，生活更方便"/><div class="content"><input v-model="app.state.query" type="search" aria-label="搜索教程" placeholder="搜索您想学的内容"/><template v-if="app.isCourseApi"><p class="demo-note">课程来自社区端发布（演示环境，数据存内存、重启即清）。</p><section class="card"><h2>学习教程</h2><CourseList :courses="apiCourses" @select="app.openApiCourse($event)"/><p v-if="apiCourses.length === 0" class="empty">暂无课程</p></section></template><template v-else><div class="categories"><button v-for="category in categories" :key="category" :aria-pressed="app.state.category === category" :class="{ selected: app.state.category === category }" @click="app.state.category = category">{{ category }}</button></div><section class="card"><h2>学习教程</h2><CourseList v-if="app.state.demo" :courses="courses" @select="app.go('course-detail', $event)"/><p v-else class="empty">教学服务尚未接入</p></section></template><button class="row card" data-testid="learning-history" @click="app.openLearningHistory()"><strong>学习记录</strong><span>›</span></button></div></template><div v-else-if="app.state.page === 'course-detail'" class="content"><template v-if="app.isCourseApi && apiCourse"><p class="demo-note">课程来自社区端发布（演示环境）。</p><video v-if="apiCourse.videoUrl" class="course-video" controls preload="metadata" :src="apiCourse.videoUrl" aria-label="课程视频播放器" @timeupdate="onVideoTimeUpdate" @ended="onVideoEnded"></video><p v-else class="empty">本课程暂无视频</p><section class="card"><h2>{{ apiCourse.title }}</h2><p>{{ apiCourse.description }}</p><p>{{ apiCourse.category }} · {{ apiCourse.duration }}</p></section><section class="card"><h2>本课内容</h2><p v-for="(item, i) in apiCourse.outline" :key="item">{{ i + 1 }}．{{ item }}</p></section></template><template v-else-if="selected"><p class="demo-note">课程为演示数据，没有真实视频。</p><div class="video" :class="selected.color"><span>{{ selected.symbol }}</span><button class="primary" @click="app.state.feedback = '没有真实视频，当前仅展示播放界面'">▷ 播放预览</button><small>{{ selected.duration }} · 模拟时长</small></div><section class="card"><h2>{{ selected.title }}</h2><p>{{ selected.description }}</p></section><section class="card"><h2>本课内容</h2><p v-for="(item, i) in selected.outline" :key="item">{{ i + 1 }}．{{ item }}</p></section></template><p v-else class="empty">课程服务尚未接入</p></div><div v-else class="content"><template v-if="app.isCourseApi"><p class="demo-note">学习记录来自课程服务（演示环境）。</p><p v-if="app.state.apiHistoryLoading" class="empty">正在加载学习记录…</p><p v-else-if="app.state.apiHistoryFailed" class="empty">学习记录加载失败，请稍后重试</p><template v-else-if="app.state.apiHistory.length > 0"><section v-for="item in app.state.apiHistory" :key="item.course.id" class="card"><CourseList :courses="[item.course]" @select="app.openApiCourse($event)"/><progress :value="item.progressPercent" max="100" :aria-label="item.course.title + '学习进度'"/><p>已学习 {{ item.progressPercent }}%<template v-if="formatUpdatedAt(item.updatedAt)"> · 更新于 {{ formatUpdatedAt(item.updatedAt) }}</template></p></section></template><p v-else class="empty">暂无学习记录</p></template><template v-else-if="app.state.data"><p class="demo-note">以下为模拟学习记录</p><section v-for="course in app.state.data.courses.filter(c => c.progress > 0)" :key="course.id" class="card"><CourseList :courses="[course]" @select="app.go('course-detail', $event)"/><progress :value="course.progress" max="100" :aria-label="course.title + '学习进度'"/><p>已学习 {{ course.progress }}% · 模拟</p></section></template><p v-else class="empty">学习记录服务尚未接入</p></div></template>
