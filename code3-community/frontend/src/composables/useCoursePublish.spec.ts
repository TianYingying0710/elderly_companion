import { describe, expect, it, vi } from 'vitest'

import { useCoursePublish } from './useCoursePublish'
import type { CourseSummaryDto, CourseVideoUploadDto } from '../types/elderCourses'

const dto: CourseSummaryDto = {
  id: 'course-1',
  title: '智能手机基础操作',
  category: '数字素养',
  description: '从开关机到连 Wi-Fi。',
  duration_seconds: 600,
  video_url: null,
  status: 'published',
  editable: true,
}

const upload: CourseVideoUploadDto = { video_id: 'v1', video_url: '/api/v1/course-videos/v1' }

const validDraft = {
  title: '防诈骗第一课',
  category: '安全防护',
  description: '守住钱袋子',
  outlineText: '认识诈骗\n挂断电话',
  durationSeconds: '300',
  videoPath: '',
  videoName: '',
  videoSize: 0,
}

function deps(result: unknown) {
  return {
    listCourses: vi.fn(async () => [dto]),
    listLearningRecords: vi.fn(async () => []),
    uploadVideo: vi.fn(async () => upload),
    createCourse: vi.fn(async () => result),
    updatePublication: vi.fn(async () => result),
  }
}

describe('useCoursePublish', () => {
  it('load 拉取目录并映射为视图；失败写入 loadError', async () => {
    const ok = deps(dto)
    const controller = useCoursePublish(ok)
    await controller.load()
    expect(controller.courses.value).toHaveLength(1)
    expect(controller.loadError.value).toBe('')

    const failing = { listCourses: vi.fn(async () => { throw new Error('boom') }), listLearningRecords: vi.fn(async () => []) }
    const broken = useCoursePublish(failing)
    await broken.load()
    expect(broken.courses.value).toHaveLength(0)
    expect(broken.loadError.value).toBe('boom')
  })

  it('load 合并学习记录；记录读取失败不影响课程目录', async () => {
    const withProgress = useCoursePublish({
      ...deps(dto),
      listLearningRecords: vi.fn(async () => [{ course_id: 'course-1', progress_percent: 45, updated_at: 't' }]),
    })
    await withProgress.load()
    expect(withProgress.courses.value[0].progressPercent).toBe(45)
    expect(withProgress.loadError.value).toBe('')

    const brokenRecords = useCoursePublish({
      ...deps(dto),
      listLearningRecords: vi.fn(async () => { throw new Error('records down') }),
    })
    await brokenRecords.load()
    expect(brokenRecords.courses.value[0].progressPercent).toBeNull()
    expect(brokenRecords.loadError.value).toBe('')
  })

  it('无视频发布：直接建课并刷新目录', async () => {
    const d = deps(dto)
    const controller = useCoursePublish(d)
    const ok = await controller.publish(validDraft)
    expect(ok).toBe(true)
    expect(d.uploadVideo).not.toHaveBeenCalled()
    expect(d.createCourse).toHaveBeenCalledWith(
      expect.objectContaining({ title: '防诈骗第一课', outline: ['认识诈骗', '挂断电话'] }),
    )
    expect(controller.courses.value).toHaveLength(1)
    expect(controller.publishError.value).toBe('')
  })

  it('带视频发布：先上传拿 video_id，再随创建请求提交，进度文案推进', async () => {
    const d = deps(dto)
    const uploadVideo = vi.fn(async (_path: string, onProgress?: (p: number) => void) => {
      onProgress?.(55)
      return upload
    })
    const controller = useCoursePublish({ ...d, uploadVideo })
    const ok = await controller.publish({ ...validDraft, videoPath: 'tmp://a.mp4', videoName: 'a.mp4', videoSize: 10 })
    expect(ok).toBe(true)
    expect(uploadVideo).toHaveBeenCalledWith('tmp://a.mp4', expect.any(Function))
    expect(d.createCourse).toHaveBeenCalledWith(expect.objectContaining({ video_id: 'v1' }))
    expect(controller.progressText.value).toBe('')
  })

  it('本地表单校验失败不发起任何请求', async () => {
    const d = deps(dto)
    const controller = useCoursePublish(d)
    const ok = await controller.publish({ ...validDraft, title: '' })
    expect(ok).toBe(false)
    expect(d.uploadVideo).not.toHaveBeenCalled()
    expect(d.createCourse).not.toHaveBeenCalled()
    expect(controller.publishError.value).toBe('请先填写课程标题')
  })

  it('视频预检失败（非 mp4）不发起请求', async () => {
    const d = deps(dto)
    const controller = useCoursePublish(d)
    const ok = await controller.publish({ ...validDraft, videoPath: 'tmp://a.mov', videoName: 'a.mov', videoSize: 10 })
    expect(ok).toBe(false)
    expect(d.uploadVideo).not.toHaveBeenCalled()
    expect(d.createCourse).not.toHaveBeenCalled()
    expect(controller.publishError.value).toBe('仅支持 .mp4 视频文件')
  })

  it('后端 422 validation_failed 的字段信息进入 publishError', async () => {
    const d = deps(dto)
    const error = Object.assign(new Error('仅支持 .mp4 视频文件'), {
      statusCode: 422,
      code: 'validation_failed',
      fields: [{ path: 'file', code: 'value_error', message: '仅支持 .mp4 视频文件' }],
    })
    const controller = useCoursePublish({
      ...d,
      uploadVideo: vi.fn(async () => { throw error }),
    })
    const ok = await controller.publish({ ...validDraft, videoPath: 'tmp://a.mp4', videoName: 'a.mp4', videoSize: 10 })
    expect(ok).toBe(false)
    expect(controller.publishError.value).toBe('仅支持 .mp4 视频文件')
  })

  it('上下架成功后刷新目录并清空错误', async () => {
    const d = deps(dto)
    const controller = useCoursePublish(d)

    const ok = await controller.setPublication('course-1', 'unpublished')

    expect(ok).toBe(true)
    expect(d.updatePublication).toHaveBeenCalledWith('course-1', 'unpublished')
    expect(d.listCourses).toHaveBeenCalledTimes(1)
    expect(controller.updatingId.value).toBe('')
    expect(controller.publishError.value).toBe('')
  })

  it('上下架失败写入错误且不刷新目录', async () => {
    const error = Object.assign(new Error('课程状态不允许重复变更'), {
      statusCode: 409,
      code: 'illegal_course_publication',
      fields: [],
    })
    const d = {
      ...deps(dto),
      updatePublication: vi.fn(async () => { throw error }),
    }
    const controller = useCoursePublish(d)

    const ok = await controller.setPublication('course-1', 'unpublished')

    expect(ok).toBe(false)
    expect(d.listCourses).not.toHaveBeenCalled()
    expect(controller.publishError.value).toBe('课程状态不允许重复变更')
    expect(controller.updatingId.value).toBe('')
  })

  it('更新进行中阻止重复提交', async () => {
    let resolveUpdate: (value: CourseSummaryDto) => void = () => undefined
    const pending = new Promise<CourseSummaryDto>((resolve) => {
      resolveUpdate = resolve
    })
    const d = {
      ...deps(dto),
      updatePublication: vi.fn(() => pending),
    }
    const controller = useCoursePublish(d)

    const first = controller.setPublication('course-1', 'unpublished')
    const second = await controller.setPublication('course-1', 'published')

    expect(second).toBe(false)
    resolveUpdate(dto)
    await expect(first).resolves.toBe(true)
    expect(d.updatePublication).toHaveBeenCalledTimes(1)
  })
})
