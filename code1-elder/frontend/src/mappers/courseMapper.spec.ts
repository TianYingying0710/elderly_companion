import { describe, expect, it } from 'vitest'

import { formatDuration, toDomainCourse, toDomainCourseDetail, toProgressPercent } from './courseMapper'
import type { CourseDetailDto } from '../types/courses'

const dto: CourseDetailDto = {
  id: 'course-1',
  title: '智能手机基础操作',
  category: '数字素养',
  description: '从开关机到连 Wi-Fi。',
  duration_seconds: 600,
  video_url: '/api/v1/course-videos/v1',
  outline: ['认识屏幕与按键', '连接无线网络'],
}

describe('elder courseMapper', () => {
  it('DTO→domain：时长转适老文案，video_url 拼绝对地址，配色轮换', () => {
    const course = toDomainCourse(dto, 0, 'http://x:8001')
    expect(course).toMatchObject({
      id: 'course-1',
      duration: '约 10 分钟',
      color: 'blue',
      symbol: '📖',
      progress: 0,
      videoUrl: 'http://x:8001/api/v1/course-videos/v1',
    })
    expect(toDomainCourse(dto, 2, 'http://x').color).toBe('gold')
  })

  it('未上传视频（video_url=null）时 videoUrl 为 null，页面据此显示「本课程暂无视频」', () => {
    expect(toDomainCourse({ ...dto, video_url: null }, 0, 'http://x').videoUrl).toBeNull()
  })

  it('详情映射保留大纲', () => {
    expect(toDomainCourseDetail(dto, 0, 'http://x').outline).toEqual(['认识屏幕与按键', '连接无线网络'])
  })

  it.each([
    [0, '0 秒'],
    [45, '45 秒'],
    [600, '约 10 分钟'],
  ])('formatDuration(%s)→%s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text)
  })

  it.each([
    [0, 100, 0],
    [30, 100, 30],
    [59.9, 100, 59],
    [50, 60, 83],
    [100, 100, 100],
    [120, 100, 100],
    [-1, 100, 0],
    [10, 0, 0],
    [Number.NaN, 100, 0],
  ])('toProgressPercent(%s/%s)→%s', (current, duration, percent) => {
    expect(toProgressPercent(current, duration)).toBe(percent)
  })
})
