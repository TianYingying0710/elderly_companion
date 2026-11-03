import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { GUARDIAN_SECONDARY_ROUTES } from './routes'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

interface PageEntry {
  path: string
  style?: { navigationBarTitleText?: string }
}

const pages = JSON.parse(source('../pages.json')) as {
  pages: PageEntry[]
  tabBar: { list: Array<{ pagePath: string; text: string }> }
}

const SECONDARY_PATHS = [
  'pages/elder-detail/index',
  'pages/health-trend/index',
  'pages/reminders/index',
  'pages/advice-detail/index',
  'pages/help/index',
  'pages/about/index',
  'pages/message-detail/index',
]

describe('guardian secondary routes', () => {
  it('registers exactly the seven approved secondary pages', () => {
    expect(pages.pages.map((page) => page.path)).toEqual([
      'pages/index/index',
      'pages/advice/index',
      'pages/messages/index',
      'pages/profile/index',
      ...SECONDARY_PATHS,
    ])
  })

  it('keeps the four primary tabs unchanged and out of secondary routes', () => {
    expect(pages.tabBar.list.map((item) => item.pagePath)).toEqual([
      'pages/index/index',
      'pages/advice/index',
      'pages/messages/index',
      'pages/profile/index',
    ])

    const tabPaths = pages.tabBar.list.map((item) => item.pagePath)
    for (const route of Object.values(GUARDIAN_SECONDARY_ROUTES)) {
      expect(tabPaths).not.toContain(route.slice(1))
    }
  })

  it('exposes absolute, unique route constants that match pages.json', () => {
    const routes = Object.values(GUARDIAN_SECONDARY_ROUTES)

    expect(routes).toEqual(SECONDARY_PATHS.map((path) => `/${path}`))
    expect(new Set(routes).size).toBe(routes.length)
    for (const route of routes) {
      expect(route.startsWith('/')).toBe(true)
      expect(SECONDARY_PATHS).toContain(route.slice(1))
    }
  })

  it('gives every secondary page an explicit navigation bar title', () => {
    const titles = pages.pages
      .filter((page) => SECONDARY_PATHS.includes(page.path))
      .map((page) => page.style?.navigationBarTitleText)

    expect(titles).toEqual(['老人档案详情', '健康趋势详情', '今日提醒列表', 'AI 建议详情', '使用帮助', '关于银龄伴', '消息详情'])
    expect(titles.every((title) => typeof title === 'string' && title.length > 0)).toBe(true)
  })
})
