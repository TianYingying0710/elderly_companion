import { describe, expect, it } from 'vitest'
import { createApiSosProvider, createMockSosProvider, createSosProvider } from '../data/sosProvider'
import type { SosEventDto } from '../types/sosEvents'

const dto: SosEventDto = {
  id: 'sos-1',
  elder_id: 'elder-001',
  created_at: '2026-11-08T09:12:00',
  status: 'pending',
  note: null,
}

describe('sosProvider', () => {
  it('mock provider returns demo events marked as demo data', () => {
    const provider = createMockSosProvider()
    expect(provider.mode).toBe('mock')
    return provider.list().then((events) => {
      expect(events.length).toBeGreaterThan(0)
      expect(events.every((event) => event.note.includes('演示数据'))).toBe(true)
    })
  })

  it('api provider maps dtos and sorts newest first', () => {
    const older: SosEventDto = { ...dto, id: 'sos-0', created_at: '2026-11-07T08:00:00' }
    const fetch = () => Promise.resolve([older, dto])
    const provider = createApiSosProvider(fetch)
    expect(provider.mode).toBe('api')
    return provider.list().then((events) => {
      expect(events[0]?.id).toBe('sos-1')
      expect(events[1]?.id).toBe('sos-0')
    })
  })

  it('factory defaults to mock and switches to api via mode argument', () => {
    expect(createSosProvider('mock').mode).toBe('mock')
    expect(createSosProvider('api').mode).toBe('api')
    expect(createSosProvider().mode).toBe('mock')
  })
})
