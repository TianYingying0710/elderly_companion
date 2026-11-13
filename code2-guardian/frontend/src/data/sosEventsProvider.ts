// SOS 事件 Provider：消息中心与详情页只依赖此接口（低耦合原则 3）。
// mock 模式返回空列表，消息中心维持现状（演示 SOS 消息已在 mock messages 中），
// 无真实事件可处置；api 模式直查 code1-elder 后端，把真实事件合并进消息列表，
// 并把处置动作转发给后端（状态机唯一真源在 code1，消费端不自持状态）。

import { getSosEvents, patchSosEvent } from '../api/sosEvents'
import { toSosMessageItem } from '../mappers/sosEventMapper'
import type { MessageItem } from '../types'
import type { SosEventDto, SosEventStatus } from '../types/sosEvents'

/** 与监护人端健康契约一致的演示老人标识；账号体系（P5）落地后替换 */
export const DEMO_ELDER_ID = 'elder-001'

export type SosEventsMode = 'mock' | 'api'

export interface SosEventsProvider {
  readonly mode: SosEventsMode
  /** 按老人标识拉取求助事件（后端已按时间倒序） */
  list(): Promise<MessageItem[]>
  /** 按 SOS 事件 id 查单条映射结果；不存在返回 null */
  findById(id: string): Promise<MessageItem | null>
  /** 按 id 查原始事件（详情页状态与处置用）；不存在返回 null */
  findEvent(id: string): Promise<SosEventDto | null>
  /** 处置：推进状态（可带备注），返回后端最新事件 */
  transition(id: string, to: SosEventStatus, note?: string): Promise<SosEventDto>
}

export class MockSosEventsProvider implements SosEventsProvider {
  readonly mode: SosEventsMode = 'mock'

  async list(): Promise<MessageItem[]> {
    return []
  }

  async findById(_id: string): Promise<MessageItem | null> {
    return null
  }

  async findEvent(_id: string): Promise<SosEventDto | null> {
    return null
  }

  async transition(_id: string, _to: SosEventStatus, _note?: string): Promise<SosEventDto> {
    throw new Error('演示模式没有真实求助事件')
  }
}

export class ApiSosEventsProvider implements SosEventsProvider {
  readonly mode: SosEventsMode = 'api'

  constructor(
    private readonly fetchEvents: (elderId: string) => Promise<SosEventDto[]> = getSosEvents,
    private readonly patchEvent: (
      id: string,
      to: SosEventStatus,
      note?: string,
    ) => Promise<SosEventDto> = patchSosEvent,
  ) {}

  async list(): Promise<MessageItem[]> {
    const events = await this.fetchEvents(DEMO_ELDER_ID)
    return events.map(toSosMessageItem)
  }

  async findById(id: string): Promise<MessageItem | null> {
    const event = await this.findEvent(id)
    return event === null ? null : toSosMessageItem(event)
  }

  async findEvent(id: string): Promise<SosEventDto | null> {
    const events = await this.fetchEvents(DEMO_ELDER_ID)
    return events.find((event) => event.id === id) ?? null
  }

  async transition(id: string, to: SosEventStatus, note?: string): Promise<SosEventDto> {
    return this.patchEvent(id, to, note)
  }
}

/**
 * 按环境变量选择 Provider：VITE_SOS_DATA_MODE=api 直查 code1 后端，
 * 未设置/mock 维持现状。mode 显式传参便于测试。
 */
export function createSosEventsProvider(
  mode: string | undefined = import.meta.env.VITE_SOS_DATA_MODE,
): SosEventsProvider {
  return mode === 'api' ? new ApiSosEventsProvider() : new MockSosEventsProvider()
}
