// SOS 事件 Provider：消息中心只依赖此接口（低耦合原则 3）。
// mock 模式返回空列表，消息中心维持现状（演示 SOS 消息已在 mock messages 中）；
// api 模式直查 code1-elder 后端，把真实事件合并进消息列表。
// 消费端只读展示状态，不实现状态流转（低耦合原则 4）。

import { getSosEvents } from '../api/sosEvents'
import { toSosMessageItem } from '../mappers/sosEventMapper'
import type { MessageItem } from '../types'
import type { SosEventDto } from '../types/sosEvents'

/** 与监护人端健康契约一致的演示老人标识；账号体系（P5）落地后替换 */
export const DEMO_ELDER_ID = 'elder-001'

export interface SosEventsProvider {
  /** 按老人标识拉取求助事件（后端已按时间倒序） */
  list(): Promise<MessageItem[]>
  /** 按 SOS 事件 id 查单条映射结果；不存在返回 null */
  findById(id: string): Promise<MessageItem | null>
}

export class MockSosEventsProvider implements SosEventsProvider {
  async list(): Promise<MessageItem[]> {
    return []
  }

  async findById(_id: string): Promise<MessageItem | null> {
    return null
  }
}

export class ApiSosEventsProvider implements SosEventsProvider {
  constructor(
    private readonly fetchEvents: (elderId: string) => Promise<SosEventDto[]> = getSosEvents,
  ) {}

  async list(): Promise<MessageItem[]> {
    const events = await this.fetchEvents(DEMO_ELDER_ID)
    return events.map(toSosMessageItem)
  }

  async findById(id: string): Promise<MessageItem | null> {
    const events = await this.fetchEvents(DEMO_ELDER_ID)
    const found = events.find((event) => event.id === id) ?? null
    return found === null ? null : toSosMessageItem(found)
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
