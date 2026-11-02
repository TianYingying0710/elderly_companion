import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('guardian frontend', () => {
  it('home page matches the UI mock shell', () => {
    const page = readFileSync(new URL('./pages/index/index.vue', import.meta.url), 'utf8')
    expect(page).toContain('银龄伴·监护人端')
    expect(page).toContain('关爱长辈·守护健康')
    expect(page).toContain('健康概况')
    expect(page).toContain('今日提醒')
    expect(page).toContain('每日平均静息心率')
    expect(page).toContain('次/分')
    expect(page).toContain('演示数据')
    expect(page).not.toContain('trend-bell')
  })

  it('registers the four tab pages from the UI mock', () => {
    const pages = readFileSync(new URL('./pages.json', import.meta.url), 'utf8')
    expect(pages).toContain('pages/index/index')
    expect(pages).toContain('pages/advice/index')
    expect(pages).toContain('pages/messages/index')
    expect(pages).toContain('pages/profile/index')
  })

  it('builds primary navigation as a custom tab bar', () => {
    const pages = JSON.parse(readFileSync(new URL('./pages.json', import.meta.url), 'utf8'))
    expect(pages.tabBar.custom).toBe(true)
    expect(pages.tabBar.list).toHaveLength(4)
  })

  it('wires the three approved home entries to their secondary routes', () => {
    const page = readFileSync(new URL('./pages/index/index.vue', import.meta.url), 'utf8')
    const handlerBody = (name: string) => {
      const matched = page.match(new RegExp(`function ${name}\\(\\) \\{([\\s\\S]*?)\\n\\}`))
      return matched ? matched[1].trim() : ''
    }

    expect(page).not.toContain('showPlannedFeature')
    expect(page).toContain('@tap="openElderDetail"')
    expect(page).toContain('@tap="openHealthTrend"')
    expect(page).toContain('@tap="openReminders"')
    expect(handlerBody('openElderDetail')).toBe('navigator.open(GUARDIAN_SECONDARY_ROUTES.elderDetail)')
    expect(handlerBody('openHealthTrend')).toBe('navigator.open(GUARDIAN_SECONDARY_ROUTES.healthTrend)')
    expect(handlerBody('openReminders')).toBe('navigator.open(GUARDIAN_SECONDARY_ROUTES.reminders)')
    expect(page).toContain('健康概况')
    expect(page).toContain('演示数据')
    expect(page).not.toContain('class="circle"')
    expect(page).not.toContain('.circle {')
  })
})
