// SOS 事件 provider：mock/api 工厂（低耦合原则 2/3，默认 mock 行为不变）
// api 模式的读与写都直连 code1-elder 后端，本端不持有第二套状态机。
import type { SosEventStatus, SosEventView } from '../types/sosEvents'
import {
  getSosEvents,
  transitionSosEvent,
  type getSosEvents as GetSosEvents,
  type transitionSosEvent as TransitionSosEvent,
} from '../api/sosEvents'
import { mapSosEvent } from '../mappers/sosEventMapper'

export type SosDataSourceMode = 'mock' | 'api'

export interface SosEventProvider {
  mode: SosDataSourceMode
  list: () => Promise<SosEventView[]>
  /** 推进状态：只转发请求，返回后端最新事件视图；mock 模式不允许伪造推进 */
  transition: (id: string, to: SosEventStatus, note?: string) => Promise<SosEventView>
}

/** 演示数据：与救援处置页原有演示口径一致（虚构，非真实报警） */
function mockSosEvents(): SosEventView[] {
  return [
    {
      id: 'demo-sos-1',
      elderId: 'elder-001',
      time: '2026-11-08 09:12:00',
      status: 'pending',
      statusLabel: '待响应',
      statusKind: 'red',
      note: '演示数据：老人在家触发软件 SOS，无进一步说明',
    },
    {
      id: 'demo-sos-2',
      elderId: 'elder-001',
      time: '2026-11-07 15:40:00',
      status: 'processing',
      statusLabel: '处理中',
      statusKind: 'blue',
      note: '演示数据：社区工作人员已上门',
    },
    {
      id: 'demo-sos-3',
      elderId: 'elder-001',
      time: '2026-11-06 11:05:00',
      status: 'resolved',
      statusLabel: '已完成处理',
      statusKind: 'green',
      note: '演示数据：已联系家属并确认平安',
    },
  ]
}

export function createMockSosProvider(): SosEventProvider {
  return {
    mode: 'mock',
    list: async () => mockSosEvents(),
    transition: async () => {
      throw new Error('演示模式没有真实求助事件，无法推进状态')
    },
  }
}

export function createApiSosProvider(
  fetchEvents: typeof GetSosEvents = getSosEvents,
  elderId = 'elder-001',
  transitionEvent: typeof TransitionSosEvent = transitionSosEvent,
): SosEventProvider {
  return {
    mode: 'api',
    list: async () => {
      const dtos = await fetchEvents(elderId)
      // 后端已按时间倒序；这里再按 created_at 兜底，避免适配层顺序变化打乱列表。
      return [...dtos]
        .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
        .map(mapSosEvent)
    },
    transition: async (id, to, note) => mapSosEvent(await transitionEvent(id, to, note)),
  }
}

export function createSosProvider(mode: SosDataSourceMode = (import.meta.env.VITE_SOS_DATA_MODE as SosDataSourceMode) ?? 'mock'): SosEventProvider {
  return mode === 'api' ? createApiSosProvider() : createMockSosProvider()
}
