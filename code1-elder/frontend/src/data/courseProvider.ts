/** 课程 provider：mock/api 工厂（低耦合原则 2/3；默认 mock，页面演示行为不变） */

import { getCourses, getCourseDetail, getLearningRecords, updateLearningRecord, type FetchLike } from '../api/elderCourses'
import type { Course, LearningHistoryItem } from '../types/domain'
import { toDomainCourse, toDomainCourseDetail, toLearningHistory } from '../mappers/courseMapper'

export type CourseSourceMode = 'mock' | 'api'

export interface CourseProvider {
  mode: CourseSourceMode
  /** api 模式：课程目录（后端预置演示课程 + 社区端发布课程） */
  list: () => Promise<Course[]>
  /** api 模式：单门课程详情（含大纲与视频地址）；失败时抛错由调用方提示 */
  detail: (courseId: string) => Promise<Course>
  /** api 模式：写回学习进度（0-100 整数）；mock 模式为空实现 */
  updateProgress: (courseId: string, progressPercent: number) => Promise<void>
  /** api 模式：学习记录（课程目录 + 记录合并，按更新时间倒序）；mock 返回空数组 */
  learningHistory: () => Promise<LearningHistoryItem[]>
}

export function createApiCourseProvider(fetchFn: FetchLike = fetch): CourseProvider {
  const listCourses = async () => (await getCourses(fetchFn)).map((dto, index) => toDomainCourse(dto, index))
  return {
    mode: 'api',
    list: listCourses,
    detail: async (courseId) => toDomainCourseDetail(await getCourseDetail(courseId, fetchFn), 0),
    updateProgress: async (courseId, progressPercent) => {
      await updateLearningRecord(courseId, progressPercent, fetchFn)
    },
    learningHistory: async () => {
      const [courses, records] = await Promise.all([listCourses(), getLearningRecords(fetchFn)])
      return toLearningHistory(courses, records)
    },
  }
}

export function createMockCourseProvider(): CourseProvider {
  return {
    mode: 'mock',
    list: async () => [],
    detail: async () => { throw new Error('mock 模式不提供课程详情') },
    updateProgress: async () => undefined,
    learningHistory: async () => [],
  }
}

export function createCourseProvider(
  mode: CourseSourceMode = (import.meta.env.VITE_COURSE_DATA_MODE as CourseSourceMode) ?? 'mock',
): CourseProvider {
  return mode === 'api' ? createApiCourseProvider() : createMockCourseProvider()
}
