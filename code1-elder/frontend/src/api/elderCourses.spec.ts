import { describe, expect, it, vi } from 'vitest'

import { elderApiBaseUrl, getCourseDetail, getCourses, parseCourseDetail, parseCourseSummary, resolveVideoUrl } from './elderCourses'

const summary = {
  id: 'course-1',
  title: '智能手机基础操作',
  category: '数字素养',
  description: '从开关机到连 Wi-Fi。',
  duration_seconds: 600,
  video_url: '/api/v1/course-videos/v1',
}

function ok(body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))
}

function failing(status: number) {
  return vi.fn(async () => new Response('no', { status }))
}

describe('elderCourses API（消费者契约）', () => {
  it('目录走 GET /api/v1/courses，逐条校验 DTO', async () => {
    const fetchFn = ok([summary])
    await expect(getCourses(fetchFn, 'http://x')).resolves.toEqual([summary])
    expect(fetchFn).toHaveBeenCalledWith('http://x/api/v1/courses')
  })

  it('详情走 GET /api/v1/courses/{id}，id 编码，校验大纲', async () => {
    const fetchFn = ok({ ...summary, outline: ['认识屏幕'] })
    await expect(getCourseDetail('a b', fetchFn, 'http://x')).resolves.toMatchObject({ outline: ['认识屏幕'] })
    expect(fetchFn).toHaveBeenCalledWith('http://x/api/v1/courses/a%20b')
    await expect(getCourseDetail('x', ok({ ...summary, outline: [1] }), 'http://x')).rejects.toThrow('invalid course outline')
  })

  it('非 2xx 抛出带状态码的错误', async () => {
    await expect(getCourses(failing(404), 'http://x')).rejects.toThrow('HTTP 404')
  })

  it.each([
    [{ ...summary, id: '' }, 'invalid course id'],
    [{ ...summary, duration_seconds: -1 }, 'invalid course duration_seconds'],
    [{ ...summary, video_url: 9 }, 'invalid course video_url'],
    [null, 'invalid course payload'],
  ])('非法课程载荷被拒绝：%s', (raw, message) => {
    expect(() => parseCourseSummary(raw)).toThrow(message)
    expect(() => parseCourseDetail(raw)).toThrow()
  })

  it('video_url 拼成绝对播放地址', () => {
    expect(resolveVideoUrl('/api/v1/course-videos/v1', 'http://x:8001')).toBe('http://x:8001/api/v1/course-videos/v1')
    expect(resolveVideoUrl('/api/v1/course-videos/v1', 'http://x:8001/')).toBe('http://x:8001/api/v1/course-videos/v1')
    expect(elderApiBaseUrl).toContain('8001')
  })
})
