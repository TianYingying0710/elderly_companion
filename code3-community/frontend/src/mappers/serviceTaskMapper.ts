/** DTO ↔ ViewModel 显式映射。纯函数，不发请求、不依赖 Vue。 */

import type {
  ServiceTask,
  ServiceTaskCreatePayload,
  ServiceTaskDraft,
  ServiceTaskDto,
  ServiceTaskStatus,
} from '../types/serviceTask'

const SHANGHAI_OFFSET_MINUTES = 8 * 60
const ISO_WITH_TIMEZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_ONLY = /^(\d{2}):(\d{2})$/

const STATUSES: ServiceTaskStatus[] = ['pending', 'in_service', 'completed']

/** 与后端 `schemas/service.py` 的字段上限保持一致；前端校验只用于提前报错，后端仍独立校验。 */
export const SERVICE_TEXT_LIMITS = {
  title: 100,
  elderName: 100,
  category: 100,
  location: 200,
  description: 2000,
} as const

export class ServiceTaskMappingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ServiceTaskMappingError'
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function isStatus(value: string): value is ServiceTaskStatus {
  return (STATUSES as string[]).includes(value)
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ServiceTaskMappingError(`服务任务字段缺失或为空：${field}`)
  }
  return value
}

/** 去掉首尾空格后按码点计数，与后端 `max_length` 语义一致。 */
function requireBoundedText(value: unknown, field: string, maxLength: number): string {
  const text = requireText(value, field).trim()
  if (Array.from(text).length > maxLength) {
    throw new ServiceTaskMappingError(`${field} 超过上限：最多 ${maxLength} 个字符`)
  }
  return text
}

/** ISO 8601（必须带时区）→ 固定 +08:00 的 `MM-DD HH:mm`。 */
export function formatScheduled(iso: string): string {
  if (typeof iso !== 'string' || !ISO_WITH_TIMEZONE.test(iso)) {
    throw new ServiceTaskMappingError(`服务时间缺少时区：${String(iso)}`)
  }
  const time = Date.parse(iso)
  if (Number.isNaN(time)) {
    throw new ServiceTaskMappingError(`服务时间无法解析：${iso}`)
  }
  const shifted = new Date(time + SHANGHAI_OFFSET_MINUTES * 60 * 1000)
  return `${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ${pad(
    shifted.getUTCHours(),
  )}:${pad(shifted.getUTCMinutes())}`
}

export function toServiceTask(dto: ServiceTaskDto): ServiceTask {
  if (!dto || typeof dto !== 'object') {
    throw new ServiceTaskMappingError('服务任务 DTO 不是对象')
  }
  const status = requireText(dto.status, 'status')
  if (!isStatus(status)) {
    throw new ServiceTaskMappingError(`未知服务任务状态：${status}`)
  }
  const note = dto.note ?? null
  if (note !== null && typeof note !== 'string') {
    throw new ServiceTaskMappingError('服务记录类型非法')
  }
  const scheduledAt = requireText(dto.scheduled_at, 'scheduled_at')

  return {
    id: requireText(dto.id, 'id'),
    title: requireText(dto.title, 'title'),
    elderName: requireText(dto.elder_name, 'elder_name'),
    category: requireText(dto.category, 'category'),
    scheduledAt,
    scheduledText: formatScheduled(scheduledAt),
    location: requireText(dto.location, 'location'),
    description: requireText(dto.description, 'description'),
    status,
    record: note,
  }
}

/** 列表映射：非数组直接报错，不静默返回空数组。 */
export function toServiceTaskList(raw: unknown): ServiceTask[] {
  if (!Array.isArray(raw)) {
    throw new ServiceTaskMappingError('服务任务列表不是数组')
  }
  return raw.map((item) => toServiceTask(item as ServiceTaskDto))
}

/** 表单草稿 → 创建请求体。日期与时间按 +08:00 拼成 ISO 8601。 */
export function toCreatePayload(draft: ServiceTaskDraft): ServiceTaskCreatePayload {
  const date = DATE_ONLY.exec(draft.scheduledDate ?? '')
  const time = TIME_ONLY.exec(draft.scheduledTime ?? '')
  if (!date || !time) {
    throw new ServiceTaskMappingError('请选择完整的服务日期与时间')
  }
  const [year, month, day] = [Number(date[1]), Number(date[2]), Number(date[3])]
  const [hour, minute] = [Number(time[1]), Number(time[2])]
  if (hour > 23 || minute > 59) {
    throw new ServiceTaskMappingError('服务时间不合法')
  }
  const asUtc = new Date(Date.UTC(year, month - 1, day))
  if (asUtc.getUTCFullYear() !== year || asUtc.getUTCMonth() !== month - 1 || asUtc.getUTCDate() !== day) {
    throw new ServiceTaskMappingError('服务日期不合法')
  }

  return {
    title: requireBoundedText(draft.title, 'title', SERVICE_TEXT_LIMITS.title),
    elder_name: requireBoundedText(draft.elderName, 'elderName', SERVICE_TEXT_LIMITS.elderName),
    category: requireBoundedText(draft.category, 'category', SERVICE_TEXT_LIMITS.category),
    scheduled_at: `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+08:00`,
    location: requireBoundedText(draft.location, 'location', SERVICE_TEXT_LIMITS.location),
    description: requireBoundedText(
      draft.description,
      'description',
      SERVICE_TEXT_LIMITS.description,
    ),
  }
}
