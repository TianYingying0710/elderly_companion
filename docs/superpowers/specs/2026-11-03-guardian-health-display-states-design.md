# 监护人端健康展示状态化设计（补充）

日期：2026-11-03

> 本文是 `2026-11-03-guardian-health-data-contract-design.md` 的前端展示层补充。
> 契约文档定义了「数据源可用/不可用」的 DTO 边界；本文进一步定义页面如何面向「未来硬件接入后的真实使用场景」做状态化展示，同时不伪造真实健康数据。

## 意图

把首页健康概况、近 7 天趋势，以及 `health-trend` 详情页，从「直接读取 mock 常量」改造为「通过可替换的 HealthDataProvider 获取数据并渲染明确状态」。当前无硬件、无后端健康接口，因此用一个 mock Provider 驱动六种状态，用于演示未来硬件接入后的界面表现；不新增后端、不接真实 API、不新增硬件控制按钮。

> 修订（2026-11-03）：用户要求「未接入硬件」态不能是死空态，需提供「导入模拟数据」按钮让用户进入 `has_data` 态查看演示效果，并提供「清除模拟数据」按钮回到 `not_connected`。此修订**替代**原「不暴露状态切换入口到生产页面」约束——按钮仅切换 mock Provider 的演示态，不涉及真实硬件绑定。

## 六种状态定义

六态由以下输入按**固定优先级**派生：

```text
请求未完成（loading）          → connecting  正在连接
请求抛出异常                    → error       数据异常
source_status = unavailable   → not_connected  未接入硬件
source_status = available 且 metrics 为空     → no_data     已连接但暂无数据
source_status = available 且 updated_at 过期   → stale       数据过期
source_status = available 且 有效数据          → has_data    已连接且有数据
```

优先级从上到下递减，`connecting` 与 `error` 优先于一切 `source_status` 派生；`source_status` 派生中 `unavailable` 优先于 `available`。

### 各状态展示规则

| 状态 | 显示数值 | 更新时间显示 | 可点击 | 数据标识 |
|---|---|---|---|---|
| `not_connected` 未接入硬件 | 否 | 不显示 | 无 | 无 |
| `connecting` 正在连接 | 否 | 不显示 | 无 | 无 |
| `no_data` 已连接暂无数据 | 否 | 显示「暂无数据」 | 无 | 无 |
| `has_data` 已连接有数据 | **是** | 显示 `updatedAt`（原样） | 可点趋势卡片进详情 | **「演示数据」** |
| `stale` 数据过期 | 是（弱化） | 显示过期时间 + 过期标记 | 可点趋势卡片 | **「演示数据」** |
| `error` 数据异常 | 否 | 不显示 | 无 | 无 |

### 关键约定

- **默认状态为 `not_connected`（未接入硬件）**，避免用户误以为已有真实数据。
- 只有 `has_data` 与 `stale` 显示数值，且必须标注「演示数据」。
- `updatedAt` 只展示 Provider 提供的值，前端不拼接伪造时间。
- 不新增任何「连接硬件」「刷新」「重试」「绑定设备」按钮——真实硬件接入仍不在本轮范围。
- **仅新增「导入模拟数据」/「清除模拟数据」两个按钮**（详见下文「演示数据导入/清除按钮」一节），它们只操作 mock Provider 的演示态，不代表真实硬件绑定。

## 过期阈值（明确定义）

- 时间统一使用**带时区的 ISO 8601**（如 `2026-11-03T08:20:00+08:00`）。
- 过期判定：`当前时间 - updatedAt > 24 小时 ⇒ stale`。
- 阈值（24 小时）作为状态机函数的可注入参数，便于单测覆盖边界；生产默认 24 小时。
- `updatedAt` 为 `null` 时不判定过期（此时若 `metrics` 非空仍属 `has_data`，但 `null` 时间只显示「暂无更新时间」而非伪造时间）。

## 趋势数据（纳入契约）

首页与 `health-trend` 需要绘制近 7 天曲线，`HealthOverviewSnapshot` 必须包含趋势序列，不能只有 `metrics`。

```ts
export interface HealthTrendPointDto {
  dateLabel: string   // 如 '10-28'
  value: number       // 次/分
}

export interface HealthOverviewSnapshot {
  state: HealthDisplayState
  metrics: HealthMetric[]            // 仅 has_data / stale 非空
  trend: HealthTrendPointDto[]       // 仅 has_data / stale 非空；其余状态为空数组
  updatedAt: string | null           // Provider 原样提供（带时区 ISO 8601 或 null）
  message: string | null             // 空态/异常提示文案
  sourceStatus: 'unavailable' | 'available'   // 透传契约字段，供状态机与未来 provider 复用
  isDemo: boolean                    // 是否演示数据：仅 has_data / stale 为 true（由 mock provider 标记）
}
```

- `trend` 复用现有 `heartRateTrend` 的 `{ dateLabel, value }` 结构（见 `types/index.ts` 的 `HeartRateTrendPoint`）。
- `has_data`/`stale` 才带非空 `trend`，其余状态 `trend = []`，页面据此决定是否绘制曲线。
- **`isDemo` 由 Provider 明确标记**：`has_data`/`stale` 态 `isDemo = true`，页面据此显示「演示数据」标签，不靠页面文案推断。未来真实 Provider 在非演示环境下 `isDemo = false`。
- 本轮不改变趋势数据结构，仅把它纳入 Provider 快照，供首页与详情页复用。

### 默认快照（未接入硬件）

`MockHealthDataProvider` 默认返回：

```ts
{
  state: 'not_connected',
  metrics: [],
  trend: [],
  updatedAt: null,
  message: '尚未接入硬件',
  sourceStatus: 'unavailable',
  isDemo: false,
}
```

该默认快照同时满足「默认 not_connected」与「快照字段完整」两个要求。

## 数据流

```
页面 (首页 / health-trend)
  → useHealthData composable（loading 编排 + 状态机）
  → HealthDataProvider 接口
      ├─ MockHealthDataProvider（本轮唯一实现，驱动 6 状态，可切，仅开发/测试期）
      └─ (未来) ApiHealthDataProvider → api/healthData → 后端 → 硬件适配器
```

- 页面只依赖 `HealthDataProvider` 接口，不直接 import `mock/data.ts` 的健康字段。
- `MockHealthDataProvider` 复用现有 `mock/data.ts` 的 `healthMetrics` 与 `heartRateTrend` 作「有数据」态来源，封装在 Provider 内部，页面看不到 mock 常量。
- 未来硬件接入时，新增 `ApiHealthDataProvider`（调用已存在的 `getHealthOverview` + `mapHealthOverview`），页面与状态机零改动。

## Provider 接口与错误处理（明确定义）

```ts
// data/healthDataProvider.ts
export interface HealthDataProvider {
  /**
   * 返回六态快照；数据源接入失败时抛出结构化错误。
   * - 不抛异常：调用方按 snapshot.state 渲染（含 not_connected/no_data/has_data/stale）。
   * - 抛异常：抛出 ApiError（复用 api/client.ts），由 useHealthData 捕获并转换为 error 状态。
   */
  getOverview(): Promise<HealthOverviewSnapshot>
}
```

### connecting 的触发来源（明确定义）

`connecting` 不由 Provider 返回，而由 **`useHealthData` 在请求未完成期间派生**：

- `useHealthData` 内部维护 `loading: boolean`。
- 调用 `getOverview()` 前 `loading = true`，此时界面状态为 `connecting`。
- `getOverview()` settle（resolve 或 reject）后 `loading = false`，再按结果进入对应状态。

`connecting` 只在「Provider 的 Promise 尚未 settle」时存在；Provider 本身不返回 `connecting` 快照。

### error 的转换与优先级（明确定义）

- Provider 的 `getOverview()` 允许 reject，抛出 `ApiError`（复用 `api/client.ts`）或任意 `Error`。
- `useHealthData` 用 `try/catch` 捕获异常，按以下**优先级**转换：

```text
ApiError.code === 'health_data_source_unavailable'  → not_connected（数据源未接入，非故障）
其他 ApiError / 普通 Error                           → error（数据异常）
```

- `error` 状态保留可展示的 `message`（`ApiError.message` 或兜底文案），不吞掉异常信息。
- `health_data_source_unavailable` 被识别为「未接入」而非「异常」，与契约文档「数据源未接入返回结构化 503，不降级为错误空态」一致。

## 状态机（纯函数，可单测）

```ts
// domain/healthDataState.ts
export type HealthDisplayState =
  | 'not_connected'
  | 'connecting'
  | 'no_data'
  | 'has_data'
  | 'stale'
  | 'error'

export interface HealthOverviewSnapshot {
  state: HealthDisplayState
  metrics: HealthMetric[]
  trend: HealthTrendPointDto[]
  updatedAt: string | null
  message: string | null
  sourceStatus: 'unavailable' | 'available'
  isDemo: boolean
}

/** 原始 Provider 结果（DTO 语义），deriveHealthState 的输入 */
export interface HealthOverviewRaw {
  sourceStatus: 'unavailable' | 'available'
  metrics: HealthMetric[]
  trend: HealthTrendPointDto[]
  updatedAt: string | null
}

export function deriveHealthState(
  raw: HealthOverviewRaw,
  now: Date,
  staleThresholdMs: number,
): HealthOverviewSnapshot
```

> 说明：`deriveHealthState` 派生 `state` 与 `isDemo`（仅 `has_data`/`stale` 为 true），`sourceStatus` 原样透传。`connecting`/`error` 不在 `deriveHealthState` 内派生（由 `useHealthData` 编排层决定），但它们仍会以 `state` 形式出现在最终快照。

`deriveHealthState` 是唯一的状态派生入口，六态优先级、过期阈值、数值裁剪（非 has_data/stale 时清空 metrics/trend）全部集中在此，方便 vitest 逐一覆盖。

## 演示数据导入/清除按钮

用户从「未接入硬件」空态需要一个可见的下一步动作，否则体验是死的。因此引入两个按钮，只作用于 mock 演示态。

### 交互流程

```text
not_connected（默认）
  健康概况卡：空态文案「尚未接入硬件」 + [导入模拟数据] 按钮
  趋势卡：空态文案（无按钮，随概况卡联动）
        ↓ 点击 [导入模拟数据]
has_data（有数据）
  健康概况卡：三项指标 + 「演示数据」标签 + [清除模拟数据] 按钮
  趋势卡：曲线 + 「演示数据」标签
        ↓ 点击 [清除模拟数据]
not_connected（回到未接入硬件）
```

### 按钮规则

| 项 | 规则 |
|---|---|
| 按钮位置 | 仅在**健康概况卡**内；趋势卡不放按钮（避免两个入口重复） |
| 「导入模拟数据」显示条件 | 仅 `not_connected` 态 |
| 「清除模拟数据」显示条件 | 仅 `has_data` / `stale` 态 |
| `connecting`/`no_data`/`error` | 不显示任何按钮 |
| 按钮下方固定小字 | 「模拟数据仅用于演示，不代表真实健康数据」 |
| 数据流向 | 按钮只调用 `MockHealthDataProvider.setState('has_data')` / `setState('not_connected')`，再触发 `useHealthData.reload()` 重新获取快照；不碰后端、不碰真实 API |

### 与 setState 的关系

- `MockHealthDataProvider.setState()` 仍然是唯一的状态切换入口，但现在通过**页面按钮**间接调用，而非仅测试/开发期手动调用。
- 按钮在页面里**通过 Provider 接口类型**持有的是 `MockHealthDataProvider` 实例，才能调用 `setState`；未来接真实 `ApiHealthDataProvider` 时，这两个按钮**应被移除或替换**（真实硬件接入的绑定流程不在本轮设计），因为 `ApiHealthDataProvider` 不提供 `setState`。
- 为避免把 mock 能力泄漏进接口：`HealthDataProvider` 接口**只声明 `getOverview()`**；`setState` 与 `reload` 相关能力由 `MockHealthDataProvider` 与 `useHealthData` 各自暴露，页面在「演示环境」下通过类型收窄访问。

### 今日提醒卡的边界（方案 A，已确认）

- 「今日提醒」是软件侧功能（服药/散步提醒），不依赖健康硬件，因此**不受六态状态机管辖**，未接入硬件时**照常显示**。
- 不在提醒卡上额外标注「与硬件无关」等字样，保持简洁。

## 开发/测试期的状态切换（与生产隔离）

- `MockHealthDataProvider` 提供一个 `setState(state: HealthDisplayState)` 方法，用于测试/开发期手动切换六态，以及供页面「导入/清除模拟数据」按钮调用。
- 页面通过 `HealthDataProvider` 接口调用 `getOverview()`；`setState` 只在演示环境由 `MockHealthDataProvider` 实例暴露。
- 生产默认 `not_connected`；测试通过 `new MockHealthDataProvider()` 后调用 `setState(...)` 验证各态渲染。

## 范围与复用

- **首页** `pages/index/index.vue`：健康概况区块 + 近 7 天趋势区块，改用 `useHealthData` 渲染状态化内容。
- **健康趋势详情** `pages/health-trend/index.vue`：复用同一 `useHealthData` 与状态机，按状态渲染（`has_data`/`stale` 显示曲线与统计，其余显示空态）。不新建页面。
- 不新增四个重复页面；六种状态通过同一状态机 + 同一 Provider 复用，不写重复分支代码。

## 非目标

- 不接入蓝牙、硬件 SDK、数据库、认证、外部服务。
- 不新增后端接口；不调用真实 `/api/v1/health-overview`（本轮 Provider 是 mock）。
- 不新增医疗判断、诊断结论、虚构告警或未经批准的健康建议。
- 不新增硬件控制按钮（不新增「连接硬件」「绑定设备」「重试」）；仅允许「导入模拟数据」/「清除模拟数据」两个演示态切换按钮。
- 不安装、升级或删除依赖。

## 与既有契约的关系

- 复用 `types/healthData.ts` 的 `HealthOverviewModel`（`sourceStatus`、`updatedAt`、`metrics`）作为 Provider 内部的数据载体。
- 复用 `types/index.ts` 的 `HealthMetric`、`HeartRateTrendPoint`。
- 复用 `mappers/healthDataMapper.ts` 的 `heart_rate → heartRate` 映射（供未来 `ApiHealthDataProvider` 使用，本轮不调用）。
- 复用 `domain/secondaryNavigation.ts` 的导航锁与失败提示。
