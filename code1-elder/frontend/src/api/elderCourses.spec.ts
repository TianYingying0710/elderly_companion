import { describe, expect, it, vi } from 'vitest'

import { elderApiBaseUrl, getCourseDetail, getCourses, getLearningRecords, parseCourseDetail, parseCourseSummary, parseLearningRecord, resolveVideoUrl, updateLearningRecord } from './elderCourses'

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

  it('学习进度走 PUT /api/v1/learning-records/{id}，提交 0-100 整数并校验响应', async () => {
    const record = { course_id: 'course-1', progress_percent: 30, updated_at: '2026-11-13T00:00:00Z' }
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(record), { status: 200 }))
    await expect(updateLearningRecord('course-1', 30, fetchFn, 'http://x')).resolves.toEqual(record)
    expect(fetchFn).toHaveBeenCalledWith('http://x/api/v1/learning-records/course-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress_percent: 30 }),
    })
  })

  it('进度越界不发起请求', async () => {
    const fetchFn = vi.fn()
    await expect(updateLearningRecord('course-1', 101, fetchFn, 'http://x')).rejects.toThrow('invalid progress_percent')
    await expect(updateLearningRecord('course-1', 1.5, fetchFn, 'http://x')).rejects.toThrow('invalid progress_percent')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('学习记录写入失败抛出带状态码的错误', async () => {
    await expect(updateLearningRecord('course-9', 10, failing(404), 'http://x')).rejects.toThrow('HTTP 404')
  })

  it.each([
    [{ course_id: '', progress_percent: 0, updated_at: 't' }, 'invalid learning record course_id'],
    [{ course_id: 'c', progress_percent: 101, updated_at: 't' }, 'invalid learning record progress_percent'],
    [{ course_id: 'c', progress_percent: 1.5, updated_at: 't' }, 'invalid learning record progress_percent'],
    [{ course_id: 'c', progress_percent: 0, updated_at: '' }, 'invalid learning record updated_at'],
    [null, 'invalid learning record payload'],
  ])('非法学习记录载荷被拒绝：%s', (raw, message) => {
    expect(() => parseLearningRecord(raw)).toThrow(message)
  })

  it('学习记录走 GET /api/v1/learning-records，逐条校验 DTO', async () => {
    const record = { course_id: 'course-1', progress_percent: 30, updated_at: '2026-11-13T00:00:00Z' }
    const fetchFn = ok([record])
    await expect(getLearningRecords(fetchFn, 'http://x')).resolves.toEqual([record])
    expect(fetchFn).toHaveBeenCalledWith('http://x/api/v1/learning-records')
  })

  it('学习记录列表非法载荷被拒绝，非 2xx 抛出带状态码的错误', async () => {
    await expect(getLearningRecords(ok({ course_id: 'c' }), 'http://x')).rejects.toThrow('invalid learning records payload')
    await expect(
      getLearningRecords(ok([{ course_id: '', progress_percent: 0, updated_at: 't' }]), 'http://x'),
    ).rejects.toThrow('invalid learning record course_id')
    await expect(getLearningRecords(failing(503), 'http://x')).rejects.toThrow('学习记录加载失败（HTTP 503）')
  })
})
