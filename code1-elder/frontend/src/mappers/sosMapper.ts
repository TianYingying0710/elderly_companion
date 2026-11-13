import { sosStatusTitle } from '../domain/sosStatus'
import type { RequestRecord } from '../types/domain'
import type { SosEventDto } from '../types/sos'

/** ISO 时间 → MM-DD HH:mm（东八区）；非法时间返回空串 */
export function formatSosTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: 'month' | 'day' | 'hour' | 'minute') =>
    parts.find((item) => item.type === type)?.value ?? ''
  return `${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`
}

/**
 * 后端事件 → 老人端求助记录。
 * 后端只存创建时间与当前状态，没有逐次处置历史；
 * 因此时间轴只展示创建备注，当前状态由 state 字段单独展示。
 */
export function toRequestRecord(dto: SosEventDto): RequestRecord {
  const time = formatSosTime(dto.created_at)
  return {
    id: dto.id,
    title: '软件 SOS 求助',
    time,
    state: sosStatusTitle(dto.status),
    timeline: [[time, dto.note ?? '事件已上报']],
  }
}

/** 按创建时间倒序；非法时间排到最后；不修改入参 */
export function toRequestRecords(dtos: SosEventDto[]): RequestRecord[] {
  const parsed = (iso: string) => {
    const value = Date.parse(iso)
    return Number.isNaN(value) ? 0 : value
  }
  return [...dtos]
    .sort((a, b) => parsed(b.created_at) - parsed(a.created_at))
    .map(toRequestRecord)
}
