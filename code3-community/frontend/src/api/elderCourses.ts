/** 助老课程 HTTP 边界：直查老人端后端（课程单一内容源，低耦合原则 1/2）。只有这里出现路径与方法。 */

import { ApiError, createApiClient, toApiError } from './client'
import type {
  CourseStatus,
  CourseSummaryDto,
  CourseVideoUploadDto,
  CreateCoursePayload,
  LearningRecordDto,
} from '../types/elderCourses'

const elderApiBaseUrl = import.meta.env.VITE_ELDER_API_BASE_URL ?? 'http://127.0.0.1:8001'
const elderApiRequest = createApiClient(elderApiBaseUrl)

type RequestOptions = Omit<UniApp.RequestOptions, 'url' | 'success' | 'fail'>

export type ElderCourseRequest = <T>(path: string, options?: RequestOptions) => Promise<T>

export function parseCourseStatus(raw: unknown): CourseStatus {
  if (raw !== 'published' && raw !== 'unpublished') {
    throw new Error('invalid course status')
  }
  return raw
}

/** 校验课程摘要 DTO，字段集合必须与后端契约一致，多余字段忽略 */
export function parseCourseSummary(raw: unknown): CourseSummaryDto {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('invalid course payload')
  }
  const record = raw as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id.length === 0) throw new Error('invalid course id')
  if (typeof record.title !== 'string' || record.title.length === 0) throw new Error('invalid course title')
  if (typeof record.category !== 'string' || record.category.length === 0) throw new Error('invalid course category')
  if (typeof record.description !== 'string') throw new Error('invalid course description')
  if (typeof record.duration_seconds !== 'number' || !Number.isInteger(record.duration_seconds) || record.duration_seconds < 0) {
    throw new Error('invalid course duration_seconds')
  }
  if (record.video_url !== null && typeof record.video_url !== 'string') {
    throw new Error('invalid course video_url')
  }
  if (typeof record.editable !== 'boolean') throw new Error('invalid course editable')
  return {
    id: record.id,
    title: record.title,
    category: record.category,
    description: record.description,
    duration_seconds: record.duration_seconds,
    video_url: record.video_url,
    status: parseCourseStatus(record.status),
    editable: record.editable,
  }
}

/** 校验视频上传响应 DTO */
export function parseCourseVideoUpload(raw: unknown): CourseVideoUploadDto {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('invalid video upload payload')
  }
  const record = raw as Record<string, unknown>
  if (typeof record.video_id !== 'string' || record.video_id.length === 0) {
    throw new Error('invalid video_id')
  }
  if (typeof record.video_url !== 'string' || record.video_url.length === 0) {
    throw new Error('invalid video_url')
  }
  return { video_id: record.video_id, video_url: record.video_url }
}

export interface CourseListOptions {
  includeUnpublished?: boolean
}

/** GET /api/v1/courses；管理页传 includeUnpublished 以看到已下架课程 */
export function getElderCourses(
  request: ElderCourseRequest = elderApiRequest,
  options: CourseListOptions = {},
): Promise<CourseSummaryDto[]> {
  const path = options.includeUnpublished
    ? '/api/v1/courses?include_unpublished=true'
    : '/api/v1/courses'
  return request<CourseSummaryDto[]>(path, { method: 'GET' }).then((raw: unknown) => {
    if (!Array.isArray(raw)) throw new Error('invalid courses payload')
    return raw.map(parseCourseSummary)
  })
}

/** POST /api/v1/courses/{id}/publication：微信端不支持 PATCH，使用 POST 子资源 */
export function updateCoursePublication(
  courseId: string,
  status: CourseStatus,
  request: ElderCourseRequest = elderApiRequest,
): Promise<CourseSummaryDto> {
  return request<CourseSummaryDto>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/publication`,
    {
      method: 'POST',
      data: { status },
      header: { 'Content-Type': 'application/json' },
    },
  ).then(parseCourseSummary)
}

export function parseLearningRecord(raw: unknown): LearningRecordDto {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('invalid learning record payload')
  }
  const record = raw as Record<string, unknown>
  if (typeof record.course_id !== 'string' || record.course_id.length === 0) {
    throw new Error('invalid learning record course_id')
  }
  if (
    typeof record.progress_percent !== 'number' ||
    !Number.isInteger(record.progress_percent) ||
    record.progress_percent < 0 ||
    record.progress_percent > 100
  ) {
    throw new Error('invalid learning record progress_percent')
  }
  if (typeof record.updated_at !== 'string' || record.updated_at.length === 0) {
    throw new Error('invalid learning record updated_at')
  }
  return {
    course_id: record.course_id,
    progress_percent: record.progress_percent,
    updated_at: record.updated_at,
  }
}

/** GET /api/v1/learning-records：老人端学习记录（社区端只读展示学员进度） */
export function getLearningRecords(request: ElderCourseRequest = elderApiRequest): Promise<LearningRecordDto[]> {
  return request<LearningRecordDto[]>('/api/v1/learning-records', { method: 'GET' }).then((raw: unknown) => {
    if (!Array.isArray(raw)) throw new Error('invalid learning records payload')
    return raw.map(parseLearningRecord)
  })
}

/** POST /api/v1/courses：创建课程（body 携带可选 video_id） */
export function createElderCourse(
  payload: CreateCoursePayload,
  request: ElderCourseRequest = elderApiRequest,
): Promise<CourseSummaryDto> {
  return request<CourseSummaryDto>('/api/v1/courses', {
    method: 'POST',
    data: payload,
    header: { 'Content-Type': 'application/json' },
  }).then(parseCourseSummary)
}

/** uni.uploadFile 的最小结构（便于测试注入） */
export interface UploadTaskLike {
  onProgressUpdate?: (callback: (progress: { progress: number }) => void) => void
}

export type VideoUploader = (options: {
  url: string
  filePath: string
  name: string
  success: (result: { statusCode: number; data: string | Record<string, unknown> }) => void
  fail: (error: { errMsg: string }) => void
}) => UploadTaskLike | null

/** POST /api/v1/course-videos：上传 mp4 视频（multipart），onProgress 回调 0-100 整数进度 */
export function uploadCourseVideo(
  filePath: string,
  onProgress?: (percent: number) => void,
  upload: VideoUploader = uni.uploadFile as unknown as VideoUploader,
): Promise<CourseVideoUploadDto> {
  return new Promise((resolve, reject) => {
    const task = upload({
      url: `${elderApiBaseUrl}/api/v1/course-videos`,
      filePath,
      name: 'file',
      success(response) {
        let data: unknown = response.data
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data)
          } catch {
            data = null
          }
        }
        if (response.statusCode === 201) {
          try {
            resolve(parseCourseVideoUpload(data))
          } catch (error) {
            reject(error instanceof Error ? error : new Error('invalid video upload payload'))
          }
          return
        }
        // 非 2xx（如非 mp4 / 超 200MB 的 422 validation_failed）按统一错误契约抛出
        reject(toApiError(response.statusCode, data))
      },
      fail(error) {
        reject(new ApiError(0, 'network', error.errMsg))
      },
    })
    task?.onProgressUpdate?.((progress) => onProgress?.(Math.round(progress.progress)))
  })
}
