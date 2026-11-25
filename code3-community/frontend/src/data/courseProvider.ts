/** 课程目录 provider：mock/api 工厂（低耦合原则 2/3，默认 mock 行为不变） */

import type { Course } from '../types/community'
import type { ElderCourseView } from '../types/elderCourses'
import { getElderCourses, type getElderCourses as GetElderCourses } from '../api/elderCourses'
import { toElderCourseView } from '../mappers/courseMapper'
import { createCourses } from '../mock/community'

export type CourseCatalogMode = 'mock' | 'api'

export interface CourseCatalogProvider {
  mode: CourseCatalogMode
  /** api 模式返回课程目录（code1 GET /api/v1/courses）；mock 模式返回演示数据 */
  list: () => Promise<ElderCourseView[]>
}

/** 演示数据：与助老课程页原有演示口径一致（虚构，标注演示数据） */
function mockElderCourses(courses: Course[]): ElderCourseView[] {
  return courses.map((course) => ({
    id: course.id,
    title: course.title,
    category: course.category,
    description: `演示数据：${course.note || course.content || '本地演示课程'}`,
    durationText: course.duration,
    hasVideo: false,
    status: 'published',
    editable: false,
  }))
}

export function createMockCourseCatalogProvider(): CourseCatalogProvider {
  const demo = createCourses()
  return { mode: 'mock', list: async () => mockElderCourses(demo) }
}

export function createApiCourseCatalogProvider(
  fetchCourses: typeof GetElderCourses = getElderCourses,
): CourseCatalogProvider {
  return {
    mode: 'api',
    list: async () => (await fetchCourses()).map(toElderCourseView),
  }
}

export function createCourseCatalogProvider(
  mode: CourseCatalogMode = (import.meta.env.VITE_COURSE_DATA_MODE as CourseCatalogMode) ?? 'mock',
): CourseCatalogProvider {
  return mode === 'api' ? createApiCourseCatalogProvider() : createMockCourseCatalogProvider()
}
