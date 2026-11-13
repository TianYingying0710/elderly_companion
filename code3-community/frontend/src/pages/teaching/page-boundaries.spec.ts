import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const apiStart = source.indexOf('<template v-if="isApi">')
const apiBranch = source.slice(apiStart, source.indexOf('</template>', apiStart))

describe('teaching page boundaries', () => {
  it('上下架通过 composable，不直接调用课程 API', () => {
    expect(source).toContain('catalog.setPublication')
    expect(source).not.toMatch(/api\/elderCourses/)
  })

  it('预置课程不可操作，动态课程可上下架', () => {
    expect(source).toMatch(/v-if="!course\.editable"/)
    expect(source).toContain('预置课程')
    expect(source).toContain('updatingId.value')
    expect(source).toContain('下架')
    expect(source).toContain('重新发布')
  })

  it('处理中再次触发有明确提示而不是空 toast', () => {
    expect(source).toContain('正在处理中，请稍候')
  })

  it('api 分支不自行改写发布状态', () => {
    expect(apiBranch.length).toBeGreaterThan(0)
    expect(apiBranch).not.toMatch(/\.status\s*=[^=]/)
  })
})
