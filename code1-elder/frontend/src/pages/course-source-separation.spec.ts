/** 课程来源分离的页面级契约（2026-11-24）：
 * api 模式只显示社区端发布并落库的真实课程；mock 模式只显示前端自带的演示课程。
 * 5 条后端演示课程（智能手机基础操作等）不得出现在 api 模式的页面上。
 */

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../App.vue'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

/** 后端 API 返回的真实课程（与 SQLite 里的记录一致） */
const realCourse = {
  id: 'course-e41d2bc4cd9a',
  title: '怎么使用微信',
  category: '手机基础',
  description: '教老年人使用微信',
  duration_seconds: 0,
  video_url: '/api/v1/course-videos/a4d00ef5bb5d',
  status: 'published',
  outline: ['123'],
}

it('api 模式只列出真实课程，且提示为「课程由社区发布」', async () => {
  vi.stubEnv('VITE_COURSE_DATA_MODE', 'api')
  // 默认进入演示模式，首页「为您推荐」会先渲染本地演示课程；进入教学页前先关掉
  vi.stubEnv('VITE_DEMO_MODE', 'false')
  const fetchFn = vi.fn(async (url: string) => {
    if (url.endsWith('/api/v1/courses')) return new Response(JSON.stringify([realCourse]), { status: 200 })
    if (url.endsWith(`/api/v1/courses/${realCourse.id}`)) return new Response(JSON.stringify(realCourse), { status: 200 })
    return new Response('no', { status: 404 })
  })
  vi.stubGlobal('fetch', fetchFn)

  const wrapper = mount(App)
  await flushPromises()
  await wrapper.get('[data-testid="nav-learn"]').trigger('click')
  await flushPromises()

  const items = wrapper.findAll('[data-testid="course-item"]')
  expect(items).toHaveLength(1)
  expect(items[0]!.text()).toContain('怎么使用微信')

  // 5 条演示课程一个都不能出现
  for (const demo of ['智能手机基础操作', '防电信诈骗指南', '和家人视频通话', '居家健步走', '紧急求助按钮使用']) {
    expect(wrapper.text()).not.toContain(demo)
  }
  // 旧提示「数据存内存、重启即清」必须消失，新提示就位
  expect(wrapper.text()).not.toContain('数据存内存')
  expect(wrapper.text()).not.toContain('重启即清')
  expect(wrapper.text()).toContain('课程由社区发布')
  wrapper.unmount()
})

it('api 模式打开真实课程：播放器拿到后端视频地址', async () => {
  vi.stubEnv('VITE_COURSE_DATA_MODE', 'api')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/api/v1/courses')) return new Response(JSON.stringify([realCourse]), { status: 200 })
    if (url.endsWith(`/api/v1/courses/${realCourse.id}`)) return new Response(JSON.stringify(realCourse), { status: 200 })
    return new Response('no', { status: 404 })
  }))

  const wrapper = mount(App)
  await flushPromises()
  await wrapper.get('[data-testid="nav-learn"]').trigger('click')
  await flushPromises()
  await wrapper.get('[data-testid="course-item"]').trigger('click')
  await flushPromises()

  const video = wrapper.get('video')
  // 后端返回相对 video_url，前端 resolveVideoUrl 拼成绝对地址；只断言路径与视频 id，不绑定具体主机
  expect(video.attributes('src')).toMatch(/^https?:\/\/[^/]+\/api\/v1\/course-videos\/a4d00ef5bb5d$/)
  expect(wrapper.text()).toContain('本课内容')
  wrapper.unmount()
})

it('mock 模式仍显示前端自带的演示课程，且不请求课程接口', async () => {
  vi.stubEnv('VITE_COURSE_DATA_MODE', 'mock')
  const fetchFn = vi.fn(async () => new Response('no', { status: 404 }))
  vi.stubGlobal('fetch', fetchFn)

  const wrapper = mount(App)
  await flushPromises()
  await wrapper.get('[data-testid="nav-learn"]').trigger('click')
  await flushPromises()

  // 演示数据来自 src/demo/data.ts（与后端 5 条不是同一套）
  const items = wrapper.findAll('[data-testid="course-item"]')
  expect(items.length).toBeGreaterThan(0)
  expect(wrapper.text()).toContain('学会用手机叫车')
  expect(wrapper.text()).not.toContain('课程由社区发布')
  expect(fetchFn.mock.calls.every(([url]) => !String(url).includes('/api/v1/courses'))).toBe(true)
  wrapper.unmount()
})
