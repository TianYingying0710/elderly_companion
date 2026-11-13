# 老人端「我的求助」接真实 SOS 列表 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** api 模式下老人端「我的求助」页读取并展示真实 SOS 事件列表，零后端改动、零契约变更，mock/演示行为完全不变。

**Architecture:** 沿用现有 SOS 分层做纯加法：`types/sos.ts`（DTO）→ `domain/sosStatus.ts`（状态文案单一来源）→ `mappers/sosMapper.ts`（DTO → `RequestRecord`）→ `data/sosProvider.ts` 新增 `list()` → `composables/useSos.ts` 新增 `apiRequests`/`loadRequests` → `useElderApp` 暴露 `openRequests` → `RequestsPage.vue` 渲染。不重构现有 `create()`/`get()` 语义，不新建后端链路。

**Tech Stack:** Vue 3 + TypeScript + Vite + Vitest；FastAPI（仅作为既有契约消费方，不改动）。

**Spec:** `docs/api.md` 的 `GET /api/v1/sos-events` 契约；边界遵循 `AGENTS.md`。

## Global Constraints

- 禁止安装任何依赖，禁止修改 `package.json` / lockfile。
- 零后端改动、零契约变更：只消费既有 `GET /api/v1/sos-events?elder_id=elder-001`。
- mock/演示分支行为必须不变；api 分支只由 `provider.mode === 'api'`（页面用 `app.isSosApi`）门控。
- 既有 SOS 上报（`create`）与状态刷新（`get`）语义不变；除共享 `ELDER_ID` 常量和状态文案外，不做结构重构。
- 仅 `src/data/sosProvider.ts`（现有 SOS HTTP 边界）持有 HTTP 路径；页面和 composable 不得出现 URL。
- 后端不提供逐次处置时间轴：页面只展示创建时间、创建备注和后端当前状态，不得伪造中间步骤。
- TDD：每个任务先写失败测试，再实现。
- 允许本地提交，禁止推送。
- 不碰 code1 后端、code2/code3、健康数据、501 骨架、认证/通知/RAG/设备能力。
- 测试在主仓库 `E:/c2--/code` 运行；`node_modules` 已存在。

## Risk Controls

| 风险 | 控制措施 | 验证 |
|---|---|---|
| 演示分支回归 | api 分支页面与 mock 分支完全分离；mock 分支标记不改；`loadRequests` 在 mock 下早退 | 页面集成测试断言 mock 文案且 `fetch` 未被调用 |
| SOS 发送/刷新链路回归 | 不改状态机、`create()`、`get()` 行为；只加 `list()` 与共享常量/文案 | 既有 `useSos.spec.ts` 全绿 |
| 伪造处置时间轴 | 每个事件只生成一条“创建备注”时间轴；当前状态用状态徽章展示 | mapper 测试固定输出 |
| 失败被误显示为空 | `requestsLoading` / `requestsFailed` / 空数组三态分离 | api 失败集成测试断言不出现「暂无求助记录」 |
| 入口遗漏 | 只改「我的」菜单与 SOS 完成按钮；消息详情按钮仍指向演示记录 | 集成测试从「我的」进入；SOS 页面按钮改为 `openRequests()` |
| 非法响应污染页面 | provider 严格校验数组与每个字段 | provider 测试覆盖非数组/坏元素/非 2xx |
| 既有 HTTP 层债务 | 接受现状：SOS 的 fetch 仍在 provider；本切片不抽 API 文件，避免扰动 | 计划外后续任务可抽 `api/elderSos.ts` |

---

### Task 1: SOS DTO、状态文案与记录映射

**Files:**
- Create: `code1-elder/frontend/src/types/sos.ts`
- Create: `code1-elder/frontend/src/domain/sosStatus.ts`
- Create: `code1-elder/frontend/src/mappers/sosMapper.ts`
- Test: `code1-elder/frontend/src/mappers/sosMapper.spec.ts`
- Modify: `code1-elder/frontend/src/composables/useSos.ts:2,6-7`

**Interfaces:**
- Consumes: `RequestRecord`（`types/domain.ts`）
- Produces:
  - `SOS_EVENT_STATUSES: readonly ['pending','processing','resolved']`
  - `type SosEventStatus`
  - `interface SosEventDto { id:string; elder_id:string; created_at:string; status:SosEventStatus; note:string|null }`
  - `SOS_STATUS_TITLES: Record<SosEventStatus,string>`
  - `sosStatusTitle(status:SosEventStatus): string`
  - `formatSosTime(iso:string): string`
  - `toRequestRecord(dto:SosEventDto): RequestRecord`
  - `toRequestRecords(dtos:SosEventDto[]): RequestRecord[]`

- [ ] **Step 1: Write the failing mapper test**

Create `code1-elder/frontend/src/mappers/sosMapper.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { SosEventDto } from '../types/sos'
import { formatSosTime, toRequestRecord, toRequestRecords } from './sosMapper'

const event: SosEventDto = {
  id: 'sos-1', elder_id: 'elder-001', created_at: '2026-11-13T02:03:00Z',
  status: 'processing', note: '家人已联系',
}

describe('sos history mapper', () => {
  it('maps an event to a request record with status copy and note timeline', () => {
    expect(toRequestRecord(event)).toEqual({
      id: 'sos-1',
      title: '软件 SOS 求助',
      time: '11-13 10:03',
      state: '处理中 · 家人/社区已介入',
      timeline: [['11-13 10:03', '家人已联系']],
    })
  })

  it('uses an honest timeline entry when the backend note is absent', () => {
    expect(toRequestRecord({ ...event, note: null }).timeline).toEqual([['11-13 10:03', '事件已上报']])
  })

  it('maps every backend status to the same copy used by the SOS page', () => {
    expect(toRequestRecord({ ...event, status: 'pending' }).state).toBe('已上报 · 等待处理')
    expect(toRequestRecord({ ...event, status: 'processing' }).state).toBe('处理中 · 家人/社区已介入')
    expect(toRequestRecord({ ...event, status: 'resolved' }).state).toBe('已解决')
  })

  it('sorts newest first without mutating the input array', () => {
    const older = { ...event, id: 'old', created_at: '2026-11-12T00:00:00Z' }
    const newer = { ...event, id: 'new', created_at: '2026-11-14T00:00:00Z' }
    const input = [older, newer]
    expect(toRequestRecords(input).map((item) => item.id)).toEqual(['new', 'old'])
    expect(input.map((item) => item.id)).toEqual(['old', 'new'])
  })

  it('formats in Asia/Shanghai and returns an empty string for invalid input', () => {
    expect(formatSosTime('2026-11-13T02:03:00Z')).toBe('11-13 10:03')
    expect(formatSosTime('not-a-date')).toBe('')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd E:/c2--/code/code1-elder/frontend
npm test -- src/mappers/sosMapper.spec.ts
```

Expected: FAIL — cannot resolve `./sosMapper` / `../types/sos`.

- [ ] **Step 3: Add the DTO type**

Create `code1-elder/frontend/src/types/sos.ts`:

```ts
/** SOS 求助事件 DTO：与 code1-elder 后端 schemas/sos_events.py 对齐（snake_case）。 */

export const SOS_EVENT_STATUSES = ['pending', 'processing', 'resolved'] as const

export type SosEventStatus = (typeof SOS_EVENT_STATUSES)[number]

export interface SosEventDto {
  id: string
  elder_id: string
  created_at: string
  status: SosEventStatus
  note: string | null
}
```

- [ ] **Step 4: Add the shared status copy**

Create `code1-elder/frontend/src/domain/sosStatus.ts`:

```ts
/** SOS 状态文案单一来源：老人端进度页与求助记录页共用。 */

import type { SosEventStatus } from '../types/sos'

export const SOS_STATUS_TITLES: Record<SosEventStatus, string> = {
  pending: '已上报 · 等待处理',
  processing: '处理中 · 家人/社区已介入',
  resolved: '已解决',
}

export function sosStatusTitle(status: SosEventStatus): string {
  return SOS_STATUS_TITLES[status]
}
```

- [ ] **Step 5: Add the mapper**

Create `code1-elder/frontend/src/mappers/sosMapper.ts`:

```ts
import { sosStatusTitle } from '../domain/sosStatus'
import type { RequestRecord } from '../types/domain'
import type { SosEventDto } from '../types/sos'

/** ISO 时间 → MM-DD HH:mm（东八区）；非法时间返回空串 */
export function formatSosTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: 'month' | 'day' | 'hour' | 'minute') =>
    parts.find((item) => item.type === type)?.value ?? ''
  return `${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`
}

/**
 * 后端事件 → 老人端求助记录。
 * 后端只存创建时间与当前状态，没有逐次处置历史；
 * 因此时间轴只展示创建备注，当前状态由 state 字段单独展示。
 */
export function toRequestRecord(dto: SosEventDto): RequestRecord {
  const time = formatSosTime(dto.created_at)
  return {
    id: dto.id,
    title: '软件 SOS 求助',
    time,
    state: sosStatusTitle(dto.status),
    timeline: [[time, dto.note ?? '事件已上报']],
  }
}

/** 按创建时间倒序；非法时间排到最后；不修改入参 */
export function toRequestRecords(dtos: SosEventDto[]): RequestRecord[] {
  const parsed = (iso: string) => {
    const value = Date.parse(iso)
    return Number.isNaN(value) ? 0 : value
  }
  return [...dtos]
    .sort((a, b) => parsed(b.created_at) - parsed(a.created_at))
    .map(toRequestRecord)
}
```

- [ ] **Step 6: Point the existing SOS page copy at the shared source**

Modify `code1-elder/frontend/src/composables/useSos.ts`:

1. Add the import after the provider import:

```ts
import { sosStatusTitle } from '../domain/sosStatus'
```

2. Delete this line:

```ts
const STATUS_TITLES:Record<string,string>={pending:'已上报 · 等待处理',processing:'处理中 · 家人/社区已介入',resolved:'已解决'}
```

3. Replace the label lookup inside `refreshStatus`:

```ts
const title=STATUS_TITLES[status]??status
```

with:

```ts
const title=sosStatusTitle(status)
```

- [ ] **Step 7: Run the mapper and existing SOS tests**

```bash
cd E:/c2--/code/code1-elder/frontend
npm test -- src/mappers/sosMapper.spec.ts src/composables/useSos.spec.ts
```

Expected: all pass; the existing `refreshStatus` test still expects `处理中`.

- [ ] **Step 8: Commit**

```bash
git -C E:/c2--/code add code1-elder/frontend/src/types/sos.ts code1-elder/frontend/src/domain/sosStatus.ts code1-elder/frontend/src/mappers/sosMapper.ts code1-elder/frontend/src/mappers/sosMapper.spec.ts code1-elder/frontend/src/composables/useSos.ts
git -C E:/c2--/code commit -m "feat(sos): map sos events into request history records"
```

---

### Task 2: Provider `list()` 读取真实事件

**Files:**
- Modify: `code1-elder/frontend/src/data/sosProvider.ts`
- Test: `code1-elder/frontend/src/data/sosProvider.spec.ts`

**Interfaces:**
- Consumes: `SosEventDto`、`SOS_EVENT_STATUSES`（Task 1）、`toRequestRecords`（Task 1）
- Produces: `SosProvider.list(): Promise<RequestRecord[]>`

- [ ] **Step 1: Write the failing provider test**

Create `code1-elder/frontend/src/data/sosProvider.spec.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiSosProvider, createMockSosProvider } from './sosProvider'

afterEach(() => vi.unstubAllGlobals())

const event = (id: string, createdAt: string, status = 'processing') => ({
  id, elder_id: 'elder-001', created_at: createdAt, status, note: null,
})

describe('sos provider list', () => {
  it('reads elder-001 events and maps newest first', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([
      event('old', '2026-11-12T00:00:00Z'),
      event('new', '2026-11-14T00:00:00Z'),
    ]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const records = await createApiSosProvider('http://mock-api').list()

    expect(fetchMock).toHaveBeenCalledWith('http://mock-api/api/v1/sos-events?elder_id=elder-001')
    expect(records.map((item) => item.id)).toEqual(['new', 'old'])
    expect(records[0]).toMatchObject({
      title: '软件 SOS 求助',
      state: '处理中 · 家人/社区已介入',
      time: '11-14 08:00',
    })
  })

  it('rejects a non-array payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })))
    await expect(createApiSosProvider('http://mock-api').list()).rejects.toThrow('求助记录响应格式异常')
  })

  it('rejects a malformed event element', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{}]), { status: 200 })))
    await expect(createApiSosProvider('http://mock-api').list()).rejects.toThrow('SOS 事件响应格式异常')
  })

  it('surfaces non-2xx responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })))
    await expect(createApiSosProvider('http://mock-api').list()).rejects.toThrow('求助记录加载失败（HTTP 503）')
  })

  it('returns an empty list in mock mode without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(createMockSosProvider().list()).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd E:/c2--/code/code1-elder/frontend
npm test -- src/data/sosProvider.spec.ts
```

Expected: FAIL — `list` is not a function / not in the provider type.

- [ ] **Step 3: Extend the provider**

Modify `code1-elder/frontend/src/data/sosProvider.ts`:

1. Add imports at the top:

```ts
import { toRequestRecords } from '../mappers/sosMapper'
import type { RequestRecord } from '../types/domain'
import { SOS_EVENT_STATUSES, type SosEventDto, type SosEventStatus } from '../types/sos'
```

2. Remove the local type line:

```ts
export type SosEventStatus = 'pending' | 'processing' | 'resolved'
```

3. Add the shared elder id constant after `elderApiBaseUrl`:

```ts
const ELDER_ID = 'elder-001'
```

4. Add `list` to `SosProvider`:

```ts
  /** 真实求助记录列表；mock 模式返回空数组 */
  list: () => Promise<RequestRecord[]>
```

5. Add the parser after `parseStatus`:

```ts
function parseSosEvent(raw: unknown): SosEventDto {
  const record = raw as Partial<SosEventDto> | null
  if (
    record === null ||
    typeof record.id !== 'string' ||
    record.id.length === 0 ||
    typeof record.elder_id !== 'string' ||
    typeof record.created_at !== 'string' ||
    typeof record.status !== 'string' ||
    !(SOS_EVENT_STATUSES as readonly string[]).includes(record.status) ||
    !(typeof record.note === 'string' || record.note === null)
  ) {
    throw new Error('SOS 事件响应格式异常')
  }
  return {
    id: record.id,
    elder_id: record.elder_id,
    created_at: record.created_at,
    status: record.status as SosEventStatus,
    note: record.note,
  }
}
```

6. Replace both literal `elder-001` occurrences in `create` and `get` with `ELDER_ID`:

```ts
body: JSON.stringify({ elder_id: ELDER_ID, note: '软件 SOS（演示环境触发）' }),
```

```ts
const response = await fetch(`${baseUrl}/api/v1/sos-events?elder_id=${encodeURIComponent(ELDER_ID)}`)
```

7. Add `list` to the api provider after `get`:

```ts
    list: async () => {
      const response = await fetch(`${baseUrl}/api/v1/sos-events?elder_id=${encodeURIComponent(ELDER_ID)}`)
      if (!response.ok) {
        throw new Error(`求助记录加载失败（HTTP ${response.status}）`)
      }
      const raw = await response.json()
      if (!Array.isArray(raw)) throw new Error('求助记录响应格式异常')
      return toRequestRecords(raw.map(parseSosEvent))
    },
```

8. Add `list` to the mock provider:

```ts
    list: async () => [],
```

- [ ] **Step 4: Run the provider and SOS tests**

```bash
cd E:/c2--/code/code1-elder/frontend
npm test -- src/data/sosProvider.spec.ts src/composables/useSos.spec.ts
```

Expected: all pass; existing create/get behavior unchanged.

- [ ] **Step 5: Commit**

```bash
git -C E:/c2--/code add code1-elder/frontend/src/data/sosProvider.ts code1-elder/frontend/src/data/sosProvider.spec.ts
git -C E:/c2--/code commit -m "feat(sos): add real request history list to provider"
```

---

### Task 3: Composable 编排、页面入口与状态

**Files:**
- Modify: `code1-elder/frontend/src/composables/useSos.ts`
- Modify: `code1-elder/frontend/src/composables/useSos.spec.ts`
- Modify: `code1-elder/frontend/src/composables/useElderApp.ts`
- Modify: `code1-elder/frontend/src/composables/useElderApp.spec.ts`
- Modify: `code1-elder/frontend/src/pages/account/AccountHomePage.vue`
- Modify: `code1-elder/frontend/src/pages/SosPage.vue`

**Interfaces:**
- Consumes: `SosProvider.list()`（Task 2）
- Produces:
  - `loadRequests(): Promise<void>`
  - state fields `apiRequests: RequestRecord[]`、`requestsLoading: boolean`、`requestsFailed: boolean`
  - `useElderApp().openRequests(): void`

- [ ] **Step 1: Write the failing composable tests**

Modify `code1-elder/frontend/src/composables/useSos.spec.ts`:

1. Change the import line to add `afterEach`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
```

2. Add this reset block after the imports:

```ts
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
```

3. Extend `makeState()` with the history fields:

```ts
    currentRequest: null as any,
    apiRequests: [] as any[],
    requestsLoading: false,
    requestsFailed: false,
```

4. Append this describe block at the end of the file:

```ts
describe('useSos request history', () => {
  it('loads api history and clears loading/failure flags', async () => {
    vi.stubEnv('VITE_SOS_DATA_MODE', 'api')
    vi.stubEnv('VITE_ELDER_API_BASE_URL', 'http://mock-api')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([
      { id: 'sos-42', elder_id: 'elder-001', created_at: '2026-11-13T02:03:00Z', status: 'pending', note: '已按SOS按钮' },
    ]), { status: 200 })))
    vi.resetModules()
    const { useSos: freshUseSos } = await import('./useSos')
    const state = makeState()
    const sos = freshUseSos(state, () => {})

    await sos.loadRequests()

    expect(state.apiRequests).toHaveLength(1)
    expect(state.apiRequests[0]).toMatchObject({ id: 'sos-42', state: '已上报 · 等待处理' })
    expect(state.requestsLoading).toBe(false)
    expect(state.requestsFailed).toBe(false)
    expect(state.feedback).toBe('')
  })

  it('clears stale history, marks failure and keeps the provider message', async () => {
    vi.stubEnv('VITE_SOS_DATA_MODE', 'api')
    vi.stubEnv('VITE_ELDER_API_BASE_URL', 'http://mock-api')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })))
    vi.resetModules()
    const { useSos: freshUseSos } = await import('./useSos')
    const state = makeState()
    state.apiRequests = [{ id: 'old' }]
    const sos = freshUseSos(state, () => {})

    await sos.loadRequests()

    expect(state.apiRequests).toEqual([])
    expect(state.requestsLoading).toBe(false)
    expect(state.requestsFailed).toBe(true)
    expect(state.feedback).toBe('求助记录加载失败（HTTP 503）')
  })

  it('does nothing in mock mode', async () => {
    vi.stubEnv('VITE_SOS_DATA_MODE', 'mock')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.resetModules()
    const { useSos: freshUseSos } = await import('./useSos')
    const state = makeState()
    const sos = freshUseSos(state, () => {})

    await sos.loadRequests()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(state.apiRequests).toEqual([])
    expect(state.requestsLoading).toBe(false)
    expect(state.requestsFailed).toBe(false)
  })
})
```

5. Append this navigation test to `code1-elder/frontend/src/composables/useElderApp.spec.ts`:

```ts
it('opens the request history page through the app entry', () => {
  const app = useElderApp()
  app.openRequests()
  expect(app.state.page).toBe('requests')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd E:/c2--/code/code1-elder/frontend
npm test -- src/composables/useSos.spec.ts src/composables/useElderApp.spec.ts
```

Expected: FAIL — `loadRequests` / `openRequests` do not exist; history fields are uninitialised.

- [ ] **Step 3: Implement `loadRequests`**

Modify `code1-elder/frontend/src/composables/useSos.ts`. Insert this function after `refreshStatus` (before the `return`):

```ts
async function loadRequests(){
  if(provider.mode!=='api')return
  state.requestsLoading=true
  state.requestsFailed=false
  state.apiRequests=[]
  try{state.apiRequests=await provider.list()}
  catch(error){state.requestsFailed=true;state.feedback=error instanceof Error?error.message:'求助记录加载失败'}
  finally{state.requestsLoading=false}
}
```

Change the return statement to include `loadRequests`:

```ts
return{help,startHelp,progress,cancelHelp,refreshStatus,loadRequests,isSosApi:provider.mode==='api'}
```

- [ ] **Step 4: Wire the app state and entry**

Modify `code1-elder/frontend/src/composables/useElderApp.ts`:

1. Add the state fields after `apiHistory`:

```ts
    apiRequests: [] as RequestRecord[], requestsLoading: false, requestsFailed: false,
```

2. Destructure `loadRequests` from `useSos`:

```ts
  const {help,startHelp,progress,cancelHelp,refreshStatus,loadRequests,isSosApi}=useSos(state,go)
```

3. Add the entry function next to `openLearningHistory`:

```ts
  function openRequests(){go('requests');loadRequests()}
```

4. Add `openRequests` to the return object:

```ts
  return { state, go, back, toggleDemo, send, help, startHelp, progress, cancelHelp, refreshStatus, isSosApi, health, togglePermission, openConversation, isCourseApi: isApi, loadCourses, openApiCourse, recordProgress, openLearningHistory, openRequests }
```

- [ ] **Step 5: Route the two entry buttons through `openRequests`**

Modify `code1-elder/frontend/src/pages/account/AccountHomePage.vue` template: replace the menu click handler

```html
@click="app.go(item.page)"
```

with:

```html
@click="item.page==='requests'?app.openRequests():app.go(item.page)"
```

Modify `code1-elder/frontend/src/pages/SosPage.vue`: replace

```html
<button v-else class="primary" data-testid="help-records" @click="app.go('requests')">查看处理记录</button>
```

with:

```html
<button v-else class="primary" data-testid="help-records" @click="app.openRequests()">查看处理记录</button>
```

Do not change `MessageDetailPage.vue`; its button intentionally points at the demo record page.

- [ ] **Step 6: Run the composable tests**

```bash
cd E:/c2--/code/code1-elder/frontend
npm test -- src/composables/useSos.spec.ts src/composables/useElderApp.spec.ts
```

Expected: all pass; existing SOS send/refresh tests unchanged.

- [ ] **Step 7: Commit**

```bash
git -C E:/c2--/code add code1-elder/frontend/src/composables/useSos.ts code1-elder/frontend/src/composables/useSos.spec.ts code1-elder/frontend/src/composables/useElderApp.ts code1-elder/frontend/src/composables/useElderApp.spec.ts code1-elder/frontend/src/pages/account/AccountHomePage.vue code1-elder/frontend/src/pages/SosPage.vue
git -C E:/c2--/code commit -m "feat(sos): load request history through sos composable"
```

---

### Task 4: 「我的求助」页面渲染、集成测试与文档

**Files:**
- Modify: `code1-elder/frontend/src/pages/account/RequestsPage.vue`
- Test: `code1-elder/frontend/src/pages/request-history.spec.ts`（新建）
- Modify: `docs/progress.md`
- Modify: `HANDOVER.md`

**Interfaces:**
- Consumes: `app.isSosApi`、`app.state.apiRequests`、`app.state.requestsLoading`、`app.state.requestsFailed`、`app.openRequests()`
- Produces: 真实求助记录 UI；api/mock/失败/空态四分支

- [ ] **Step 1: Write the failing App-level test**

Create `code1-elder/frontend/src/pages/request-history.spec.ts`:

```ts
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../App.vue'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const realEvent = {
  id: 'sos-42', elder_id: 'elder-001', created_at: '2026-11-13T02:03:00Z',
  status: 'processing', note: '家人已联系',
}

async function openRequests() {
  const wrapper = mount(App)
  await wrapper.get('[data-testid="nav-me"]').trigger('click')
  await wrapper.get('[data-testid="requests"]').trigger('click')
  await flushPromises()
  return wrapper
}

it('api 模式展示真实求助记录、状态与备注', async () => {
  vi.stubEnv('VITE_SOS_DATA_MODE', 'api')
  vi.stubEnv('VITE_ELDER_API_BASE_URL', 'http://mock-api')
  const fetchMock = vi.fn(async () => new Response(JSON.stringify([realEvent]), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)

  const wrapper = await openRequests()

  expect(fetchMock).toHaveBeenCalledWith('http://mock-api/api/v1/sos-events?elder_id=elder-001')
  expect(wrapper.text()).toContain('软件 SOS 求助')
  expect(wrapper.text()).toContain('处理中 · 家人/社区已介入')
  expect(wrapper.text()).toContain('11-13 10:03')
  expect(wrapper.text()).toContain('家人已联系')
  wrapper.unmount()
})

it('api 模式没有记录时显示空态', async () => {
  vi.stubEnv('VITE_SOS_DATA_MODE', 'api')
  vi.stubEnv('VITE_ELDER_API_BASE_URL', 'http://mock-api')
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })))

  const wrapper = await openRequests()

  expect(wrapper.text()).toContain('暂无求助记录')
  wrapper.unmount()
})

it('api 模式加载失败时提示失败而非空态', async () => {
  vi.stubEnv('VITE_SOS_DATA_MODE', 'api')
  vi.stubEnv('VITE_ELDER_API_BASE_URL', 'http://mock-api')
  vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })))

  const wrapper = await openRequests()

  expect(wrapper.text()).toContain('求助记录加载失败，请稍后重试')
  expect(wrapper.text()).toContain('求助记录加载失败（HTTP 503）')
  expect(wrapper.text()).not.toContain('暂无求助记录')
  wrapper.unmount()
})

it('mock 模式保持演示记录且不发起请求', async () => {
  const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
  vi.stubGlobal('fetch', fetchMock)

  const wrapper = await openRequests()

  expect(wrapper.text()).toContain('模拟记录，无真实通知或人员响应')
  expect(wrapper.text()).toContain('· 模拟')
  expect(fetchMock).not.toHaveBeenCalled()
  wrapper.unmount()
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd E:/c2--/code/code1-elder/frontend
npm test -- src/pages/request-history.spec.ts
```

Expected: FAIL — api mode still renders the demo branch, so real status/note and failure/empty copy are absent.

- [ ] **Step 3: Add the api branch to `RequestsPage.vue`**

Replace the entire content of `code1-elder/frontend/src/pages/account/RequestsPage.vue` with:

```vue
<script setup lang="ts">import type {ElderApp} from '../../composables/useElderApp';defineProps<{app:ElderApp}>();</script>
<template><div class="content"><template v-if="app.isSosApi"><p class="demo-note">求助记录来自求助服务（演示环境）；状态为后端当前值。</p><p v-if="app.state.requestsLoading" class="empty">正在加载求助记录…</p><p v-else-if="app.state.requestsFailed" class="empty">求助记录加载失败，请稍后重试</p><template v-else-if="app.state.apiRequests.length > 0"><section v-for="item in app.state.apiRequests" :key="item.id" class="card"><h2>{{ item.title }}</h2><p class="muted">{{ item.time }}</p><span class="pill">{{ item.state }}</span><ol class="timeline"><li v-for="(event,i) in item.timeline" :key="i"><small>{{ event[0] }}</small><p>{{ event[1] }}</p></li></ol></section></template><p v-else class="empty">暂无求助记录</p></template><template v-else-if="app.state.data"><p class="demo-note">模拟记录，无真实通知或人员响应</p><section v-for="item in app.state.data.requests" :key="item.id" class="card"><h2>{{ item.title }}</h2><p class="muted">{{ item.time }}</p><span class="pill">{{ item.state }}</span><ol class="timeline"><li v-for="(event,i) in item.timeline" :key="i"><small>{{ event[0] }}</small><p>{{ event[1] }}</p></li></ol></section></template><p v-else class="empty">求助记录服务尚未接入</p></div></template>
```

Verify the conditional chain is adjacent: within the api branch `v-if` → `v-else-if` → `<template v-else-if>` → `v-else`; the outer chain is `isSosApi` → `data` → `v-else`, with nothing inserted between them.

- [ ] **Step 4: Run the App-level tests**

```bash
cd E:/c2--/code/code1-elder/frontend
npm test -- src/pages/request-history.spec.ts
```

Expected: all four pass.

- [ ] **Step 5: Update the docs**

In `docs/progress.md`, add this chapter directly below the leading `更新日期：2026-11-14` line:

```markdown
## 2026-11-14：老人端「我的求助」接真实 SOS 列表（前端切片）

- **功能**：api 模式（`VITE_SOS_DATA_MODE=api`）下，「我的求助」页通过 `GET /api/v1/sos-events?elder_id=elder-001` 读取真实事件，按创建时间倒序展示状态、创建时间与备注；加载中/失败/空态分别可见。mock 模式演示分支与 SOS 发送/刷新链路保持不变。
- **分层**：`types/sos.ts` 新增 DTO → `domain/sosStatus.ts` 统一状态文案 → `mappers/sosMapper.ts` 映射为 `RequestRecord` → `data/sosProvider.ts` 新增 `list()` → `composables/useSos.ts` 新增 `apiRequests`/`loadRequests` → `useElderApp` 暴露 `openRequests` → `RequestsPage.vue` 渲染。
- **边界**：零后端改动、零契约变更；后端不提供逐次处置时间轴，页面只展示创建备注与后端当前状态，不伪造中间步骤。
- **验证**：elder 前端 `npm test` 全过、`type-check` 0 错、`vite build` 通过；elder 后端 `pytest` 仍 53 项全过（具体新增用例数写入实现报告，不硬编码进文档）。
```

In `HANDOVER.md`:

1. Append to the §一 paragraph:

```text
老人端「我的求助」页已接真实 SOS 列表（零契约变更）。
```

2. Replace §四 items 1–4 with:

```markdown
1. **api 模式双端 SOS 人工联调（推荐）**：监护人端处置 → 老人端「求助进度」刷新与「我的求助」列表核对；后端无新增链路。
2. 课程上下架（code3 courses 501 → 真实，需先解除 AGENTS.md 对社区端课程域的禁令并讨论契约）
3. AI/知识库（需用户先决策模型选型，勿自行启动）
4. 人工联调欠账：趋势曲线、功能建设中 toast、课程视频播放/上传联调
```

- [ ] **Step 6: Run full verification**

```bash
cd E:/c2--/code/code1-elder/frontend
npm test
npm run type-check
npm run build

cd E:/c2--/code/code1-elder/backend
E:/workspace/silver-companion-env/python.exe -m pytest -q
```

Expected: frontend all pass, type-check 0 errors, build succeeds; backend `53 passed` (zero backend diff).

- [ ] **Step 7: Commit**

```bash
git -C E:/c2--/code add code1-elder/frontend/src/pages/account/RequestsPage.vue code1-elder/frontend/src/pages/request-history.spec.ts docs/progress.md HANDOVER.md
git -C E:/c2--/code commit -m "feat(sos): show real request history in api mode"
```

---

## Acceptance Criteria

- api 模式从「我的」→「我的求助」加载 `GET /api/v1/sos-events?elder_id=elder-001`，按创建时间倒序展示标题、状态、时间、备注。
- 加载中、加载失败、空列表三种状态文案互不混淆；失败时不显示「暂无求助记录」。
- mock 模式仍显示演示记录，且不发起任何请求；关闭演示后仍显示「求助记录服务尚未接入」。
- SOS 上报、状态刷新、状态机守卫行为与测试结果不变。
- 无后端改动、无新依赖、无契约变更；`npm test`、`type-check`、`build`、后端 `pytest` 全部通过。
- `docs/progress.md` 与 `HANDOVER.md` 反映本次切片，候选列表同步为「双端 SOS 人工联调」。

## Self-Review

- **Spec coverage**：列表请求（Task 2）、DTO/映射/状态文案（Task 1）、编排与入口（Task 3）、页面与文档（Task 4），无遗漏。
- **Placeholder scan**：无 TBD/TODO；所有代码与测试步骤均给出完整实现；验证数字以实测报告为准，不写入计划断言。
- **Type consistency**：`SosEventDto`、`SosEventStatus`、`RequestRecord`、`apiRequests`、`loadRequests`、`openRequests` 在四个任务中命名一致。
- **边界**：mock 不改、后端不改、无新增依赖、不自动推送；不重构既有 SOS 发送/刷新流程。
