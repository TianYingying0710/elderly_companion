/** 课程 provider：mock/api 工厂（低耦合原则 2/3；默认 mock，页面演示行为不变） */

import type { Course } from '../types/domain'
import { getCourses, getCourseDetail, type FetchLike } from '../api/elderCourses'
import { toDomainCourse, toDomainCourseDetail } from '../mappers/courseMapper'

export type CourseSourceMode = 'mock' | 'api'

export interface CourseProvider {
  mode: CourseSourceMode
  /** api 模式：课程目录（后端预置演示课程 + 社区端发布课程） */
  list: () => Promise<Course[]>
  /** api 模式：单门课程详情（含大纲与视频地址）；失败时抛错由调用方提示 */
  detail: (courseId: string) => Promise<Course>
}

export function createApiCourseProvider(fetchFn: FetchLike = fetch): CourseProvider {
  return {
    mode: 'api',
    list: async () => (await getCourses(fetchFn)).map((dto, index) => toDomainCourse(dto, index)),
    detail: async (courseId) => {
      // 请求失败（不存在/网络错误）直接抛出，由 composable 统一反馈
      const dto = await getCourseDetail(courseId, fetchFn)
      return toDomainCourseDetail(dto, 0)
    },
  }
}

export function createMockCourseProvider(): CourseProvider {
  return { mode: 'mock', list: async () => [], detail: async () => { throw new Error('mock 模式不提供课程详情') } }
}

export function createCourseProvider(
  mode: CourseSourceMode = (import.meta.env.VITE_COURSE_DATA_MODE as CourseSourceMode) ?? 'mock',
): CourseProvider {
  return mode === 'api' ? createApiCourseProvider() : createMockCourseProvider()
}
