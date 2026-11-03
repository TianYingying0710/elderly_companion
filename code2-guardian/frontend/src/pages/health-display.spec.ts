import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const HOME = source('../pages/index/index.vue')
const TREND = source('../pages/health-trend/index.vue')

describe('stateful health display', () => {
  it('home page no longer imports health mock constants directly', () => {
    expect(HOME).not.toMatch(/import \{[\s\S]*?healthMetrics[\s\S]*?\} from '\.\.\/\.\.\/mock\/data'/)
  })

  it('home page consumes a health provider instead of mock data', () => {
    expect(HOME).toContain('useHealthData')
    expect(HOME).toContain('HealthDataProvider')
  })

  it('home page renders per-state messages from the snapshot', () => {
    // 空态文案由状态机产生（domain/healthDataState），页面消费 snapshot.message
    expect(HOME).toContain('healthSnapshot?.message')
    expect(HOME).toContain('正在连接')
    expect(HOME).toContain('healthSnapshot.state')
  })

  it('home page gates values behind data states', () => {
    // 数值只在 has_data/stale 渲染，通过 isDemo 控制「演示数据」标签
    expect(HOME).toContain('演示数据')
    expect(HOME).toContain('isDemo')
  })

  it('health-trend page reuses the same provider instead of mock', () => {
    expect(TREND).toContain('useHealthData')
    expect(TREND).not.toMatch(/import \{[\s\S]*?heartRateTrend[\s\S]*?\} from '\.\.\/\.\.\/domain\/healthTrend'/)
    expect(TREND).not.toContain("from '../../mock/data'")
  })

  it('health-trend page renders empty state from the snapshot message', () => {
    expect(TREND).toContain('healthSnapshot?.message')
    expect(TREND).toContain('正在连接')
    expect(TREND).toContain('healthSnapshot.state')
  })
})
