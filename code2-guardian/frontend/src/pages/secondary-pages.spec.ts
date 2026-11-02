import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const ELDER_DETAIL = source('./elder-detail/index.vue')
const HEALTH_TREND = source('./health-trend/index.vue')
const REMINDERS = source('./reminders/index.vue')
const PAGES = { elderDetail: ELDER_DETAIL, healthTrend: HEALTH_TREND, reminders: REMINDERS }

const FABRICATED_PROFILE_FIELDS = ['病史', '身份证', '手机号', '电话', '紧急联系人', '家庭住址', '生日', '性别']

describe('elder detail page', () => {
  it('renders only the four fields that already exist in the demo profile', () => {
    expect(ELDER_DETAIL).toContain("from '../../mock/data'")
    for (const field of ['elderProfile.name', 'elderProfile.age', 'elderProfile.relation', 'elderProfile.boundLabel']) {
      expect(ELDER_DETAIL).toContain(field)
    }
  })

  it('does not invent profile fields that are absent from the demo data', () => {
    for (const field of FABRICATED_PROFILE_FIELDS) {
      expect(ELDER_DETAIL).not.toContain(field)
    }
  })
})

describe('health trend detail page', () => {
  it('reuses the existing seven day resting heart-rate model instead of copying it', () => {
    expect(HEALTH_TREND).toContain("from '../../domain/healthTrend'")
    expect(HEALTH_TREND).toContain('heartRateTrend')
    expect(HEALTH_TREND).toContain('buildTrendPoints')
    expect(HEALTH_TREND).not.toContain('dateLabel:')
  })

  it('shows the per-day values together with derived statistics', () => {
    for (const label of ['最高', '最低', '平均', '次/分', '静息心率']) {
      expect(HEALTH_TREND).toContain(label)
    }
    expect(HEALTH_TREND).toContain('summarizeTrend')
  })
})

describe('today reminders page', () => {
  it('lists the existing reminders read-only with a visible count', () => {
    expect(REMINDERS).toContain("from '../../mock/data'")
    expect(REMINDERS).toContain('reminders')
    expect(REMINDERS).toContain('reminders.length')
    expect(REMINDERS).not.toContain('@tap')
    expect(REMINDERS).not.toContain('checkbox')
    expect(REMINDERS).not.toContain('<switch')
    for (const action of ['编辑', '删除', '完成', '勾选']) {
      expect(REMINDERS).not.toContain(action)
    }
  })
})

describe('secondary pages share the demo contract', () => {
  it('marks every secondary page as demo data', () => {
    for (const [name, page] of Object.entries(PAGES)) {
      expect(page, `${name} 缺少演示数据标识`).toContain('演示数据')
    }
  })

  it('keeps pages independent from each other', () => {
    for (const page of Object.values(PAGES)) {
      expect(page).not.toMatch(/from '\.\.\/(elder-detail|health-trend|reminders)/)
    }
  })

  it('does not introduce any unapproved secondary page', () => {
    const pagesJson = JSON.parse(source('../pages.json')) as { pages: Array<{ path: string }> }
    const secondary = pagesJson.pages
      .map((page) => page.path)
      .filter((path) => !['pages/index/index', 'pages/advice/index', 'pages/messages/index', 'pages/profile/index'].includes(path))

    expect(secondary).toEqual([
      'pages/elder-detail/index',
      'pages/health-trend/index',
      'pages/reminders/index',
    ])
  })

  it('leaves the other primary tab pages on their original behaviour', () => {
    for (const tab of ['advice', 'messages', 'profile']) {
      const page = source(`./${tab}/index.vue`)
      expect(page, `${tab} 页不应接入二级路由`).not.toContain('GUARDIAN_SECONDARY_ROUTES')
      expect(page, `${tab} 页不应新增页面跳转`).not.toContain('navigateTo')
    }
  })
})
