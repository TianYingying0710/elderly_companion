import { describe, expect, it, vi } from 'vitest'

import {
  createApiCourseCatalogProvider,
  createCourseCatalogProvider,
  createMockCourseCatalogProvider,
} from './courseProvider'

const dto = {
  id: 'course-1',
  title: '智能手机基础操作',
  category: '数字素养',
  description: '从开关机到连 Wi-Fi。',
  duration_seconds: 600,
  video_url: '/api/v1/course-videos/v1',
}

describe('courseProvider', () => {
  it('mock provider 返回标注演示数据的课程', async () => {
    const provider = createMockCourseCatalogProvider()
    expect(provider.mode).toBe('mock')
    const courses = await provider.list()
    expect(courses.length).toBeGreaterThan(0)
    expect(courses.every((course) => course.description.includes('演示数据'))).toBe(true)
    expect(courses.every((course) => !course.hasVideo)).toBe(true)
  })

  it('api provider 映射 DTO 到视图', async () => {
    const fetchCourses = vi.fn(async () => [dto])
    const provider = createApiCourseCatalogProvider(fetchCourses)
    expect(provider.mode).toBe('api')
    expect(await provider.list()).toEqual([
      {
        id: 'course-1',
        title: '智能手机基础操作',
        category: '数字素养',
        description: '从开关机到连 Wi-Fi。',
        durationText: '约 10 分钟',
        hasVideo: true,
      },
    ])
  })

  it('工厂默认 mock，按模式参数切换', () => {
    expect(createCourseCatalogProvider('mock').mode).toBe('mock')
    expect(createCourseCatalogProvider('api').mode).toBe('api')
    // 本地 .env.local 可能设置 api 模式，这里显式清空环境变量验证默认值
    vi.stubEnv('VITE_COURSE_DATA_MODE', undefined)
    expect(createCourseCatalogProvider().mode).toBe('mock')
    vi.unstubAllEnvs()
  })
})
