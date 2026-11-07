// SOS 事件 → 消息中心条目映射：消费端只做展示级转换，不实现状态流转。

import type { SosEventDto } from '../types/sosEvents'
import type { MessageItem } from '../types'

const STATUS_SUMMARY: Record<SosEventDto['status'], string> = {
  pending: '老人发起SOS求助，请及时查看。',
  processing: '老人发起SOS求助，社区已介入处理。',
  resolved: '老人发起SOS求助，已处理完成。',
}

/** ISO 时间 → 'MM-DD HH:mm'；解析失败原样返回 */
export function formatSosTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function toSosMessageItem(dto: SosEventDto): MessageItem {
  return {
    id: dto.id,
    category: '求助消息',
    title: '老人发起SOS求助',
    summary: dto.note ?? STATUS_SUMMARY[dto.status],
    time: formatSosTime(dto.created_at),
  }
}
