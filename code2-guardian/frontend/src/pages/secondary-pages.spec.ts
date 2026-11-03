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
  it('reuses the trend model through the provider instead of copying it', () => {
    expect(HEALTH_TREND).toContain('useHealthData')
    expect(HEALTH_TREND).toContain('buildTrendPoints')
    expect(HEALTH_TREND).toContain('summarizeTrend')
    expect(HEALTH_TREND).not.toContain('dateLabel:')
    // 不再直接 import 趋势常量 heartRateTrend（改为通过 Provider 获取），但保留工具函数 buildTrendPoints
    expect(HEALTH_TREND).not.toContain('heartRateTrend')
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
      'pages/advice-detail/index',
      'pages/help/index',
      'pages/about/index',
      'pages/message-detail/index',
    ])
  })

  it('keeps the profile tab as the only menu-entry page and messages wired to detail', () => {
    // 本轮收口：profile 接入 help/about，messages 接入 message-detail，均为已批准入口
    const profilePage = source('./profile/index.vue')
    const messagesPage = source('./messages/index.vue')
    expect(profilePage).toContain('GUARDIAN_SECONDARY_ROUTES')
    expect(messagesPage).toContain('GUARDIAN_SECONDARY_ROUTES')
    expect(messagesPage).toContain('messageDetail')
  })
})
