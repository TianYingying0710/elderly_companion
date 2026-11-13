import { describe, expect, it, vi } from 'vitest'

import { createApiCourseProvider, createCourseProvider, createMockCourseProvider } from './courseProvider'

const detail = {
  id: 'course-1',
  title: '智能手机基础操作',
  category: '数字素养',
  description: '从开关机到连 Wi-Fi。',
  duration_seconds: 600,
  video_url: '/api/v1/course-videos/v1',
  outline: ['认识屏幕与按键'],
}

function ok(body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))
}

describe('courseProvider（老人端）', () => {
  it('api provider：目录映射 domain，详情失败抛错由调用方反馈', async () => {
    const fetchFn = vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/course-1') ? detail : [detail]), { status: 200 }))
    const provider = createApiCourseProvider(fetchFn)
    expect(provider.mode).toBe('api')
    expect((await provider.list())[0]).toMatchObject({ id: 'course-1', duration: '约 10 分钟' })
    await expect(provider.detail('course-1')).resolves.toMatchObject({ outline: ['认识屏幕与按键'] })
    const broken = createApiCourseProvider(vi.fn(async () => new Response('no', { status: 404 })))
    await expect(broken.detail('course-x')).rejects.toThrow('HTTP 404')
  })

  it('mock provider 为空实现（页面演示路径不经过 provider）', async () => {
    const provider = createMockCourseProvider()
    expect(provider.mode).toBe('mock')
    await expect(provider.list()).resolves.toEqual([])
    await expect(provider.detail('x')).rejects.toThrow('mock 模式不提供课程详情')
  })

  it('api provider 写回学习进度；mock 为空实现', async () => {
    const record = { course_id: 'course-1', progress_percent: 40, updated_at: '2026-11-13T00:00:00Z' }
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(record), { status: 200 }))
    await createApiCourseProvider(fetchFn).updateProgress('course-1', 40)
    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/learning-records/course-1'),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ progress_percent: 40 }) }),
    )
    await expect(createMockCourseProvider().updateProgress('course-1', 40)).resolves.toBeUndefined()
  })

  it('工厂默认 mock，按模式参数切换', () => {
    expect(createCourseProvider('mock').mode).toBe('mock')
    expect(createCourseProvider('api').mode).toBe('api')
    // 本地 .env.local 可能设置 api 模式，这里显式清空环境变量验证默认值
    vi.stubEnv('VITE_COURSE_DATA_MODE', undefined)
    expect(createCourseProvider().mode).toBe('mock')
    vi.unstubAllEnvs()
  })

  it('api provider 合并课程与学习记录；mock 返回空历史', async () => {
    const record = { course_id: 'course-1', progress_percent: 40, updated_at: '2026-11-13T02:03:00Z' }
    const fetchFn = vi.fn(async (url: string) =>
      url.endsWith('/learning-records')
        ? new Response(JSON.stringify([record]), { status: 200 })
        : new Response(JSON.stringify([detail]), { status: 200 }),
    )
    const history = await createApiCourseProvider(fetchFn).learningHistory()
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      progressPercent: 40,
      updatedAt: '2026-11-13T02:03:00Z',
      course: { id: 'course-1', title: '智能手机基础操作' },
    })
    expect(fetchFn).toHaveBeenCalledWith(expect.stringContaining('/api/v1/learning-records'))
    await expect(createMockCourseProvider().learningHistory()).resolves.toEqual([])
  })
})
