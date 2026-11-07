import { describe, expect, it, vi } from 'vitest'

import {
  ApiSosEventsProvider,
  DEMO_ELDER_ID,
  MockSosEventsProvider,
  createSosEventsProvider,
} from './sosEventsProvider'

const CONTRACT_EVENTS = [
  {
    id: '0123456789abcdef0123456789abcdef',
    elder_id: DEMO_ELDER_ID,
    created_at: '2026-11-08T02:30:00.000000+00:00',
    status: 'pending',
    note: '客厅需要帮助',
  },
  {
    id: 'ffffffffffffffffffffffffffffffff',
    elder_id: DEMO_ELDER_ID,
    created_at: '2026-11-08T03:10:00.000000+00:00',
    status: 'resolved',
    note: null,
  },
]

describe('sos events provider factory', () => {
  it('creates the api provider when mode is api', () => {
    expect(createSosEventsProvider('api')).toBeInstanceOf(ApiSosEventsProvider)
  })

  it('creates the mock provider by default and for unknown modes', () => {
    expect(createSosEventsProvider(undefined)).toBeInstanceOf(MockSosEventsProvider)
    expect(createSosEventsProvider('mock')).toBeInstanceOf(MockSosEventsProvider)
    expect(createSosEventsProvider('anything-else')).toBeInstanceOf(MockSosEventsProvider)
  })
})

describe('mock provider', () => {
  it('keeps the messages page as-is: empty list and no lookup hits', async () => {
    const provider = new MockSosEventsProvider()

    await expect(provider.list()).resolves.toEqual([])
    await expect(provider.findById('0123456789abcdef0123456789abcdef')).resolves.toBeNull()
  })
})

describe('api provider', () => {
  it('lists contract events mapped to rescue messages', async () => {
    const fetchEvents = vi.fn().mockResolvedValue(CONTRACT_EVENTS)

    const items = await new ApiSosEventsProvider(fetchEvents).list()

    expect(fetchEvents).toHaveBeenCalledWith(DEMO_ELDER_ID)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ id: CONTRACT_EVENTS[0].id, category: '求助消息' })
    expect(items[1]).toMatchObject({ id: CONTRACT_EVENTS[1].id, summary: '老人发起SOS求助，已处理完成。' })
  })

  it('finds a single event by id and returns null for unknown ids', async () => {
    const fetchEvents = vi.fn().mockResolvedValue(CONTRACT_EVENTS)
    const provider = new ApiSosEventsProvider(fetchEvents)

    await expect(provider.findById(CONTRACT_EVENTS[1].id)).resolves.toMatchObject({
      id: CONTRACT_EVENTS[1].id,
    })
    await expect(provider.findById('00000000000000000000000000000000')).resolves.toBeNull()
  })

  it('propagates failures so the page can degrade to demo messages with a toast', async () => {
    const fetchEvents = vi.fn().mockRejectedValue(new Error('network down'))

    await expect(new ApiSosEventsProvider(fetchEvents).list()).rejects.toThrow('network down')
  })
})
