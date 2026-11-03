import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const HELP = source('./help/index.vue')
const ABOUT = source('./about/index.vue')
const PROFILE = source('./profile/index.vue')
const ROUTES = source('../domain/routes.ts')
const PAGES_JSON = JSON.parse(source('../pages.json')) as {
  pages: Array<{ path: string }>
  tabBar: { list: Array<{ pagePath: string }> }
}

// 本轮禁止引入的敏感/未授权字段与交互
const FORBIDDEN_TERMS = ['身份证', '手机号', '电话', '隐私', '协议', '客服', '在线', '联系我们', '官方网站', '版本号']

// 帮助/关于页禁止声称具备的真实能力
// 注意：免责声明中的「不代表真实…监测/看护」是否定句式，属允许范围
const FORBIDDEN_CAPABILITY_CLAIMS = [
  '真实家庭看护',
  '真实求助',
  '真实社区通知',
  '真实 AI',
  '真实硬件',
  '真实医疗',
  '真实认证',
  '真实授权',
  '实时',
  '预警',
  '告警',
]

describe('help page (使用帮助)', () => {
  it('is registered as an ordinary page and not added to the tab bar', () => {
    expect(PAGES_JSON.pages.map((p) => p.path)).toContain('pages/help/index')
    expect(PAGES_JSON.tabBar.list.map((t) => t.pagePath)).not.toContain('pages/help/index')
  })

  it('is a static, self-contained page with no data dependency', () => {
    expect(HELP).not.toContain("from '../../mock/data'")
    expect(HELP).not.toContain('onLoad')
    expect(HELP).not.toContain('navigateTo')
  })

  it('marks itself as demo data', () => {
    expect(HELP).toContain('演示数据')
  })

  it('does not fabricate sensitive or unapproved content', () => {
    for (const term of FORBIDDEN_TERMS) {
      expect(HELP, `使用帮助页不应出现「${term}」`).not.toContain(term)
    }
  })

  it('does not claim real capabilities', () => {
    for (const claim of FORBIDDEN_CAPABILITY_CLAIMS) {
      expect(HELP, `使用帮助页不应声称「${claim}」`).not.toContain(claim)
    }
  })
})

describe('about page (关于银龄伴)', () => {
  it('is registered as an ordinary page and not added to the tab bar', () => {
    expect(PAGES_JSON.pages.map((p) => p.path)).toContain('pages/about/index')
    expect(PAGES_JSON.tabBar.list.map((t) => t.pagePath)).not.toContain('pages/about/index')
  })

  it('is a static, self-contained page with no data dependency', () => {
    expect(ABOUT).not.toContain("from '../../mock/data'")
    expect(ABOUT).not.toContain('onLoad')
    expect(ABOUT).not.toContain('navigateTo')
  })

  it('marks itself as demo data', () => {
    expect(ABOUT).toContain('演示数据')
  })

  it('does not fabricate sensitive or unapproved content', () => {
    for (const term of FORBIDDEN_TERMS) {
      expect(ABOUT, `关于页不应出现「${term}」`).not.toContain(term)
    }
  })

  it('does not claim real capabilities', () => {
    for (const claim of FORBIDDEN_CAPABILITY_CLAIMS) {
      expect(ABOUT, `关于页不应声称「${claim}」`).not.toContain(claim)
    }
  })
})

describe('profile menu wires help and about to their pages', () => {
  it('exposes both routes as constants', () => {
    expect(ROUTES).toContain("help: '/pages/help/index'")
    expect(ROUTES).toContain("about: '/pages/about/index'")
  })

  it('reuses the navigator lock for menu navigation', () => {
    expect(PROFILE).toContain('createSecondaryNavigator')
    expect(PROFILE).toContain('GUARDIAN_SECONDARY_ROUTES')
    expect(PROFILE).toContain('@tap')
  })

  it('only wires help and about menu items, leaving the rest read-only', () => {
    // 只有 id 5（使用帮助）与 id 6（关于银龄伴）跳转，其余保持只读、不误挂跳转
    expect(PROFILE).toContain('id === 5')
    expect(PROFILE).toContain('id === 6')
    expect(PROFILE).not.toContain('id === 1')
    expect(PROFILE).not.toContain('id === 2')
    expect(PROFILE).not.toContain('id === 3')
    expect(PROFILE).not.toContain('id === 4')
  })
})
