/** 助老课程 mapper：DTO→页面 ViewModel、表单→创建请求体、视频文件预检。 */

import type {
  CourseFormDraft,
  CourseSummaryDto,
  CreateCoursePayload,
  ElderCourseView,
  LearningRecordDto,
} from '../types/elderCourses'

/** 表单本地校验失败（确定性输入问题），文案可直接展示给用户 */
export class CourseFormError extends Error {}

export const MAX_VIDEO_BYTES = 200 * 1024 * 1024 // 与后端 200MB 上限一致

/** 秒数→适老时长文案 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '时长待定'
  if (seconds < 60) return `${seconds} 秒`
  return `约 ${Math.round(seconds / 60)} 分钟`
}

export function toElderCourseView(dto: CourseSummaryDto): ElderCourseView {
  return {
    id: dto.id,
    title: dto.title,
    category: dto.category,
    description: dto.description,
    durationText: formatDuration(dto.duration_seconds),
    hasVideo: dto.video_url !== null && dto.video_url.length > 0,
  }
}

/** 把学习记录按 course_id 合并进课程视图；无记录的课程标记 null */
export function mergeLearningProgress(views: ElderCourseView[], records: LearningRecordDto[]): ElderCourseView[] {
  const progressByCourse = new Map(records.map((record) => [record.course_id, record.progress_percent]))
  return views.map((view) => ({ ...view, progressPercent: progressByCourse.get(view.id) ?? null }))
}

/** 大纲原文按行拆分：去首尾空白、丢弃空行 */
export function parseOutline(outlineText: string): string[] {
  return outlineText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/** 视频文件预检：仅 .mp4、≤200MB（后端同规则，预检只为更快的提示） */
export function assertVideoFile(name: string, size: number): void {
  if (!name.toLowerCase().endsWith('.mp4')) {
    throw new CourseFormError('仅支持 .mp4 视频文件')
  }
  if (size > MAX_VIDEO_BYTES) {
    throw new CourseFormError('视频超出 200MB 上限')
  }
}

/** 表单→创建请求体。本地校验与后端契约同规则；videoId 由上传步骤产生后传入。 */
export function toCreateCoursePayload(draft: CourseFormDraft, videoId?: string): CreateCoursePayload {
  const title = draft.title.trim()
  if (!title) throw new CourseFormError('请先填写课程标题')
  if (title.length > 50) throw new CourseFormError('课程标题不能超过 50 字')
  const category = draft.category.trim()
  if (!category) throw new CourseFormError('请先选择课程分类')
  if (category.length > 20) throw new CourseFormError('课程分类不能超过 20 字')
  const description = draft.description.trim()
  if (!description) throw new CourseFormError('请先填写课程简介')
  if (description.length > 200) throw new CourseFormError('课程简介不能超过 200 字')
  const outline = parseOutline(draft.outlineText)
  if (outline.length === 0) throw new CourseFormError('请至少填写一条课程大纲')
  if (outline.length > 20) throw new CourseFormError('课程大纲不能超过 20 条')
  const durationText = draft.durationSeconds.trim()
  const durationSeconds = durationText === '' ? Number.NaN : Number(durationText)
  if (!Number.isInteger(durationSeconds) || durationSeconds < 0) {
    throw new CourseFormError('视频时长须为不小于 0 的整数秒')
  }
  const payload: CreateCoursePayload = {
    title,
    category,
    description,
    duration_seconds: durationSeconds,
    outline,
  }
  if (videoId) payload.video_id = videoId
  return payload
}
