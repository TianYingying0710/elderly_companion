// SOS 事件 mapper：DTO → 视图（中文状态标签只渲染不流转）
import type { SosEventDto, SosEventStatusKind, SosEventView } from '../types/sosEvents'

const STATUS_LABELS: Record<string, { label: string; kind: SosEventStatusKind }> = {
  pending: { label: '待响应', kind: 'red' },
  processing: { label: '处理中', kind: 'blue' },
  resolved: { label: '已完成处理', kind: 'green' },
}

export function mapSosEventStatus(status: string): { label: string; kind: SosEventStatusKind } {
  return STATUS_LABELS[status] ?? { label: '未知状态', kind: 'blue' }
}

export function mapSosEvent(dto: SosEventDto): SosEventView {
  const status = mapSosEventStatus(dto.status)
  return {
    id: dto.id,
    elderId: dto.elder_id,
    time: dto.created_at.replace('T', ' ').slice(0, 19),
    status: dto.status,
    statusLabel: status.label,
    statusKind: status.kind,
    note: dto.note ?? '',
  }
}
