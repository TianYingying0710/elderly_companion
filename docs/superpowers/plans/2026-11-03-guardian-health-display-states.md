# Guardian Health Display States Implementation Plan

> **For agentic workers:** 使用 TDD，先写失败测试再实现。步骤用 `- [ ]` 跟踪。

**Goal:** 把监护人端健康展示（首页健康概况 + 近 7 天趋势 + health-trend 详情）改造为通过可替换 `HealthDataProvider` 驱动的六态状态化界面；默认「未接入硬件」；不伪造真实数据、不新增后端、不接真实 API、不新增页面。

**Spec:** `docs/superpowers/specs/2026-11-03-guardian-health-display-states-design.md`

## Global Constraints

- 只修改 `code2-guardian/frontend` 与本文对应的设计文档，**以及 `docs/progress.md`（收口时更新进度，属允许范围）**。
- 不修改老人端、社区端、共享层、监护人端后端业务逻辑。
- 不接入硬件 SDK、蓝牙、数据库、认证、外部服务；不新增后端接口。
- 不安装、升级、删除依赖。
- 不新增与需求无关的页面；不把演示数据标记为真实健康数据。
- 页面不直接读取后端原始响应；保留 API Client / DTO / Mapper 边界。
- 「有数据」状态必须显示「演示数据」，其他状态不显示健康数值。
- 不新增硬件控制按钮（「连接硬件」「绑定设备」「重试」）；仅新增「导入模拟数据」/「清除模拟数据」两个演示态切换按钮，它们只操作 mock Provider，不涉及真实硬件绑定。

## 关键契约要点（实现时对照）

- 过期阈值 24 小时，`deriveHealthState` 的 `staleThresholdMs` 可注入；时间统一带时区 ISO 8601。
- `connecting` 由 `useHealthData` 的 `loading` 派生，不由 Provider 返回。
- **错误映射优先级**：`ApiError.code === 'health_data_source_unavailable'` → `not_connected`；其他 `ApiError`/普通 `Error` → `error`；均保留 `message`。
- 六态优先级：`connecting` > `error` > `not_connected` > `no_data` > `stale` > `has_data`。
- `trend` 纳入 `HealthOverviewSnapshot`；仅 `has_data`/`stale` 非空。
- `HealthOverviewSnapshot` 含 `sourceStatus` 与 `isDemo`；`isDemo` 仅 `has_data`/`stale` 为 true（由 mock provider 标记）。
- 默认快照为 `not_connected`：`{ state:'not_connected', metrics:[], trend:[], updatedAt:null, message:'尚未接入硬件', sourceStatus:'unavailable', isDemo:false }`。
- **演示数据按钮**：健康概况卡内 `not_connected` 显示「导入模拟数据」、`has_data`/`stale` 显示「清除模拟数据」；按钮下方固定小字「模拟数据仅用于演示，不代表真实健康数据」；`connecting`/`no_data`/`error` 无按钮；趋势卡不放按钮。
- `useHealthData` 需暴露 `reload()`（重新调 `getOverview` 并更新快照），供按钮点击后刷新。
- 「今日提醒」卡不受状态机管辖，未接入硬件时照常显示（方案 A）。

## 文件清单

**新增：**
- `src/domain/healthDataState.ts` — 六态状态机纯函数 + 类型
- `src/domain/healthDataState.spec.ts`
- `src/data/healthDataProvider.ts` — `HealthDataProvider` 接口 + `MockHealthDataProvider`
- `src/data/healthDataProvider.spec.ts`
- `src/composables/useHealthData.ts` — loading 编排 + 异常转 error
- `src/composables/useHealthData.spec.ts`

**修改：**
- `src/pages/index/index.vue` — 健康概况 + 趋势改用状态化渲染
- `src/pages/health-trend/index.vue` — 复用状态机渲染
- 相关 spec（若首页/详情有断言文件，同步更新）

## Task 1: 六态状态机纯函数（TDD）

**Interfaces:**
- `HealthDisplayState = 'not_connected' | 'connecting' | 'no_data' | 'has_data' | 'stale' | 'error'`
- `deriveHealthState(raw, now, staleThresholdMs): HealthOverviewSnapshot`
- 输入 `raw`：`{ sourceStatus, metrics, trend, updatedAt }`

- [ ] 写失败测试：六态各自触发 + 优先级（connecting/error 优先）+ 过期阈值（>24h 为 stale、≤24h 为 has_data、null 时间不判过期）+ 非 has_data/stale 时 metrics/trend 清空 + 默认 not_connected。
- [ ] 跑 vitest 确认 RED。
- [ ] 实现纯函数。
- [ ] 跑 vitest 确认 GREEN。

## Task 2: Provider 接口 + Mock 实现（TDD）

**Interfaces:**
- `HealthDataProvider.getOverview(): Promise<HealthOverviewSnapshot>`（可 reject，抛 `ApiError`/`Error`）
- `MockHealthDataProvider`：复用 `mock/data.ts` 的 `healthMetrics` 与 `heartRateTrend`；暴露 `setState(...)`（仅开发/测试期）。
- 默认返回 `not_connected` 完整快照（含 `sourceStatus:'unavailable'`、`isDemo:false`、`message:'尚未接入硬件'`）。

- [ ] 写失败测试：默认 `not_connected` 且字段完整；`setState('has_data')` 返回含 metrics+trend 快照且 `isDemo:true`；`setState('stale')` 过期态且 `isDemo:true`；`setState('error')` 抛异常；`setState('connecting')` 不被 Provider 支持（连接中由 composable 派生）。
- [ ] 跑 vitest 确认 RED。
- [ ] 实现 Provider + Mock。
- [ ] 跑 vitest 确认 GREEN。

## Task 3: useHealthData 编排（TDD）

**Interfaces:**
- `useHealthData(provider)` 返回响应式 `{ state, snapshot, loading, reload }`。
- 调用前 `loading=true`（界面 `connecting`）；settle 后按结果/异常进对应状态。
- **错误映射**：`ApiError.code === 'health_data_source_unavailable'` → `not_connected`；其他异常 → `error`；均保留 `message`。
- `reload()`：重新调用 `getOverview()` 并更新快照（供「导入/清除模拟数据」按钮点击后刷新）。

- [ ] 写失败测试：loading 期间为 connecting；resolve 后为 has_data；普通异常 reject 为 error 且保留 message；`ApiError(code='health_data_source_unavailable')` 为 not_connected；异常不吞信息；`reload()` 触发二次 getOverview 并更新快照。
- [ ] 跑 vitest 确认 RED。
- [ ] 实现 composable。
- [ ] 跑 vitest 确认 GREEN。

## Task 4: 页面接入（TDD）

**Interfaces:**
- 首页健康概况区块：按 `state` 渲染，`has_data`/`stale` 显示指标 + 「演示数据」，其余显示空态文案、不显示数值。
- 首页趋势区块：`has_data`/`stale` 才绘制曲线并显示「演示数据」，其余空态。
- `health-trend` 详情页：复用 `useHealthData`，`has_data`/`stale` 渲染曲线/统计/每日数值，其余空态。
- 首页健康概况卡内按钮：`not_connected` 显示「导入模拟数据」、`has_data`/`stale` 显示「清除模拟数据」；按钮下方固定免责小字；点击后调用 `setState` + `reload`。趋势卡不放按钮。

- [ ] 写失败测试（源码字符串断言）：验证首页/详情不再直接 import 健康 mock 常量；各状态文案；「演示数据」仅出现在有数据态；「导入模拟数据」仅在 not_connected、「清除模拟数据」仅在 has_data/stale 分支出现；免责小字存在；`reload` 被按钮事件调用。
- [ ] 跑 vitest 确认 RED。
- [ ] 实现页面改造。
- [ ] 跑 vitest 确认 GREEN。

## Task 5: 验证与收口

- [ ] `npm test` 全绿。
- [ ] `npm run type-check` exit 0。
- [ ] `npm run build:mp-weixin` DONE。
- [ ] `git diff --check` 干净；确认无后端/其他应用/共享层改动；无依赖变更。
- [ ] 更新 `docs/progress.md`，区分「六态状态化已实现」与「真实硬件未接入」。
- [ ] 提交 `feat(guardian-frontend): stateful health display`（只提交前端 + 文档）。
