import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('guardian frontend', () => {
  it('identifies the guardian mini-program shell', () => {
    const page = readFileSync(new URL('./pages/index/index.vue', import.meta.url), 'utf8')
    expect(page).toContain('银龄伴 · 监护人端')
    expect(page).toContain('微信小程序空白框架已就绪')
  })
})
