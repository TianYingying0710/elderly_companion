/** 助老课程 mapper：契约 DTO→页面 domain（Course），含时长文案与视频绝对地址。 */

import type { CourseDetailDto, CourseSummaryDto, LearningRecordDto } from '../types/courses'
import type { Course, LearningHistoryItem } from '../types/domain'
import { resolveVideoUrl } from '../api/elderCourses'

/** 适老化卡片配色/图标轮换（与演示课程一致的三色体系） */
const COLORS = ['blue', 'green', 'gold']
const SYMBOLS = ['📖', '🎓', '💡']

/** 秒数→适老时长文案 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '时长待定'
  if (seconds < 60) return `${seconds} 秒`
  return `约 ${Math.round(seconds / 60)} 分钟`
}

export function toDomainCourse(dto: CourseSummaryDto, index: number, baseUrl?: string): Course {
  return {
    id: dto.id,
    title: dto.title,
    category: dto.category,
    description: dto.description,
    duration: formatDuration(dto.duration_seconds),
    color: COLORS[index % COLORS.length],
    symbol: SYMBOLS[index % SYMBOLS.length],
    progress: 0,
    outline: [],
    videoUrl: dto.video_url ? resolveVideoUrl(dto.video_url, baseUrl) : null,
  }
}

export function toDomainCourseDetail(dto: CourseDetailDto, index: number, baseUrl?: string): Course {
  return { ...toDomainCourse(dto, index, baseUrl), outline: dto.outline }
}

/** 播放位置→0-100 整数进度（非法时长返回 0，越界收敛到 0/100） */
export function toProgressPercent(currentSeconds: number, durationSeconds: number): number {
  if (!Number.isFinite(currentSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0
  return Math.min(100, Math.max(0, Math.floor((currentSeconds / durationSeconds) * 100)))
}

/** 课程目录 + 学习记录 → 历史列表：过滤 0 进度与孤立记录，按更新时间倒序 */
export function toLearningHistory(courses: Course[], records: LearningRecordDto[]): LearningHistoryItem[] {
  const byId = new Map(courses.map((course) => [course.id, course]))
  const time = (iso: string) => {
    const parsed = Date.parse(iso)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return records
    .filter((record) => record.progress_percent > 0)
    .flatMap((record) => {
      const course = byId.get(record.course_id)
      if (course === undefined) return []
      return [{
        course: { ...course, progress: record.progress_percent },
        progressPercent: record.progress_percent,
        updatedAt: record.updated_at,
      }]
    })
    .sort((a, b) => time(b.updatedAt) - time(a.updatedAt))
}

/** ISO 时间 → MM-DD HH:mm（东八区）；非法时间返回空串 */
export function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: 'month' | 'day' | 'hour' | 'minute') =>
    parts.find((item) => item.type === type)?.value ?? ''
  return `${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`
}
