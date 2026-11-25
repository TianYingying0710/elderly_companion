import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')

describe('救援处置页 API 模式边界', () => {
  it('通过 composable 取数与推进，不直接调用 API 模块', () => {
    expect(source).toContain('useSosEvents')
    expect(source).not.toMatch(/api\/sosEvents/)
    expect(source).not.toMatch(/apiRequest/)
  })

  it('不拼 URL、不判断 HTTP 状态码、不解析错误体', () => {
    expect(source).not.toMatch(/https?:\/\//)
    expect(source).not.toMatch(/\/api\/v1/)
    expect(source).not.toMatch(/statusCode/)
    expect(source).not.toMatch(/error\.fields/)
  })

  it('API 模式提供开始处理与完成处理，动作由状态推导', () => {
    expect(source).toContain('nextSosStatus')
    expect(source).toContain('sosActionLabel')
    expect(source).toMatch(/sosStore\.transition\(/)
  })

  it('页面可见时轮询，隐藏与卸载都停止计时器', () => {
    expect(source).toMatch(/onShow\(\(\)[\s\S]{0,120}startPolling\(\)/)
    expect(source).toMatch(/onHide\(\(\)[\s\S]{0,80}stopPolling\(\)/)
    expect(source).toMatch(/onUnmounted\(\(\)[\s\S]{0,80}stopPolling\(\)/)
  })

  it('提供手动刷新入口', () => {
    expect(source).toMatch(/@tap="manualRefresh"/)
    expect(source).toMatch(/function manualRefresh[\s\S]{0,120}sosStore\.refresh\(\)/)
  })

  it('持续标注本地演示，不暗示真实报警', () => {
    expect(source).toContain('演示环境')
    expect(source).toContain('非真实报警')
  })

  it('不自行改写事件状态，只依赖后端返回值', () => {
    // mock 分支可以改本地演示对象，API 分支必须只信后端返回。
    expect(source).not.toMatch(/openApiEvent\.value\.status\s*=[^=]/)
    expect(source).not.toMatch(/event\.status\s*=[^=]/)
  })
})
