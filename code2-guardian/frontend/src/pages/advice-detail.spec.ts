import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const ADVICE_DETAIL = source('./advice-detail/index.vue')
const ADVICE_LIST = source('./advice/index.vue')
const ROUTES = source('../domain/routes.ts')
const PAGES_JSON = JSON.parse(source('../pages.json')) as {
  pages: Array<{ path: string }>
  tabBar: { list: Array<{ pagePath: string }> }
}

// 本轮明令禁止新增的任何医疗/药物/风险/来源/时间/模型/互动功能字段
const FORBIDDEN_TERMS = [
  '医疗诊断',
  '药物剂量',
  '风险等级',
  '建议来源',
  '更新时间',
  '模型',
  '准确率',
  '诊断',
  '剂量',
  '治疗方案',
  '点赞',
  '反馈',
  '分享',
  '收藏',
  '重新生成',
]

describe('advice detail page', () => {
  it('is registered as an ordinary page and not added to the tab bar', () => {
    expect(PAGES_JSON.pages.map((p) => p.path)).toContain('pages/advice-detail/index')
    expect(PAGES_JSON.tabBar.list.map((t) => t.pagePath)).not.toContain('pages/advice-detail/index')
  })

  it('exposes the detail route as a constant', () => {
    expect(ROUTES).toContain("adviceDetail: '/pages/advice-detail/index'")
  })

  it('reads the existing advice item by id instead of copying data', () => {
    expect(ADVICE_DETAIL).toContain("from '../../mock/data'")
    expect(ADVICE_DETAIL).toContain('adviceList')
    expect(ADVICE_DETAIL).toContain('.find(')
  })

  it('shows title, desc, icon and the demo tag', () => {
    expect(ADVICE_DETAIL).toContain('advice.title')
    expect(ADVICE_DETAIL).toContain('advice.desc')
    expect(ADVICE_DETAIL).toContain('advice.icon')
    expect(ADVICE_DETAIL).toContain('演示数据')
  })

  it('shows an empty state for an invalid id instead of fabricating content', () => {
    expect(ADVICE_DETAIL).toContain('未找到')
    expect(ADVICE_DETAIL).not.toContain('真实')
  })

  it('does not add medical, drug, risk or interactive fields', () => {
    for (const term of FORBIDDEN_TERMS) {
      expect(ADVICE_DETAIL, `详情页不应出现「${term}」`).not.toContain(term)
    }
  })
})

describe('advice list cards link to the detail page', () => {
  it('wires every card to the detail route passing its own id', () => {
    expect(ADVICE_LIST).toContain('GUARDIAN_SECONDARY_ROUTES')
    expect(ADVICE_LIST).toContain('adviceDetail')
    expect(ADVICE_LIST).toContain('openAdviceDetail')
    expect(ADVICE_LIST).toContain('@tap')
    expect(ADVICE_LIST).toContain('a.id')
  })

  it('reuses the navigator lock and failure toast', () => {
    expect(ADVICE_LIST).toContain('createSecondaryNavigator')
  })
})
