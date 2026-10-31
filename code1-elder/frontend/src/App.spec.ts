import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'
import { apiBaseUrl } from './api/client'

describe('elder frontend', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('identifies the elder app and reports a healthy backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', service: 'elder-backend' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(App)

    await wrapper.get('[data-testid="nav-me"]').trigger('click')
    await wrapper.get('[data-testid="settings"]').trigger('click')
    await wrapper.get('[data-testid="check-health"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="health-status"]').text()).toContain('后端连接正常')
    expect(fetchMock).toHaveBeenCalledWith(`${apiBaseUrl}/health`, undefined)
  })

  it('shows a clear message when the backend is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const wrapper = mount(App)
    await wrapper.get('[data-testid="nav-me"]').trigger('click')
    await wrapper.get('[data-testid="settings"]').trigger('click')
    await wrapper.get('[data-testid="check-health"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="health-status"]').text()).toContain('暂时无法连接后端')
  })
})
