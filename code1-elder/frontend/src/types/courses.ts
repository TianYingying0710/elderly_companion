/** 助老课程契约 DTO：与 code1-elder 后端 schemas/courses.py 对齐（snake_case）。 */

export interface CourseSummaryDto {
  id: string
  title: string
  category: string
  description: string
  duration_seconds: number
  /** null 表示课程尚未上传视频 */
  video_url: string | null
}

export interface CourseDetailDto extends CourseSummaryDto {
  outline: string[]
}
