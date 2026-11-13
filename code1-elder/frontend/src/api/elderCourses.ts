/** 助老课程 HTTP 边界：直查课程单一内容源（code1 GET /api/v1/courses*）。只有这里出现路径与 URL。 */

import type { CourseDetailDto, CourseSummaryDto } from '../types/courses'

export const elderApiBaseUrl = import.meta.env.VITE_ELDER_API_BASE_URL ?? 'http://127.0.0.1:8001'

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export function parseCourseSummary(raw: unknown): CourseSummaryDto {
  if (typeof raw !== 'object' || raw === null) throw new Error('invalid course payload')
  const record = raw as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id.length === 0) throw new Error('invalid course id')
  if (typeof record.title !== 'string' || record.title.length === 0) throw new Error('invalid course title')
  if (typeof record.category !== 'string' || record.category.length === 0) throw new Error('invalid course category')
  if (typeof record.description !== 'string') throw new Error('invalid course description')
  if (typeof record.duration_seconds !== 'number' || !Number.isInteger(record.duration_seconds) || record.duration_seconds < 0) {
    throw new Error('invalid course duration_seconds')
  }
  if (record.video_url !== null && typeof record.video_url !== 'string') throw new Error('invalid course video_url')
  return {
    id: record.id,
    title: record.title,
    category: record.category,
    description: record.description,
    duration_seconds: record.duration_seconds,
    video_url: record.video_url,
  }
}

export function parseCourseDetail(raw: unknown): CourseDetailDto {
  const summary = parseCourseSummary(raw)
  const record = raw as Record<string, unknown>
  if (!Array.isArray(record.outline) || record.outline.some((item) => typeof item !== 'string')) {
    throw new Error('invalid course outline')
  }
  return { ...summary, outline: record.outline as string[] }
}

async function getJson<T>(path: string, parse: (raw: unknown) => T, fetchFn: FetchLike, baseUrl: string): Promise<T> {
  const response = await fetchFn(`${baseUrl}${path}`)
  if (!response.ok) throw new Error(`课程服务请求失败（HTTP ${response.status}）`)
  return parse(await response.json())
}

/** GET /api/v1/courses：课程目录（后端预置演示课程 + 社区端发布课程） */
export function getCourses(fetchFn: FetchLike = fetch, baseUrl = elderApiBaseUrl): Promise<CourseSummaryDto[]> {
  return getJson('/api/v1/courses', (raw) => {
    if (!Array.isArray(raw)) throw new Error('invalid courses payload')
    return raw.map(parseCourseSummary)
  }, fetchFn, baseUrl)
}

/** GET /api/v1/courses/{id}：课程详情（含大纲） */
export function getCourseDetail(courseId: string, fetchFn: FetchLike = fetch, baseUrl = elderApiBaseUrl): Promise<CourseDetailDto> {
  return getJson(`/api/v1/courses/${encodeURIComponent(courseId)}`, parseCourseDetail, fetchFn, baseUrl)
}

/** 把后端相对 video_url 拼成可播放的绝对地址 */
export function resolveVideoUrl(videoUrl: string, baseUrl = elderApiBaseUrl): string {
  return `${baseUrl.replace(/\/$/, '')}${videoUrl}`
}
