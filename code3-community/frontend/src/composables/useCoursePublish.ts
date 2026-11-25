/** api 模式课程发布编排：校验表单→（可选）上传视频拿 video_id→创建课程→刷新目录。 */

import { ref, type Ref } from 'vue'

import { ApiError } from '../api/client'
import {
  createElderCourse,
  getElderCourses,
  getLearningRecords,
  updateCoursePublication,
  uploadCourseVideo,
} from '../api/elderCourses'
import {
  assertVideoFile,
  mergeLearningProgress,
  toCreateCoursePayload,
  toElderCourseView,
} from '../mappers/courseMapper'
import type {
  CourseStatus,
  CourseSummaryDto,
  CourseVideoUploadDto,
  CourseFormDraft,
  ElderCourseView,
  LearningRecordDto,
} from '../types/elderCourses'

export interface CoursePublishDeps {
  listCourses?: () => Promise<CourseSummaryDto[]>
  listLearningRecords?: () => Promise<LearningRecordDto[]>
  uploadVideo?: (
    filePath: string,
    onProgress?: (percent: number) => void,
  ) => Promise<CourseVideoUploadDto>
  createCourse?: (payload: Parameters<typeof createElderCourse>[0]) => Promise<CourseSummaryDto>
  updatePublication?: (courseId: string, status: CourseStatus) => Promise<CourseSummaryDto>
}

export interface CoursePublishController {
  /** 该编排层固定服务 api 模式（mock 模式页面走原有演示路径） */
  mode: 'api'
  courses: Ref<ElderCourseView[]>
  loading: Ref<boolean>
  loadError: Ref<string>
  publishing: Ref<boolean>
  /** 发布过程中的进度提示（视频上传百分比等），空串表示空闲 */
  progressText: Ref<string>
  /** 发布失败原因，空串表示无错误 */
  publishError: Ref<string>
  /** 正在上下架的课程 id；空串表示空闲 */
  updatingId: Ref<string>
  load: () => Promise<void>
  publish: (draft: CourseFormDraft) => Promise<boolean>
  setPublication: (courseId: string, status: CourseStatus) => Promise<boolean>
}

/** 把统一错误契约（422 validation_failed 等）翻译成用户可读文案 */
export function describeCourseError(error: unknown): string {
  if (error instanceof ApiError) {
    const fieldMessages = error.fields
      .map((field) => field.message)
      .filter((message) => message.length > 0)
    if (fieldMessages.length > 0) return fieldMessages.join('；')
    if (error.message) return error.message
    return `发布失败（HTTP ${error.statusCode}）`
  }
  return error instanceof Error ? error.message : '发布失败：未知错误'
}

export function useCoursePublish(deps: CoursePublishDeps = {}): CoursePublishController {
  const listCourses =
    deps.listCourses ??
    (async () => await getElderCourses(undefined, { includeUnpublished: true }))
  const listLearningRecords = deps.listLearningRecords ?? (async () => await getLearningRecords())
  const uploadVideo =
    deps.uploadVideo ?? (async (filePath, onProgress) => await uploadCourseVideo(filePath, onProgress))
  const createCourse = deps.createCourse ?? (async (payload) => await createElderCourse(payload))
  const updatePublication =
    deps.updatePublication ??
    (async (courseId, status) => await updateCoursePublication(courseId, status))

  const courses = ref<ElderCourseView[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const publishing = ref(false)
  const progressText = ref('')
  const publishError = ref('')
  const updatingId = ref('')

  async function load(): Promise<void> {
    loading.value = true
    loadError.value = ''
    try {
      // 学习记录是只读附加信息：读取失败时课程目录照常展示，仅进度标记为暂无记录
      const [dtos, records] = await Promise.all([
        listCourses(),
        listLearningRecords().catch(() => [] as LearningRecordDto[]),
      ])
      courses.value = mergeLearningProgress(dtos.map(toElderCourseView), records)
    } catch (error) {
      loadError.value = describeCourseError(error)
    } finally {
      loading.value = false
    }
  }

  async function publish(draft: CourseFormDraft): Promise<boolean> {
    if (publishing.value) return false
    publishing.value = true
    publishError.value = ''
    progressText.value = ''
    try {
      let videoId: string | undefined
      if (draft.videoPath) {
        // 客户端预检与后端同规则：非 .mp4 / 超 200MB 直接拦截
        assertVideoFile(draft.videoName, draft.videoSize)
        progressText.value = '视频上传中 0%'
        const upload = await uploadVideo(draft.videoPath, (percent) => {
          progressText.value = `视频上传中 ${percent}%`
        })
        videoId = upload.video_id
        progressText.value = '视频上传完成，正在创建课程'
      }
      const payload = toCreateCoursePayload(draft, videoId)
      await createCourse(payload)
      progressText.value = ''
      await load()
      return true
    } catch (error) {
      progressText.value = ''
      publishError.value = describeCourseError(error)
      return false
    } finally {
      publishing.value = false
    }
  }

  async function setPublication(
    courseId: string,
    status: CourseStatus,
  ): Promise<boolean> {
    if (updatingId.value) return false
    updatingId.value = courseId
    publishError.value = ''
    try {
      await updatePublication(courseId, status)
      await load()
      return true
    } catch (error) {
      publishError.value = describeCourseError(error)
      return false
    } finally {
      updatingId.value = ''
    }
  }

  return {
    mode: 'api',
    courses,
    loading,
    loadError,
    publishing,
    progressText,
    publishError,
    updatingId,
    load,
    publish,
    setPublication,
  }
}
