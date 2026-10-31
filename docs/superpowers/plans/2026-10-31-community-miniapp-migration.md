# 社区端小程序迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 参照原型 `E:\c2--\shequ-temp\index.html`，在 `code3-community/frontend` 中实现 5 个社区端小程序页面，先以 mock 数据跑通全部交互，不接后端。

**Architecture:** uni-app + Vue 3 + TypeScript，编译目标 `mp-weixin`。页面按 uni-app 页面栈组织（3 个 tabBar 页 + 2 个二级页），状态逻辑抽为纯函数，数据来自独立 mock 模块，为后续替换 `api/` 调用预留边界。

**Tech Stack:** Vue 3.4 / TypeScript 5.8 / uni-app 3.0 / Vite 5.2 / vitest 3.2

**原型参考（仓库外，只读）:** `E:\c2--\shequ-temp\index.html`

---

## 一、规格基线（写码前必须固化）

以下决策已在原型评审中确认，实现时不得擅自变更。

### 1.1 页面清单

| # | 路由 | 名称 | 类型 | 对应原型 section |
|---|------|------|------|------------------|
| 1 | `pages/rescue/index` | 救援处置 | tabBar | `data-page="rescue"` |
| 2 | `pages/service/index` | 社区服务协同 | tabBar | `data-page="service"` |
| 3 | `pages/content/index` | 内容发布 | tabBar | `data-page="content"` |
| 4 | `pages/knowledge/index` | 知识资料 | 二级页 | `data-page="knowledge"` |
| 5 | `pages/teaching/index` | 助老课程 | 二级页 | `data-page="teaching"` |

导航约定：

- tabBar 页之间用 `uni.switchTab`，**不可用 `navigateTo`**
- `content` → `knowledge` / `teaching` 用 `uni.navigateTo`
- 二级页返回用 `uni.navigateBack`

### 1.2 救援状态机（4 态）

```
待响应 → 已赶往现场 → 已到达 → 已完成处理
```

| 当前态 | 按钮文案 | 下一态 | 附加要求 |
|--------|----------|--------|----------|
| 待响应 | 派员前往现场 | 已赶往现场 | — |
| 已赶往现场 | 确认已到达 | 已到达 | — |
| 已到达 | 完成处理 | 已完成处理 | **必须填写处理结果**，否则阻断 |
| 已完成处理 | 关闭 | — | 仅关闭弹层 |

约束：

- 全流程**不得出现"接单/抢单/派单"字样**
- 状态推进时记录时间戳，格式统一为 `MM-DD HH:mm`
- 每次推进后刷新「N 个待响应」计数（仅统计 `待响应`）

### 1.3 求救原因显示规则

| 求助来源 | 列表卡片 | 详情弹层 |
|----------|----------|----------|
| 硬件求助（实体 SOS 按钮） | 只显示「紧急求助」 | 只显示「紧急求助」 |
| 软件求助（老人端一键求助） | 只显示「紧急求助」 | 「紧急求助 · <原因>」 |

理由：实体按钮无法携带原因，社区未到场前不得断言老人为何求助。

### 1.4 服务任务规则

- 三个分组：`待接收` / `服务中` / `已完成`
- 接收 → 卡片移入「服务中」，按钮变「完成」
- 完成 → 卡片移入「已完成」，按钮替换为 ✓ 标记
- 分组标题计数随卡片移动实时重算
- **分组计数为 0 时保留分组，显示「暂无任务」**（不隐藏分组）

### 1.5 数据模型

```ts
export type RescueStatus = '待响应' | '已赶往现场' | '已到达' | '已完成处理'

export interface GuardianProgress {
  name: string
  stage: 0 | 1 | 2
  times: string[]
  feedback: string
  otherCount: number
}

export interface RescueIncident {
  id: string
  name: string
  type: '紧急求助'
  reason: string
  location: string
  time: string
  source: '硬件求助 · 实体 SOS 按钮' | '软件求助 · 老人端一键求助'
  status: RescueStatus
  stepTimes: string[]
  result?: string
  guardian: GuardianProgress
}

export type ServiceStatus = '待接收' | '服务中' | '已完成'

export interface ServiceTask {
  id: string
  title: string
  name: string
  type: string
  time: string
  location: string
  description: string
  status: ServiceStatus
}

export interface KnowledgeDoc {
  id: string
  name: string
  content: string
  status: '待确认' | '已启用' | '已停用'
}

export interface Course {
  id: string
  title: string
  category: string
  format: string
  duration: string
  note: string
  status: '已发布' | '草稿' | '已下架'
}
```

### 1.6 视觉基线

- 设计宽度 430px → 750rpx，换算 `rpx = px * 1.744`
- 主要尺寸：页面左右内边距 27px ≈ 47rpx；卡片圆角 19px ≈ 33rpx；卡片内边距 18px ≈ 31rpx
- 见 `index.vue` 现有写法：`<text>` 需显式 `display: block` 才能独占行

---

## 二、前置条件

### 任务 0：开隔离分支（替代 worktree）

**不建 git worktree**，改为在当前仓库原地开分支。理由（已实测核对）：

- `code3-community/frontend/node_modules` 已存在（315 个包）。worktree 是全新目录，必然缺依赖，需要重跑 `npm install`，首次构建还要重新下载 uni-app 依赖。
- 微信开发者工具当前指向 `E:\c2--\code\code3-community\frontend\dist\build\mp-weixin`。换 worktree 等于换 dist 路径，需要重新导入项目。
- 当前工作树有大量与本次无关的未提交改动，但**全部集中在 `code1-elder/` 与 `docs/`；`code3-community/` 是干净的**（`git status --short` 无该目录条目），原地施工不会误伤。

- 命令：

```bash
cd E:/c2--/code
git checkout -b feat/community-rescue
```

- 验证：`git branch --show-current` 输出 `feat/community-rescue`；`git status --short` 中仍无 `code3-community/` 条目
- 收尾：全部任务完成后由用户决定合并回 `feat/mobile-client-platforms` 还是单开 PR

### 任务 0.1：更新阶段文档

- 文件路径：`docs/progress.md`
- 在「已完成」小节前插入新小节：

```markdown
## 社区端小程序原型迁移

- 依据原型 `shequ-temp/index.html` 实现 5 个社区端页面，UI 使用独立 mock 数据。
- 不接后端：`code3-community` 后端仍只有 `GET /health`。
- 「当前阶段明确不做」中关于社区端业务页面的限制，自本小节起解除；数据库、真实数据、认证仍不涉及。
```

- 验证：`docs/progress.md` 中存在「社区端小程序原型迁移」小节

---

## 三、任务分解

### 任务 1：注册页面 + 占位页 + 同步测试断言

本任务一次性做完三件事，保证任一时刻 `npm test` 与 `npm run build:mp-weixin` 都是绿的。（原计划把测试断言放在注册之前，中间态必红；也不能只改 `pages.json` 不建页面，`uni build` 会因找不到 `.vue` 直接失败。）

**① 页面注册** —— 文件路径：`src/pages.json`，内容：

```json
{
  "pages": [
    { "path": "pages/rescue/index", "style": { "navigationBarTitleText": "救援处置" } },
    { "path": "pages/service/index", "style": { "navigationBarTitleText": "社区服务协同" } },
    { "path": "pages/content/index", "style": { "navigationBarTitleText": "内容发布" } },
    { "path": "pages/knowledge/index", "style": { "navigationBarTitleText": "知识资料" } },
    { "path": "pages/teaching/index", "style": { "navigationBarTitleText": "助老课程" } }
  ],
  "tabBar": {
    "color": "#3e434e",
    "selectedColor": "#303848",
    "backgroundColor": "#f0eff7",
    "borderStyle": "white",
    "list": [
      { "pagePath": "pages/rescue/index", "text": "救援处置" },
      { "pagePath": "pages/service/index", "text": "社区服务" },
      { "pagePath": "pages/content/index", "text": "内容发布" }
    ]
  },
  "globalStyle": {
    "navigationBarTextStyle": "black",
    "navigationBarBackgroundColor": "#ffffff",
    "backgroundColor": "#f5f7fb"
  }
}
```

- 说明：首版使用**纯文字 tabBar**，不配图标（避免额外资源依赖）。微信 tabBar 的 `iconPath` 是可选字段，底部 tabBar 不配图标只会显示文字，可正常构建。

**② 同步建 5 个占位页**（本任务必须一起做，否则 `uni build` 报页面文件不存在）

- 文件路径：`src/pages/rescue/index.vue`、`pages/service/index.vue`、`pages/content/index.vue`、`pages/knowledge/index.vue`、`pages/teaching/index.vue`
- 每个文件内容只放标题占位，后续任务逐个替换：

```vue
<script setup lang="ts"></script>

<template>
  <view class="stub">
    <text class="stub-title">救援处置</text>
  </view>
</template>

<style scoped>
.stub { padding: 48rpx; }
.stub-title { display: block; font-size: 44rpx; font-weight: 700; }
</style>
```

- 同时删除 `src/pages/index/index.vue`（不再在 `pages.json` 注册，留着就是孤儿文件；tabBar 首项 `pages/rescue/index` 即默认首页）

**③ 同步既有测试断言** —— 文件路径：`src/App.spec.ts`

原断言写死 `pages/index/index.vue` 含「银龄伴 · 社区端」和「微信小程序空白框架已就绪」，页面一改必红。改为结构性断言（不写死文案，后续做页面不会再撞测试）：

```ts
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const exists = (path: string) => existsSync(new URL(path, import.meta.url))

const EXPECTED_PAGES = [
  'pages/rescue/index',
  'pages/service/index',
  'pages/content/index',
  'pages/knowledge/index',
  'pages/teaching/index',
]

describe('community frontend', () => {
  it('注册了 5 个社区端页面', () => {
    const config = JSON.parse(read('./pages.json')) as { pages: { path: string }[] }
    expect(config.pages.map((page) => page.path)).toEqual(EXPECTED_PAGES)
  })

  it('每个注册页面的 .vue 文件都存在', () => {
    const config = JSON.parse(read('./pages.json')) as { pages: { path: string }[] }
    for (const page of config.pages) {
      expect(exists(`./${page.path}.vue`)).toBe(true)
    }
  })

  it('tabBar 指向 3 个一级页', () => {
    const config = JSON.parse(read('./pages.json')) as { tabBar: { list: { pagePath: string }[] } }
    expect(config.tabBar.list.map((item) => item.pagePath)).toEqual([
      'pages/rescue/index',
      'pages/service/index',
      'pages/content/index',
    ])
  })
})
```

- 验证（本任务的验收线）：
  - `npm test` 全绿（3 个用例）
  - `npm run type-check` 零错误
  - `npm run build:mp-weixin` 成功，`dist/build/mp-weixin` 下出现 5 个页面目录
  - 微信开发者工具可打开产物，底部 3 个 tab 可切换，每页显示占位标题

### 任务 2：类型定义

- 文件路径：`src/types/community.ts`
- 内容：粘贴第 1.5 节全部类型定义
- 验证：`npm run type-check` 通过

### 任务 3：状态机纯函数（TDD，先写测试）

- 文件路径：`src/domain/rescueFlow.ts`
- 先建 `src/domain/rescueFlow.spec.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { nextStatus, requiresResult, isTerminal, RESCUE_FLOW } from './rescueFlow'

describe('rescueFlow', () => {
  it('按 4 态顺序推进', () => {
    expect(nextStatus('待响应')).toBe('已赶往现场')
    expect(nextStatus('已赶往现场')).toBe('已到达')
    expect(nextStatus('已到达')).toBe('已完成处理')
  })

  it('终态不再推进', () => {
    expect(isTerminal('已完成处理')).toBe(true)
    expect(nextStatus('已完成处理')).toBe('已完成处理')
  })

  it('只有已到达进入完成处理时需要填写结果', () => {
    expect(requiresResult('待响应')).toBe(false)
    expect(requiresResult('已赶往现场')).toBe(false)
    expect(requiresResult('已到达')).toBe(true)
    expect(requiresResult('已完成处理')).toBe(false)
  })

  it('流程共 4 步', () => {
    expect(RESCUE_FLOW).toHaveLength(4)
  })
})
```

- 验证（RED）：`npm test rescueFlow` 应当失败，提示模块不存在

- 再建 `src/domain/rescueFlow.ts`：

```ts
import type { RescueStatus } from '../types/community'

export const RESCUE_FLOW: RescueStatus[] = ['待响应', '已赶往现场', '已到达', '已完成处理']

export function isTerminal(status: RescueStatus): boolean {
  return status === '已完成处理'
}

export function nextStatus(status: RescueStatus): RescueStatus {
  const index = RESCUE_FLOW.indexOf(status)
  if (index < 0 || index >= RESCUE_FLOW.length - 1) return status
  return RESCUE_FLOW[index + 1]
}

export function requiresResult(status: RescueStatus): boolean {
  return status === '已到达'
}

export function stamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
```

- 验证（GREEN）：`npm test rescueFlow` 全部通过

### 任务 4：mock 数据

- 文件路径：`src/mock/community.ts`
- 内容：从原型迁移三张救援卡、三条服务任务、两份知识资料、三门课程；字段名与第 1.5 节一致
- 硬性要求：
  - 王建国、张桂英为硬件求助 → `reason: ''`
  - 李秀兰为软件求助 → `reason: '身体不适'`
  - 服务任务的 `status` 分别为 `待接收` / `服务中` / `已完成`
- 验证：`npm run type-check` 通过

### 任务 5：救援处置页

- 文件路径：`src/pages/rescue/index.vue`
- 结构：
  - 页头：「救援处置」+「N 个待响应」+「＋ 模拟新求助」按钮
  - 列表：`v-for` 渲染 `RescueIncident`，卡片含类型 tag、状态 tag、姓名、地址、时间行
  - 弹层：自写 fixed 容器 + 遮罩，含事件摘要、家庭协同、时间轴、结果输入框、主按钮
- 交互：
  - 点击卡片 → 打开弹层
  - 主按钮 → 调 `nextStatus`，`requiresResult` 为真时校验结果非空
  - 推进后同步卡片状态 tag、头部计数、时间轴
  - 「模拟新求助」→ 向列表头部插入一条 `待响应` 事件（人物从预设池轮取）
- 样式要点：
  - 禁用 `<dialog>`，改用 `<view class="mask">` + `<view class="sheet">`，外层加 `@touchmove.stop.prevent`
  - 时间轴竖线用 `::after` 定位，与原型一致
- 验证：微信开发者工具中打开，能依次推进 4 态，终态后按钮变「关闭」

#### 执行拆分（5a–5f，替代「一次写完 300 行」）

原计划把整页当一个任务，粒度太粗，出错后无法定位是哪一层坏了。按下面 6 步做，每步都能在开发者工具里看到变化。

| 步骤 | 内容 | 验收 |
|------|------|------|
| 5a | 页头（标题 / 副标题 / `N 个待响应` 计数）+ `v-for` 静态渲染 3 条 mock 事件；卡片 = 红 tag + 状态 tag（终态绿、其余蓝）+ 姓名 + 地址行 + `时间 · 硬件求助/软件求助`（**不出现原因**） | 首屏即救援处置页，3 张卡与原型一致，计数「1 个待响应」 |
| 5b | 页头右侧「＋ 模拟新求助」；点击调 `createSimIncident(seq)` 生成 `待响应` 事件 `unshift` 到头部，计数 +1；人物从 `simPool` 4 人轮取，序号自增防 id 重复 | 连点 3 次依次出现刘振国 / 陈玉兰 / 孙德海 |
| 5c | 详情弹层只读：`<view class="mask">` + `<view class="sheet">`（禁用 `<dialog>`，遮罩 `@tap.stop`，sheet `@touchmove.stop.prevent`）；含摘要、家庭协同、时间轴 | 3 张卡都能打开；李秀兰原因行显示「紧急求助 · 身体不适」，另两张只有「紧急求助」 |
| 5d | 主按钮推进 4 态，文案取 `RESCUE_STEPS[i].action`；终态「关闭」只关弹层；`已到达` 时校验结果非空，空则 toast「请先填写处理结果」并阻断；推进时写 `stepTimes[i] = stepTimes[i] \|\| stamp()` | 王建国卡连点 4 次，状态 tag 变 4 次，终态按钮变「关闭」 |
| 5e | 计数与列表联动；结果输入框用 `v-if` 仅在 `已到达` 显示 | 推进到「已赶往现场」后计数归零；再点模拟新求助回 1 |
| 5f | 样式对齐：`rpx = px * 1.744`，卡片圆角 33rpx / 内边距 31rpx / 页面左右 47rpx / 标题 51rpx；时间轴竖线 `::after`（`left:28rpx; top:54rpx; bottom:0; width:3rpx`）；`<text>` 显式 `display:block`；页面内不得出现「演示」「mock」字样 | 与原型逐屏对比无明显色差错位 |

时间轴状态判定（与原型 `renderIncidentFlow` 一致）：

- `complete = status === '已完成处理'`
- `complete || index < currentIndex` → 已完态，圆点显示 ✓，说明行显示 `stepTimes[index] || '已完成'`
- `index === currentIndex` → 当前态，圆点显示 `index + 1`，说明行显示 `stepTimes[index] || '当前步骤'`
- 其余 → 未达态，圆点显示 `index + 1`，说明行「等待处理」

### 任务 6：社区服务协同页

- 文件路径：`src/pages/service/index.vue`
- 结构：3 个分组，每组标题含计数，`v-for` 渲染任务卡
- 交互：
  - 「接收任务」→ status 置 `服务中`，卡片移入第二组
  - 「完成」→ status 置 `已完成`，按钮替换为 ✓，卡片移入第三组
  - 每次移动后重算三组计数；计数为 0 的分组显示「暂无任务」
- 验证：依次接收、完成各一张卡，分组与计数正确变化

### 任务 7：内容发布页

- 文件路径：`src/pages/content/index.vue`
- 结构：两张入口卡，顺序为**助老课程 → 知识资料**
- 交互：`uni.navigateTo` 到 `pages/teaching/index` 与 `pages/knowledge/index`
- 验证：两个入口分别跳转正确，返回可用 `navigateBack`

### 任务 8：知识资料页

- 文件路径：`src/pages/knowledge/index.vue`
- 结构：上传按钮 + 文档列表（名称、状态 tag、操作按钮）
- 交互：
  - 「审核内容」→ 打开弹层，可编辑内容，确认后状态置 `已启用`
  - 「停用」↔「重新启用」切换
- 说明：文件选择用 `uni.chooseMessageFile`，仅取文件名，不上传
- 验证：状态切换正确，弹层可保存与取消

### 任务 9：助老课程页

- 文件路径：`src/pages/teaching/index.vue`
- 结构：分类筛选行 + 课程列表（标题、状态 tag、分类/形式/时长、操作）
- 交互：发布 ↔ 下架状态切换
- 验证：切换后 tag 颜色与文案正确

### 任务 10：全量验收

- 命令：

```bash
npm run type-check
npm test
npm run build:mp-weixin
```

- 验证标准：
  - 类型检查零错误
  - 全部测试通过（含新增 `rescueFlow.spec.ts`）
  - 构建产物 `dist/build/mp-weixin` 含 5 个页面
  - 微信开发者工具导入产物，5 个页面均可打开、无报错

---

## 四、风险与约束

| 风险 | 应对 |
|------|------|
| 原 `App.spec.ts` 断言旧首页文案，改造后必然失败 | 任务 0.1 先行修正 |
| 小程序无 DOM，原型中全部 `querySelector` / `innerHTML` 写法失效 | 一律改为 `ref` + `v-for` 数据驱动 |
| tabBar 页面无法带参数跳转 | 二级页参数用 `uni.navigateTo` 的 query，不依赖共享状态 |
| 原型 `position:fixed` 悬浮按钮在 tabBar 上会被遮挡 | 已完成改造：按钮移至页头，无悬浮层 |
| 原型含「演示」字样与内联模拟数据，直接照搬会污染正式包 | mock 集中于 `src/mock/`，后续替换为 `api/` 时单点删除 |

## 五、不做的事（YAGNI）

- 不接后端接口（后端只有 `/health`）
- 不做登录、鉴权、真实数据、数据库
- 不做 RAG、模型调用、语音、硬件接入
- 不做正式 AppID 与发布流程
- 不提前抽象通用组件，等第二个页面出现重复时再抽（实际执行时页头/弹层/toast 在 5 个页面重复出现，已抽为 `components/` 与 `composables/`）

---

## 六、执行状态（2026-10-31）

已按本计划落地，实际分层与偏差如下。

### 6.1 目录分层（页面之间零引用）

```
src/
  types/community.ts          纯类型
  domain/rescueFlow.ts        4 态机纯函数（TDD）
  domain/rescueFlow.spec.ts   6 个用例
  mock/community.ts           工厂函数 + createSimIncident
  components/                 ScreenIdentity / PageHeader / SubPageHeader / BottomSheet / AppToast
  composables/useToast.ts     轻提示
  utils/system.ts             状态栏高度
  pages/{rescue,service,content,knowledge,teaching}/index.vue
```

页面只依赖「types / domain / mock / components / composables」，互相不 import。接后端时只需把 `mock/` 的工厂函数换成 `api/` 返回值。

### 6.2 与计划的两处偏差

| 项 | 计划 | 实际 | 原因 |
|---|---|---|---|
| 任务 0 隔离方式 | git worktree | 原地开分支 | worktree 缺 `node_modules`、且改变 devtools 已指向的 `dist` 路径 |
| 任务 6 服务页推进方式 | 卡片按钮直接改状态 | 点卡片开弹层 → 弹层内填服务记录 → 弹层按钮推进 | 原型行为如此，且「完成」需要记录服务过程 |

### 6.3 验收记录

- `vue-tsc --noEmit -p tsconfig.app.json`：0 错误
- `vitest run`：3 个文件 11 个用例全通过（App 3 + api 2 + rescueFlow 6）
- `uni build -p mp-weixin`：成功，产物含 5 个页面 + 6 个组件
- 待人工验收：开发者工具导入 `dist/build/mp-weixin`，逐页比对原型

### 6.4 遗留

- `E:\c2--\code\.git` 在本轮开工时被清空（0 条目），仓库历史不可用，工作区源码完好。重建方式待确认。
