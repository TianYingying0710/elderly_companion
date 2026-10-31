/** 社区端领域类型。字段语义与原型 `shequ-temp/index.html` 保持一致。 */

export type RescueStatus = '待响应' | '已赶往现场' | '已到达' | '已完成处理'

/** 求助来源大类。硬件按钮无法携带原因，只能标记为硬件求助。 */
export type RescueSource = '硬件求助 · 实体 SOS 按钮' | '软件求助 · 老人端一键求助'

/** 监护人（家庭协同）在当前事件中的推进情况。 */
export interface GuardianProgress {
  name: string
  /** 已完成的最后一步下标：0 已通知 / 1 已查看 / 2 已联系老人 */
  stage: 0 | 1 | 2
  times: string[]
  feedback: string
  otherCount: number
}

export interface RescueIncident {
  /** 事件编号，同时作为列表 key */
  id: string
  name: string
  type: '紧急求助'
  /** 仅软件求助携带；硬件求助为空字符串 */
  reason: string
  location: string
  time: string
  source: RescueSource
  status: RescueStatus
  /** 与 RESCUE_FLOW 下标对齐的步骤时间戳 */
  stepTimes: string[]
  result?: string
  guardian: GuardianProgress
}

export type ServiceStatus = '待接收' | '服务中' | '已完成'

export interface ServiceTask {
  id: string
  title: string
  name: string
  type: string
  time: string
  location: string
  description: string
  status: ServiceStatus
}

export type KnowledgeStatus = '待确认' | '已启用' | '已停用'

export interface KnowledgeDoc {
  id: string
  name: string
  content: string
  status: KnowledgeStatus
}

export type CourseStatus = '已发布' | '草稿' | '已下架'

export interface Course {
  id: string
  title: string
  category: string
  format: string
  duration: string
  note: string
  status: CourseStatus
}
