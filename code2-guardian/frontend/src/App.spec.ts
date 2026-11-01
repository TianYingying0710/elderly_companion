import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('guardian frontend', () => {
  it('home page matches the UI mock shell', () => {
    const page = readFileSync(new URL('./pages/index/index.vue', import.meta.url), 'utf8')
    expect(page).toContain('银龄伴·监护人端')
    expect(page).toContain('关爱长辈·守护健康')
    expect(page).toContain('健康概况')
    expect(page).toContain('今日提醒')
  })

  it('registers the four tab pages from the UI mock', () => {
    const pages = readFileSync(new URL('./pages.json', import.meta.url), 'utf8')
    expect(pages).toContain('pages/index/index')
    expect(pages).toContain('pages/advice/index')
    expect(pages).toContain('pages/messages/index')
    expect(pages).toContain('pages/profile/index')
  })
})
