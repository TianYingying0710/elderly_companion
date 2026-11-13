import { describe, expect, it } from 'vitest'

import {
  CourseFormError,
  assertVideoFile,
  formatDuration,
  mergeLearningProgress,
  parseOutline,
  toCreateCoursePayload,
  toElderCourseView,
} from './courseMapper'
import type { CourseFormDraft, CourseSummaryDto } from '../types/elderCourses'

const dto: CourseSummaryDto = {
  id: 'course-1',
  title: '智能手机基础操作',
  category: '数字素养',
  description: '从开关机到连 Wi-Fi。',
  duration_seconds: 600,
  video_url: '/api/v1/course-videos/v1',
}

const validDraft: CourseFormDraft = {
  title: '防诈骗第一课',
  category: '安全防护',
  description: '守住钱袋子',
  outlineText: '认识诈骗\n\n挂断电话  \n',
  durationSeconds: '300',
  videoPath: '',
  videoName: '',
  videoSize: 0,
}

describe('courseMapper', () => {
  it('DTO→视图：秒数转适老时长文案，video_url 判定有无视频', () => {
    expect(toElderCourseView(dto)).toEqual({
      id: 'course-1',
      title: '智能手机基础操作',
      category: '数字素养',
      description: '从开关机到连 Wi-Fi。',
      durationText: '约 10 分钟',
      hasVideo: true,
    })
    expect(toElderCourseView({ ...dto, video_url: null }).hasVideo).toBe(false)
    expect(toElderCourseView({ ...dto, video_url: '' }).hasVideo).toBe(false)
  })

  it.each([
    [0, '0 秒'],
    [45, '45 秒'],
    [600, '约 10 分钟'],
    [125, '约 2 分钟'],
  ])('formatDuration(%s)→%s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text)
  })

  it('学习记录按 course_id 合并到课程视图，无记录标记 null', () => {
    const views = [toElderCourseView(dto), toElderCourseView({ ...dto, id: 'course-2' })]
    expect(mergeLearningProgress(views, [{ course_id: 'course-1', progress_percent: 60, updated_at: 't' }])).toEqual([
      expect.objectContaining({ id: 'course-1', progressPercent: 60 }),
      expect.objectContaining({ id: 'course-2', progressPercent: null }),
    ])
    expect(mergeLearningProgress([], [])).toEqual([])
  })

  it('大纲按行拆分并丢弃空行', () => {
    expect(parseOutline(validDraft.outlineText)).toEqual(['认识诈骗', '挂断电话'])
    expect(parseOutline('')).toEqual([])
  })

  it('合法表单生成创建请求体；上传后的 video_id 一并携带', () => {
    expect(toCreateCoursePayload(validDraft)).toEqual({
      title: '防诈骗第一课',
      category: '安全防护',
      description: '守住钱袋子',
      duration_seconds: 300,
      outline: ['认识诈骗', '挂断电话'],
    })
    expect(toCreateCoursePayload(validDraft, 'v1').video_id).toBe('v1')
    expect(toCreateCoursePayload(validDraft).video_id).toBeUndefined()
  })

  it.each([
    [{ ...validDraft, title: '   ' }, '请先填写课程标题'],
    [{ ...validDraft, title: '长'.repeat(51) }, '课程标题不能超过 50 字'],
    [{ ...validDraft, category: '' }, '请先选择课程分类'],
    [{ ...validDraft, description: '' }, '请先填写课程简介'],
    [{ ...validDraft, description: '长'.repeat(201) }, '课程简介不能超过 200 字'],
    [{ ...validDraft, outlineText: '  \n ' }, '请至少填写一条课程大纲'],
    [{ ...validDraft, outlineText: Array.from({ length: 21 }, (_, i) => `第${i}条`).join('\n') }, '课程大纲不能超过 20 条'],
    [{ ...validDraft, durationSeconds: '' }, '视频时长须为不小于 0 的整数秒'],
    [{ ...validDraft, durationSeconds: '3.5' }, '视频时长须为不小于 0 的整数秒'],
    [{ ...validDraft, durationSeconds: '-1' }, '视频时长须为不小于 0 的整数秒'],
  ])('本地校验与后端契约同规则：%s', (draft, message) => {
    expect(() => toCreateCoursePayload(draft)).toThrow(new CourseFormError(message).message)
  })

  it('视频预检：仅 .mp4、≤200MB', () => {
    expect(() => assertVideoFile('课程.mov', 1)).toThrow('仅支持 .mp4 视频文件')
    expect(() => assertVideoFile('课程.MP4', 1)).not.toThrow()
    expect(() => assertVideoFile('课程.mp4', 200 * 1024 * 1024 + 1)).toThrow('视频超出 200MB 上限')
    expect(() => assertVideoFile('课程.mp4', 200 * 1024 * 1024)).not.toThrow()
  })
})
