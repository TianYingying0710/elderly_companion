import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const itemsModule = { exports: [] as Array<{
  key: string
  label: string
  path: string
  iconPath: string
  selectedIconPath: string
}> }
new Function('module', source('../custom-tab-bar/items.js'))(itemsModule)
const TAB_ITEMS = itemsModule.exports

describe('guardian primary tabs', () => {
  it('declares the four unique primary routes in UI order', () => {
    expect(TAB_ITEMS.map(({ key, label, path }) => ({ key, label, path }))).toEqual([
      { key: 'home', label: '老人画像', path: '/pages/index/index' },
      { key: 'advice', label: 'AI建议', path: '/pages/advice/index' },
      { key: 'messages', label: '消息', path: '/pages/messages/index' },
      { key: 'profile', label: '我的', path: '/pages/profile/index' },
    ])
    expect(new Set(TAB_ITEMS.map((item) => item.path)).size).toBe(4)
  })

  it('registers a custom tabBar with the same route order', () => {
    const pages = JSON.parse(source('../pages.json')) as {
      tabBar?: { custom?: boolean; list?: Array<{ pagePath: string; text: string }> }
    }
    expect(pages.tabBar?.custom).toBe(true)
    expect(pages.tabBar?.list).toEqual(
      TAB_ITEMS.map((item) => ({ pagePath: item.path.slice(1), text: item.label })),
    )
  })

  it('uses one native custom tab bar instead of page-local Vue copies', () => {
    for (const path of ['index', 'advice', 'messages', 'profile']) {
      const page = source(`../pages/${path}/index.vue`)
      expect(page).not.toContain("components/TabBar.vue")
      expect(page).not.toContain('<TabBar')
    }
    for (const filename of ['index.json', 'index.wxml', 'index.wxss', 'index.js', 'items.js']) {
      expect(() => source(`../custom-tab-bar/${filename}`)).not.toThrow()
    }
    expect(source('../custom-tab-bar/index.js')).toContain("require('./items')")
  })
})
