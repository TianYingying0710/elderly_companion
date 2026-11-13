/** 助老课程（老人端后端 code1 单一内容源）的传输类型与页面 ViewModel。两套类型不混用。 */

/** 后端返回的课程摘要 DTO：snake_case；`video_url` 为 null 表示尚未上传视频 */
export interface CourseSummaryDto {
  id: string
  title: string
  category: string
  description: string
  duration_seconds: number
  video_url: string | null
}

/** 上传视频成功后的 DTO：先拿 video_id，再随创建课程请求提交 */
export interface CourseVideoUploadDto {
  video_id: string
  video_url: string
}

/** 创建课程请求体：`video_id` 可选（未上传视频的课程）；校验在后端，前端做同规则预检 */
export interface CreateCoursePayload {
  title: string
  category: string
  description: string
  duration_seconds: number
  outline: string[]
  video_id?: string
}

/** api 模式新建课程的表单草稿（未校验） */
export interface CourseFormDraft {
  title: string
  category: string
  description: string
  /** 大纲原文：每行一条 */
  outlineText: string
  /** 表单输入的时长（秒），字符串以便空态判断 */
  durationSeconds: string
  /** 已选择的本地视频临时路径；空串表示不上传视频 */
  videoPath: string
  videoName: string
  videoSize: number
}

/** 页面 ViewModel：api 模式课程列表项 */
export interface ElderCourseView {
  id: string
  title: string
  category: string
  description: string
  /** 展示用时长文案（如「约 10 分钟」） */
  durationText: string
  /** 是否已关联视频 */
  hasVideo: boolean
}
