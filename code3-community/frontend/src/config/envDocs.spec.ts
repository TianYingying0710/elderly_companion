import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const communityEnv = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8')
const elderEnv = readFileSync(
  new URL('../../../../code1-elder/frontend/.env.example', import.meta.url),
  'utf8',
)

describe('社区端环境变量契约', () => {
  it('说明 SOS 数据源开关，默认 mock', () => {
    expect(communityEnv).toMatch(/VITE_SOS_DATA_MODE=mock/)
    expect(communityEnv).toMatch(/VITE_SOS_DATA_MODE[^\n]*api/)
  })

  it('说明老人端后端地址（SOS 单一事件源）', () => {
    expect(communityEnv).toContain('VITE_ELDER_API_BASE_URL=')
  })
})

describe('老人端环境变量契约', () => {
  it('SOS 相关变量与数据源开关都有示例', () => {
    expect(elderEnv).toMatch(/VITE_SOS_DATA_MODE=mock/)
    expect(elderEnv).toContain('VITE_ELDER_API_BASE_URL=')
  })

  it('不写入真实机器 IP 或密钥', () => {
    expect(elderEnv).not.toMatch(/10\.72\.\d+\.\d+/)
    expect(elderEnv).not.toMatch(/password|secret|token/i)
  })
})
