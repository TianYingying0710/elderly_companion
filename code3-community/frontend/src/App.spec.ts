import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const exists = (path: string) => existsSync(new URL(path, import.meta.url))

const EXPECTED_PAGES = [
  'pages/rescue/index',
  'pages/service/index',
  'pages/content/index',
  'pages/knowledge/index',
  'pages/teaching/index',
]

describe('community frontend', () => {
  it('注册了 5 个社区端页面', () => {
    const config = JSON.parse(read('./pages.json')) as { pages: { path: string }[] }
    expect(config.pages.map((page) => page.path)).toEqual(EXPECTED_PAGES)
  })

  it('每个注册页面的 .vue 文件都存在', () => {
    const config = JSON.parse(read('./pages.json')) as { pages: { path: string }[] }
    for (const page of config.pages) {
      expect(exists(`./${page.path}.vue`)).toBe(true)
    }
  })

  it('tabBar 指向 3 个一级页', () => {
    const config = JSON.parse(read('./pages.json')) as { tabBar: { list: { pagePath: string }[] } }
    expect(config.tabBar.list.map((item) => item.pagePath)).toEqual([
      'pages/rescue/index',
      'pages/service/index',
      'pages/content/index',
    ])
  })
})
