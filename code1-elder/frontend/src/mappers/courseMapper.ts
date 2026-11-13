/** 助老课程 mapper：契约 DTO→页面 domain（Course），含时长文案与视频绝对地址。 */

import type { CourseDetailDto, CourseSummaryDto } from '../types/courses'
import type { Course } from '../types/domain'
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
