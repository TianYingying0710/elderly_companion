import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')

describe('service page boundaries', () => {
  it('通过 composable 取数，不直接调用 API 模块', () => {
    expect(source).toContain('useServiceTasks')
    expect(source).not.toMatch(/api\/serviceTasks/)
    expect(source).not.toMatch(/apiRequest/)
  })

  it('不导入服务 mock', () => {
    expect(source).not.toMatch(/mock\/community/)
    expect(source).not.toMatch(/createServices/)
  })

  it('不拼 URL、不判断 HTTP 状态码、不解析错误体', () => {
    expect(source).not.toMatch(/https?:\/\//)
    expect(source).not.toMatch(/\/api\/v1/)
    expect(source).not.toMatch(/statusCode/)
    expect(source).not.toMatch(/error\.fields/)
  })

  it('渲染 loading、空状态与错误状态', () => {
    expect(source).toContain("state === 'loading'")
    expect(source).toContain("state === 'error'")
    expect(source).toContain('暂无服务任务')
    expect(source).toContain('重新加载')
  })

  it('不自行改写任务状态', () => {
    expect(source).not.toMatch(/\.status\s*=[^=]/)
    expect(source).not.toMatch(/nextServiceStatus|completeWithRecord/)
  })

  it('已完成详情的「关闭」真的关闭，不留失效主按钮', () => {
    expect(source).toMatch(/task\.status === 'completed'[\s\S]{0,60}closeDetail\(\)/)
  })

  it('打开详情或新建表单前清理上一操作的错误', () => {
    expect(source).toMatch(/function openDetail[\s\S]{0,160}clearActionError\(\)/)
    expect(source).toMatch(/function openCreate[\s\S]{0,160}clearActionError\(\)/)
  })

  it('刷新失败用列表外的固定提示通道，不替换整页', () => {
    expect(source).toMatch(/refresh-banner[^>]*>\{\{\s*actionError\s*\}\}/)
  })
})
