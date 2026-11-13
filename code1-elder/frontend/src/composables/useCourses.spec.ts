import { reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useCourses, type CoursesState } from './useCourses'
import type { Course } from '../types/domain'

function state(): CoursesState & Record<string, unknown> {
  return reactive({ apiCourses: [] as Course[], apiCourse: null as Course | null, feedback: '' })
}

const course: Course = { id: 'course-1', title: '智能手机基础操作', category: '数字素养', description: 'd', duration: '约 10 分钟', color: 'blue', symbol: '📖', progress: 0, outline: [], videoUrl: null }

describe('useCourses（api 模式编排）', () => {
  it('加载目录写入 state.apiCourses；失败写 feedback', async () => {
    const s = state()
    const provider = { mode: 'api' as const, list: vi.fn(async () => [course]), detail: vi.fn(async () => course) }
    const { loadCourses } = useCourses(s, vi.fn(), provider)
    await loadCourses()
    expect(s.apiCourses).toEqual([course])
    expect(s.feedback).toBe('')

    const broken = { mode: 'api' as const, list: vi.fn(async () => { throw new Error('HTTP 500') }), detail: vi.fn(async () => course) }
    const s2 = state()
    useCourses(s2, vi.fn(), broken).loadCourses()
    await Promise.resolve()
    await Promise.resolve()
    expect(s2.feedback).toBe('HTTP 500')
  })

  it('openApiCourse：先取详情成功再跳转；失败不跳转', async () => {
    const s = state()
    const go = vi.fn()
    const provider = { mode: 'api' as const, list: vi.fn(async () => []), detail: vi.fn(async () => course) }
    const { openApiCourse } = useCourses(s, go, provider)
    await openApiCourse('course-1')
    expect(provider.detail).toHaveBeenCalledWith('course-1')
    expect(s.apiCourse).toEqual(course)
    expect(go).toHaveBeenCalledWith('course-detail', 'course-1')

    const s2 = state()
    const go2 = vi.fn()
    const broken = { mode: 'api' as const, list: vi.fn(async () => []), detail: vi.fn(async () => { throw new Error('HTTP 404') }) }
    await useCourses(s2, go2, broken).openApiCourse('x')
    expect(s2.apiCourse).toBeNull()
    expect(s2.feedback).toBe('HTTP 404')
    expect(go2).not.toHaveBeenCalled()
  })

  it('mock 模式为空实现：不动 state、不跳转', async () => {
    const s = state()
    const go = vi.fn()
    const provider = { mode: 'mock' as const, list: vi.fn(async () => []), detail: vi.fn(async () => course) }
    const { isApi, loadCourses, openApiCourse } = useCourses(s, go, provider)
    expect(isApi).toBe(false)
    await loadCourses()
    await openApiCourse('course-1')
    expect(provider.list).not.toHaveBeenCalled()
    expect(provider.detail).not.toHaveBeenCalled()
    expect(go).not.toHaveBeenCalled()
    expect(s.apiCourses).toEqual([])
  })
})
