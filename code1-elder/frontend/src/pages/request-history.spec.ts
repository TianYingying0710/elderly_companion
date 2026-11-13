// sosProvider 在模块加载时就固定了 VITE_ELDER_API_BASE_URL，因此必须在导入 App 之前写入，
// 否则 App 级测试只能看到默认的 127.0.0.1:8001 基址。
vi.hoisted(() => { vi.stubEnv('VITE_ELDER_API_BASE_URL', 'http://mock-api') })
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../App.vue'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const realEvent = {
  id: 'sos-42', elder_id: 'elder-001', created_at: '2026-11-13T02:03:00Z',
  status: 'processing', note: '家人已联系',
}

async function openRequests() {
  const wrapper = mount(App)
  await wrapper.get('[data-testid="nav-me"]').trigger('click')
  await wrapper.get('[data-testid="requests"]').trigger('click')
  await flushPromises()
  return wrapper
}

it('api 模式展示真实求助记录、状态与备注', async () => {
  vi.stubEnv('VITE_SOS_DATA_MODE', 'api')
  vi.stubEnv('VITE_ELDER_API_BASE_URL', 'http://mock-api')
  const fetchMock = vi.fn(async () => new Response(JSON.stringify([realEvent]), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)

  const wrapper = await openRequests()

  expect(fetchMock).toHaveBeenCalledWith('http://mock-api/api/v1/sos-events?elder_id=elder-001')
  expect(wrapper.text()).toContain('软件 SOS 求助')
  expect(wrapper.text()).toContain('处理中 · 家人/社区已介入')
  expect(wrapper.text()).toContain('11-13 10:03')
  expect(wrapper.text()).toContain('家人已联系')
  wrapper.unmount()
})

it('api 模式没有记录时显示空态', async () => {
  vi.stubEnv('VITE_SOS_DATA_MODE', 'api')
  vi.stubEnv('VITE_ELDER_API_BASE_URL', 'http://mock-api')
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })))

  const wrapper = await openRequests()

  expect(wrapper.text()).toContain('暂无求助记录')
  wrapper.unmount()
})

it('api 模式加载失败时提示失败而非空态', async () => {
  vi.stubEnv('VITE_SOS_DATA_MODE', 'api')
  vi.stubEnv('VITE_ELDER_API_BASE_URL', 'http://mock-api')
  vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })))

  const wrapper = await openRequests()

  expect(wrapper.text()).toContain('求助记录加载失败，请稍后重试')
  expect(wrapper.text()).toContain('求助记录加载失败（HTTP 503）')
  expect(wrapper.text()).not.toContain('暂无求助记录')
  wrapper.unmount()
})

it('mock 模式保持演示记录且不发起请求', async () => {
  const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
  vi.stubGlobal('fetch', fetchMock)

  const wrapper = await openRequests()

  expect(wrapper.text()).toContain('模拟记录，无真实通知或人员响应')
  expect(wrapper.text()).toContain('· 模拟')
  expect(fetchMock).not.toHaveBeenCalled()
  wrapper.unmount()
})
