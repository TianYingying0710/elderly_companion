import { describe, expect, it, vi } from 'vitest'

import { ApiError } from './client'
import {
  createElderCourse,
  getElderCourses,
  getLearningRecords,
  parseCourseSummary,
  parseCourseVideoUpload,
  parseLearningRecord,
  updateCoursePublication,
  uploadCourseVideo,
} from './elderCourses'

const dto = {
  id: 'course-1',
  title: '智能手机基础操作',
  category: '数字素养',
  description: '从开关机到连 Wi-Fi。',
  duration_seconds: 600,
  video_url: null,
  status: 'published',
  editable: true,
}

function recorder(result: unknown) {
  const calls: { path: string; options?: Record<string, unknown> }[] = []
  const request = vi.fn(async (path: string, options?: Record<string, unknown>) => {
    calls.push({ path, options })
    return result
  })
  return { request, calls }
}

describe('elderCourses API（消费者契约）', () => {
  it('课程目录使用 GET /api/v1/courses，并逐条校验 DTO', async () => {
    const { request, calls } = recorder([dto])

    await expect(getElderCourses(request)).resolves.toEqual([dto])
    expect(calls[0]).toEqual({ path: '/api/v1/courses', options: { method: 'GET' } })
  })

  it('目录载荷不是数组时拒绝', async () => {
    const request = vi.fn(async () => ({ courses: [] }))
    await expect(getElderCourses(request)).rejects.toThrow('invalid courses payload')
  })

  it('创建课程提交完整 JSON 请求体', async () => {
    const { request, calls } = recorder(dto)
    const payload = {
      title: '防诈骗第一课',
      category: '安全防护',
      description: '守住钱袋子',
      duration_seconds: 300,
      outline: ['认识诈骗', '挂断电话'],
    }

    await expect(createElderCourse(payload, request)).resolves.toEqual(dto)
    expect(calls[0]).toMatchObject({
      path: '/api/v1/courses',
      options: { method: 'POST', data: payload, header: { 'Content-Type': 'application/json' } },
    })
  })

  it.each([
    [{ ...dto, id: '' }, 'invalid course id'],
    [{ ...dto, duration_seconds: -1 }, 'invalid course duration_seconds'],
    [{ ...dto, video_url: 123 }, 'invalid course video_url'],
    [null, 'invalid course payload'],
  ])('非法课程载荷被拒绝：%s', (raw, message) => {
    expect(() => parseCourseSummary(raw)).toThrow(message)
  })

  it('上传响应必须携带 video_id 与 video_url', () => {
    expect(parseCourseVideoUpload({ video_id: 'v1', video_url: '/api/v1/course-videos/v1' })).toEqual({
      video_id: 'v1',
      video_url: '/api/v1/course-videos/v1',
    })
    expect(() => parseCourseVideoUpload({ video_id: 'v1' })).toThrow('invalid video_url')
  })

  it('上传走 POST /api/v1/course-videos，201 解析 JSON 字符串并回传进度', async () => {
    const progresses: number[] = []
    const uploaded = vi.fn((options: { success: (r: { statusCode: number; data: string }) => void }) => {
      options.success({ statusCode: 201, data: JSON.stringify({ video_id: 'v1', video_url: '/api/v1/course-videos/v1' }) })
      return { onProgressUpdate: (cb: (p: { progress: number }) => void) => cb({ progress: 42.4 }) }
    })

    const result = await uploadCourseVideo('tmp://a.mp4', (p) => progresses.push(p), uploaded)

    expect(result).toEqual({ video_id: 'v1', video_url: '/api/v1/course-videos/v1' })
    expect(uploaded).toHaveBeenCalledTimes(1)
    expect(uploaded.mock.calls[0][0]).toMatchObject({ filePath: 'tmp://a.mp4', name: 'file' })
    expect(uploaded.mock.calls[0][0].url).toContain('/api/v1/course-videos')
    expect(progresses).toEqual([42])
  })

  it.each([
    [422, { error: { code: 'validation_failed', message: '仅支持 .mp4 视频文件', fields: [] } }, 'validation_failed'],
    [404, { error: { code: 'video_not_found', message: '视频不存在', fields: [] } }, 'video_not_found'],
  ])('上传失败 %s 按统一错误契约抛出', async (statusCode, body, code) => {
    const uploaded = vi.fn((options: { success: (r: { statusCode: number; data: unknown }) => void }) => {
      options.success({ statusCode, data: body })
      return {}
    })

    await expect(uploadCourseVideo('tmp://a.mov', undefined, uploaded)).rejects.toMatchObject({
      statusCode,
      code,
    })
  })

  it('上传网络失败归一为 network', async () => {
    const uploaded = vi.fn((options: { fail: (e: { errMsg: string }) => void }) => {
      options.fail({ errMsg: 'request:fail timeout' })
      return {}
    })

    await expect(uploadCourseVideo('tmp://a.mp4', undefined, uploaded)).rejects.toBeInstanceOf(ApiError)
    await expect(uploadCourseVideo('tmp://a.mp4', undefined, uploaded)).rejects.toMatchObject({
      statusCode: 0,
      code: 'network',
    })
  })

  it('学习记录使用 GET /api/v1/learning-records，并逐条校验 DTO', async () => {
    const record = { course_id: 'course-1', progress_percent: 60, updated_at: '2026-11-13T00:00:00Z' }
    const { request, calls } = recorder([record])

    await expect(getLearningRecords(request)).resolves.toEqual([record])
    expect(calls[0]).toEqual({ path: '/api/v1/learning-records', options: { method: 'GET' } })
  })

  it('学习记录载荷不是数组时拒绝', async () => {
    const request = vi.fn(async () => ({ records: [] }))
    await expect(getLearningRecords(request)).rejects.toThrow('invalid learning records payload')
  })

  it.each([
    [{ course_id: '', progress_percent: 0, updated_at: 't' }, 'invalid learning record course_id'],
    [{ course_id: 'c', progress_percent: -1, updated_at: 't' }, 'invalid learning record progress_percent'],
    [{ course_id: 'c', progress_percent: 101, updated_at: 't' }, 'invalid learning record progress_percent'],
    [{ course_id: 'c', progress_percent: 0, updated_at: '' }, 'invalid learning record updated_at'],
    [null, 'invalid learning record payload'],
  ])('非法学习记录载荷被拒绝：%s', (raw, message) => {
    expect(() => parseLearningRecord(raw)).toThrow(message)
  })

  it('管理目录可请求包含已下架课程', async () => {
    const { request, calls } = recorder([dto])

    await getElderCourses(request, { includeUnpublished: true })

    expect(calls[0]).toEqual({
      path: '/api/v1/courses?include_unpublished=true',
      options: { method: 'GET' },
    })
  })

  it('上下架使用 POST /publication 并携带 JSON 状态', async () => {
    const { request, calls } = recorder({ ...dto, status: 'unpublished' })

    await expect(
      updateCoursePublication('course-1', 'unpublished', request),
    ).resolves.toMatchObject({ status: 'unpublished' })

    expect(calls[0]).toEqual({
      path: '/api/v1/courses/course-1/publication',
      options: {
        method: 'POST',
        data: { status: 'unpublished' },
        header: { 'Content-Type': 'application/json' },
      },
    })
  })

  it.each([
    [{ ...dto, status: 'draft' }, 'invalid course status'],
    [{ ...dto, editable: 'yes' }, 'invalid course editable'],
  ])('非法发布字段被拒绝：%s', (raw, message) => {
    expect(() => parseCourseSummary(raw)).toThrow(message)
  })
})
