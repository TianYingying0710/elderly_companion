/** 社区服务任务的传输类型与页面 ViewModel。两套类型不混用。 */

export type ServiceTaskStatus = 'pending' | 'in_service' | 'completed'

/** 后端返回的 DTO：snake_case；`status` 用 string 以便显式校验非法值。 */
export interface ServiceTaskDto {
  id: string
  title: string
  elder_name: string
  category: string
  scheduled_at: string
  location: string
  description: string
  status: string
  note: string | null
}

/** 新建请求体：只含业务字段，`id` / `status` / `note` 由服务端生成。 */
export interface ServiceTaskCreatePayload {
  title: string
  elder_name: string
  category: string
  scheduled_at: string
  location: string
  description: string
}

/** 页面使用的 ViewModel。 */
export interface ServiceTask {
  id: string
  title: string
  elderName: string
  category: string
  /** 原始 ISO 8601，带时区；用于排序与再次提交 */
  scheduledAt: string
  /** 展示用 `MM-DD HH:mm`（固定 +08:00） */
  scheduledText: string
  location: string
  description: string
  status: ServiceTaskStatus
  /** 服务记录，仅 completed 后存在 */
  record: string | null
}

/** 新建表单的输入草稿（未校验、未拼时区）。 */
export interface ServiceTaskDraft {
  title: string
  elderName: string
  category: string
  /** YYYY-MM-DD */
  scheduledDate: string
  /** HH:mm */
  scheduledTime: string
  location: string
  description: string
}
