import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../App.vue'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('api 模式展示真实学习记录，并可打开对应课程', async () => {
  vi.stubEnv('VITE_COURSE_DATA_MODE', 'api')
  const course = {
    id: 'course-1', title: '智能手机基础操作', category: '数字素养',
    description: '从开关机到连 Wi-Fi。', duration_seconds: 600, video_url: null,
  }
  const record = { course_id: 'course-1', progress_percent: 40, updated_at: '2026-11-13T02:03:00Z' }
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/api/v1/courses')) return new Response(JSON.stringify([course]), { status: 200 })
    if (url.endsWith('/api/v1/learning-records')) return new Response(JSON.stringify([record]), { status: 200 })
    if (url.endsWith('/api/v1/courses/course-1')) {
      return new Response(JSON.stringify({ ...course, outline: ['认识屏幕与按键'] }), { status: 200 })
    }
    return new Response('no', { status: 404 })
  }))

  const wrapper = mount(App)
  await flushPromises()
  await wrapper.get('[data-testid="nav-learn"]').trigger('click')
  await wrapper.get('[data-testid="learning-history"]').trigger('click')
  await flushPromises()

  expect(wrapper.text()).toContain('智能手机基础操作')
  expect(wrapper.text()).toContain('已学习 40%')
  expect(wrapper.text()).toContain('更新于 11-13 10:03')

  await wrapper.get('[data-testid="course-item"]').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('本课内容')
  wrapper.unmount()
})

it('mock 模式学习记录保持演示内容，且不发起请求', async () => {
  const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
  vi.stubGlobal('fetch', fetchMock)

  const wrapper = mount(App)
  await flushPromises()
  await wrapper.get('[data-testid="nav-learn"]').trigger('click')
  await wrapper.get('[data-testid="learning-history"]').trigger('click')
  await flushPromises()

  expect(wrapper.text()).toContain('以下为模拟学习记录')
  expect(wrapper.text()).toContain('· 模拟')
  expect(fetchMock).not.toHaveBeenCalled()
  wrapper.unmount()
})

it('api 模式学习记录加载失败时提示失败而非空态', async () => {
  vi.stubEnv('VITE_COURSE_DATA_MODE', 'api')
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith('/api/v1/learning-records')) return new Response('nope', { status: 503 })
    if (url.endsWith('/api/v1/courses')) return new Response(JSON.stringify([]), { status: 200 })
    return new Response('no', { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)

  const wrapper = mount(App)
  await flushPromises()
  await wrapper.get('[data-testid="nav-learn"]').trigger('click')
  await wrapper.get('[data-testid="learning-history"]').trigger('click')
  await flushPromises()

  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/learning-records'))
  expect(wrapper.text()).toContain('学习记录加载失败，请稍后重试')
  expect(wrapper.text()).toContain('学习记录加载失败（HTTP 503）')
  expect(wrapper.text()).not.toContain('暂无学习记录')
  wrapper.unmount()
})
