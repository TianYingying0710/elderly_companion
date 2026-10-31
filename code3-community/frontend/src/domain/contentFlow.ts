import type { CourseStatus, KnowledgeStatus } from '../types/community'

/** 审核通过：仅「待确认」会被启用，其余状态保持不变。 */
export function knowledgeAfterReview(status: KnowledgeStatus): KnowledgeStatus {
  return status === '待确认' ? '已启用' : status
}

/** 停用与重新启用的切换。 */
export function knowledgeAfterToggle(status: KnowledgeStatus): KnowledgeStatus {
  if (status === '已启用') return '已停用'
  if (status === '已停用') return '已启用'
  return status
}

/** 文档卡片副标题。 */
export function knowledgeMeta(status: KnowledgeStatus): string {
  if (status === '已启用') return 'Word 文档 · 已提供给老人端 AI'
  if (status === '已停用') return 'Word 文档 · 当前未提供给老人端 AI'
  return 'Word 文档 · 待审核'
}

export type CourseAction = 'publish' | 'unpublish'

/** 课程发布/下架。已下架再次发布走同一结果。 */
export function courseAfterAction(_status: CourseStatus, action: CourseAction): CourseStatus {
  return action === 'publish' ? '已发布' : '已下架'
}

/** 课程卡片上的发布类按钮文案：已下架显示「重新发布」，其余显示「发布课程」。 */
export function coursePublishLabel(status: CourseStatus): string {
  return status === '已下架' ? '重新发布' : '发布课程'
}
