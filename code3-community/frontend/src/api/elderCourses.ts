/** 助老课程 HTTP 边界：直查老人端后端（课程单一内容源，低耦合原则 1/2）。只有这里出现路径与方法。 */

import { ApiError, createApiClient, toApiError } from './client'
import type {
  CourseSummaryDto,
  CourseVideoUploadDto,
  CreateCoursePayload,
} from '../types/elderCourses'

const elderApiBaseUrl = import.meta.env.VITE_ELDER_API_BASE_URL ?? 'http://127.0.0.1:8001'
const elderApiRequest = createApiClient(elderApiBaseUrl)

type RequestOptions = Omit<UniApp.RequestOptions, 'url' | 'success' | 'fail'>

export type ElderCourseRequest = <T>(path: string, options?: RequestOptions) => Promise<T>

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
  return {
    id: record.id,
    title: record.title,
    category: record.category,
    description: record.description,
    duration_seconds: record.duration_seconds,
    video_url: record.video_url,
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

/** GET /api/v1/courses：课程目录（含社区端新建与后端预置演示课程） */
export function getElderCourses(request: ElderCourseRequest = elderApiRequest): Promise<CourseSummaryDto[]> {
  return request<CourseSummaryDto[]>('/api/v1/courses', { method: 'GET' }).then((raw: unknown) => {
    if (!Array.isArray(raw)) throw new Error('invalid courses payload')
    return raw.map(parseCourseSummary)
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
