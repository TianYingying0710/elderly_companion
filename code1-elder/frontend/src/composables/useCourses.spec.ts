import { reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useCourses, type CoursesState } from './useCourses'
import type { Course, LearningHistoryItem } from '../types/domain'

function state(): CoursesState & Record<string, unknown> {
  return reactive({ apiCourses: [] as Course[], apiCourse: null as Course | null, apiHistory: [] as LearningHistoryItem[], feedback: '' })
}

const course: Course = { id: 'course-1', title: '智能手机基础操作', category: '数字素养', description: 'd', duration: '约 10 分钟', color: 'blue', symbol: '📖', progress: 0, outline: [], videoUrl: null }

describe('useCourses（api 模式编排）', () => {
  it('加载目录写入 state.apiCourses；失败写 feedback', async () => {
    const s = state()
    const provider = { mode: 'api' as const, list: vi.fn(async () => [course]), detail: vi.fn(async () => course), updateProgress: vi.fn(async () => undefined), learningHistory: vi.fn(async () => []) }
    const { loadCourses } = useCourses(s, vi.fn(), provider)
    await loadCourses()
    expect(s.apiCourses).toEqual([course])
    expect(s.feedback).toBe('')

    const broken = { mode: 'api' as const, list: vi.fn(async () => { throw new Error('HTTP 500') }), detail: vi.fn(async () => course), updateProgress: vi.fn(async () => undefined), learningHistory: vi.fn(async () => []) }
    const s2 = state()
    useCourses(s2, vi.fn(), broken).loadCourses()
    await Promise.resolve()
    await Promise.resolve()
    expect(s2.feedback).toBe('HTTP 500')
  })

  it('openApiCourse：先取详情成功再跳转；失败不跳转', async () => {
    const s = state()
    const go = vi.fn()
    const provider = { mode: 'api' as const, list: vi.fn(async () => []), detail: vi.fn(async () => course), updateProgress: vi.fn(async () => undefined), learningHistory: vi.fn(async () => []) }
    const { openApiCourse } = useCourses(s, go, provider)
    await openApiCourse('course-1')
    expect(provider.detail).toHaveBeenCalledWith('course-1')
    expect(s.apiCourse).toEqual(course)
    expect(go).toHaveBeenCalledWith('course-detail', 'course-1')

    const s2 = state()
    const go2 = vi.fn()
    const broken = { mode: 'api' as const, list: vi.fn(async () => []), detail: vi.fn(async () => { throw new Error('HTTP 404') }), updateProgress: vi.fn(async () => undefined), learningHistory: vi.fn(async () => []) }
    await useCourses(s2, go2, broken).openApiCourse('x')
    expect(s2.apiCourse).toBeNull()
    expect(s2.feedback).toBe('HTTP 404')
    expect(go2).not.toHaveBeenCalled()
  })

  it('mock 模式为空实现：不动 state、不跳转', async () => {
    const s = state()
    const go = vi.fn()
    const provider = { mode: 'mock' as const, list: vi.fn(async () => []), detail: vi.fn(async () => course), updateProgress: vi.fn(async () => undefined), learningHistory: vi.fn(async () => []) }
    const { isApi, loadCourses, openApiCourse } = useCourses(s, go, provider)
    expect(isApi).toBe(false)
    await loadCourses()
    await openApiCourse('course-1')
    expect(provider.list).not.toHaveBeenCalled()
    expect(provider.detail).not.toHaveBeenCalled()
    expect(go).not.toHaveBeenCalled()
    expect(s.apiCourses).toEqual([])
  })

  it('recordProgress：api 模式写回，失败写 feedback；mock 不调用', async () => {
    const s = state()
    const updateProgress = vi.fn(async () => undefined)
    const provider = { mode: 'api' as const, list: vi.fn(async () => []), detail: vi.fn(async () => course), updateProgress, learningHistory: vi.fn(async () => []) }
    await useCourses(s, vi.fn(), provider).recordProgress('course-1', 30)
    expect(updateProgress).toHaveBeenCalledWith('course-1', 30)
    expect(s.feedback).toBe('')

    const s2 = state()
    const failing = { mode: 'api' as const, list: vi.fn(async () => []), detail: vi.fn(async () => course), updateProgress: vi.fn(async () => { throw new Error('HTTP 400') }), learningHistory: vi.fn(async () => []) }
    await useCourses(s2, vi.fn(), failing).recordProgress('course-1', 10)
    expect(s2.feedback).toBe('HTTP 400')

    const updateMock = vi.fn(async () => undefined)
    const mock = { mode: 'mock' as const, list: vi.fn(async () => []), detail: vi.fn(async () => course), updateProgress: updateMock, learningHistory: vi.fn(async () => []) }
    await useCourses(state(), vi.fn(), mock).recordProgress('course-1', 10)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('loadLearningHistory：api 模式写入历史；失败写 feedback；mock 不调用', async () => {
    const entry: LearningHistoryItem = { course, progressPercent: 40, updatedAt: '2026-11-13T02:03:00Z' }
    const s = state()
    const provider = { mode: 'api' as const, list: vi.fn(async () => []), detail: vi.fn(async () => course), updateProgress: vi.fn(async () => undefined), learningHistory: vi.fn(async () => [entry]) }
    await useCourses(s, vi.fn(), provider).loadLearningHistory()
    expect(s.apiHistory).toEqual([entry])
    expect(s.feedback).toBe('')

    const s2 = state()
    const failing = { mode: 'api' as const, list: vi.fn(async () => []), detail: vi.fn(async () => course), updateProgress: vi.fn(async () => undefined), learningHistory: vi.fn(async () => { throw new Error('学习记录加载失败（HTTP 503）') }) }
    await useCourses(s2, vi.fn(), failing).loadLearningHistory()
    expect(s2.feedback).toBe('学习记录加载失败（HTTP 503）')

    const loadHistory = vi.fn(async () => [entry])
    const mock = { mode: 'mock' as const, list: vi.fn(async () => []), detail: vi.fn(async () => course), updateProgress: vi.fn(async () => undefined), learningHistory: loadHistory }
    const s3 = state()
    await useCourses(s3, vi.fn(), mock).loadLearningHistory()
    expect(loadHistory).not.toHaveBeenCalled()
    expect(s3.apiHistory).toEqual([])
  })
})
