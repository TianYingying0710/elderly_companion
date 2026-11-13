/** 助老课程页面编排（api 模式）：目录加载、详情打开、失败反馈。mock 模式走原有演示路径。 */

import { createCourseProvider, type CourseProvider } from '../data/courseProvider'
import type { Course, LearningHistoryItem } from '../types/domain'

export interface CoursesState {
  /** api 模式课程目录；mock 模式恒为空数组 */
  apiCourses: Course[]
  /** api 模式当前打开的课程详情 */
  apiCourse: Course | null
  /** api 模式学习记录（课程信息 + 进度） */
  apiHistory: LearningHistoryItem[]
  feedback: string
}

export type GoFn = (page: 'course-detail', courseId: string) => void

export function useCourses(state: CoursesState, go: GoFn, provider: CourseProvider = createCourseProvider()) {
  const isApi = provider.mode === 'api'

  /** api 模式启动时加载课程目录；失败经 feedback 提示，不阻塞其余页面 */
  async function loadCourses(): Promise<void> {
    if (!isApi) return
    try {
      state.apiCourses = await provider.list()
    } catch (error) {
      state.feedback = error instanceof Error ? error.message : '课程列表加载失败'
    }
  }

  /** api 模式：点开课程先取详情（大纲/视频），成功再跳转 */
  async function openApiCourse(courseId: string): Promise<void> {
    if (!isApi) return
    try {
      state.apiCourse = await provider.detail(courseId)
    } catch (error) {
      state.feedback = error instanceof Error ? error.message : '课程详情加载失败'
      return
    }
    go('course-detail', courseId)
  }

  /** api 模式：播放过程中写回学习进度；失败只提示，不打断播放 */
  async function recordProgress(courseId: string, progressPercent: number): Promise<void> {
    if (!isApi) return
    try {
      await provider.updateProgress(courseId, progressPercent)
    } catch (error) {
      state.feedback = error instanceof Error ? error.message : '学习进度保存失败'
    }
  }

  /** api 模式：打开学习记录页前加载真实记录；失败只提示，不阻塞页面 */
  async function loadLearningHistory(): Promise<void> {
    if (!isApi) return
    try {
      state.apiHistory = await provider.learningHistory()
    } catch (error) {
      state.feedback = error instanceof Error ? error.message : '学习记录加载失败'
    }
  }

  return { isApi, loadCourses, openApiCourse, recordProgress, loadLearningHistory }
}
