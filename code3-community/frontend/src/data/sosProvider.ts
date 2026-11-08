// SOS 事件 provider：mock/api 工厂（低耦合原则 2/3，默认 mock 行为不变）
import type { SosEventView } from '../types/sosEvents'
import { getSosEvents, type getSosEvents as GetSosEvents } from '../api/sosEvents'
import { mapSosEvent } from '../mappers/sosEventMapper'

export type SosDataSourceMode = 'mock' | 'api'

export interface SosEventProvider {
  mode: SosDataSourceMode
  list: () => Promise<SosEventView[]>
}

/** 演示数据：与救援处置页原有演示口径一致（虚构，非真实报警） */
function mockSosEvents(): SosEventView[] {
  return [
    {
      id: 'demo-sos-1',
      elderId: 'elder-001',
      time: '2026-11-08 09:12:00',
      statusLabel: '待响应',
      statusKind: 'red',
      note: '演示数据：老人在家触发软件 SOS，无进一步说明',
    },
    {
      id: 'demo-sos-2',
      elderId: 'elder-001',
      time: '2026-11-07 15:40:00',
      statusLabel: '处理中',
      statusKind: 'blue',
      note: '演示数据：社区工作人员已上门',
    },
    {
      id: 'demo-sos-3',
      elderId: 'elder-001',
      time: '2026-11-06 11:05:00',
      statusLabel: '已完成处理',
      statusKind: 'green',
      note: '演示数据：已联系家属并确认平安',
    },
  ]
}

export function createMockSosProvider(): SosEventProvider {
  return { mode: 'mock', list: async () => mockSosEvents() }
}

export function createApiSosProvider(
  fetchEvents: typeof GetSosEvents = getSosEvents,
  elderId = 'elder-001',
): SosEventProvider {
  return {
    mode: 'api',
    list: async () => {
      const dtos = await fetchEvents(elderId)
      return dtos.map(mapSosEvent).sort((a, b) => (a.time < b.time ? 1 : -1))
    },
  }
}

export function createSosProvider(mode: SosDataSourceMode = (import.meta.env.VITE_SOS_DATA_MODE as SosDataSourceMode) ?? 'mock'): SosEventProvider {
  return mode === 'api' ? createApiSosProvider() : createMockSosProvider()
}
