# 老人端「学习记录」接真实数据 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** api 模式下，老人端「学习记录」页展示 code1 后端 `GET /api/v1/learning-records` 的真实记录（按课程合并标题、按更新时间倒序），mock 模式演示行为保持不变。

**Architecture:** 沿用现有分层 `页面 → composables → data/provider 工厂 → mappers（DTO↔ViewModel）→ api`。API 层新增列表请求；mapper 把「课程目录 + 学习记录」合并为视图项；provider 暴露 `learningHistory()`；composable 负责加载与失败反馈；页面在 `isCourseApi` 分支渲染真实记录，demo 分支原样保留。零后端改动、零契约变更。

**Tech Stack:** Vue 3 + TypeScript + Vite + Vitest；后端 FastAPI（仅回归验证，不改代码）。

**Spec:** `docs/api.md`（learning-records 行）、`docs/progress.md`（2026-11-14 章节）、`HANDOVER.md`（下一步候选 1）。

## Global Constraints

- **禁止安装任何依赖**；前端只跑既有 `node_modules`。
- 后端回归使用既有环境：`E:/workspace/silver-companion-env/python.exe`。
- **零后端/契约改动**：`GET /api/v1/learning-records` 已实现，响应 `LearningRecord {course_id, progress_percent, updated_at}`。
- **mock 模式行为一字不变**：默认 `VITE_COURSE_DATA_MODE=mock` 时仍走现有演示分支。
- 只有 `src/api/elderCourses.ts` 允许出现 HTTP 路径；页面不得直接 fetch。
- 新功能先写失败测试，再实现（TDD）。
- **允许本地提交，禁止推送**：每个任务完成后本地 commit（SDD 审查需要提交范围）；推送由用户决定并执行。
- 提交粒度按任务，提交信息使用仓库现有风格。

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `code1-elder/frontend/src/api/elderCourses.ts` | HTTP 边界：新增学习记录列表请求与 DTO 校验 | 修改 |
| `code1-elder/frontend/src/types/domain.ts` | 新增视图模型 `LearningHistoryItem` | 修改 |
| `code1-elder/frontend/src/mappers/courseMapper.ts` | 课程/记录合并、更新时间格式化 | 修改 |
| `code1-elder/frontend/src/data/courseProvider.ts` | api/mock 工厂新增 `learningHistory()` | 修改 |
| `code1-elder/frontend/src/composables/useCourses.ts` | 新增 `apiHistory` 状态与 `loadLearningHistory()` | 修改 |
| `code1-elder/frontend/src/composables/useElderApp.ts` | 组装 `openLearningHistory()` 并暴露状态 | 修改 |
| `code1-elder/frontend/src/pages/LearningPage.vue` | 历史分支渲染真实记录 | 修改 |
| 对应 `*.spec.ts` | 每层回归测试 | 修改/新增 |

---

### Task 1: 学习记录列表 API 客户端

**Files:**
- Modify: `code1-elder/frontend/src/api/elderCourses.ts`
- Test: `code1-elder/frontend/src/api/elderCourses.spec.ts`

**Interfaces:**
- Consumes: 现有 `elderApiBaseUrl`、`FetchLike`、`parseLearningRecord`、`LearningRecordDto`
- Produces: `getLearningRecords(fetchFn?: FetchLike, baseUrl?: string): Promise<LearningRecordDto[]>`

- [ ] **Step 1: 写失败测试**

在 `elderCourses.spec.ts` 的 import 中加入 `getLearningRecords`，并在 `describe` 末尾追加：

```ts
  it('学习记录走 GET /api/v1/learning-records，逐条校验 DTO', async () => {
    const record = { course_id: 'course-1', progress_percent: 30, updated_at: '2026-11-13T00:00:00Z' }
    const fetchFn = ok([record])
    await expect(getLearningRecords(fetchFn, 'http://x')).resolves.toEqual([record])
    expect(fetchFn).toHaveBeenCalledWith('http://x/api/v1/learning-records')
  })

  it('学习记录列表非法载荷被拒绝，非 2xx 抛出带状态码的错误', async () => {
    await expect(getLearningRecords(ok({ course_id: 'c' }), 'http://x')).rejects.toThrow('invalid learning records payload')
    await expect(
      getLearningRecords(ok([{ course_id: '', progress_percent: 0, updated_at: 't' }]), 'http://x'),
    ).rejects.toThrow('invalid learning record course_id')
    await expect(getLearningRecords(failing(503), 'http://x')).rejects.toThrow('学习记录加载失败（HTTP 503）')
  })
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd code1-elder/frontend
npm test -- src/api/elderCourses.spec.ts
```

Expected: FAIL，`getLearningRecords is not a function` 或类似导出缺失。

- [ ] **Step 3: 最小实现**

在 `elderCourses.ts` 末尾追加：

```ts
/** GET /api/v1/learning-records：全部学习记录（后端按 updated_at 倒序返回） */
export async function getLearningRecords(
  fetchFn: FetchLike = fetch,
  baseUrl = elderApiBaseUrl,
): Promise<LearningRecordDto[]> {
  const response = await fetchFn(`${baseUrl}/api/v1/learning-records`)
  if (!response.ok) throw new Error(`学习记录加载失败（HTTP ${response.status}）`)
  const raw = await response.json()
  if (!Array.isArray(raw)) throw new Error('invalid learning records payload')
  return raw.map(parseLearningRecord)
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd code1-elder/frontend
npm test -- src/api/elderCourses.spec.ts
```

Expected: PASS（该文件全部用例）。

- [ ] **Step 5: 提交**

```bash
git -C E:/c2--/code add code1-elder/frontend/src/api/elderCourses.ts code1-elder/frontend/src/api/elderCourses.spec.ts
git -C E:/c2--/code commit -m "feat(learning): add learning records list api client"
```

---

### Task 2: 学习记录视图映射

**Files:**
- Modify: `code1-elder/frontend/src/types/domain.ts`
- Modify: `code1-elder/frontend/src/mappers/courseMapper.ts`
- Test: `code1-elder/frontend/src/mappers/courseMapper.spec.ts`

**Interfaces:**
- Consumes: `Course`（`types/domain.ts`）、`LearningRecordDto`（`types/courses.ts`）
- Produces:
  - `interface LearningHistoryItem { course: Course; progressPercent: number; updatedAt: string }`
  - `toLearningHistory(courses: Course[], records: LearningRecordDto[]): LearningHistoryItem[]`
  - `formatUpdatedAt(iso: string): string`（返回 `MM-DD HH:mm`，非法时间返回 `''`）

- [ ] **Step 1: 写失败测试**

在 `courseMapper.spec.ts` 的 import 中加入 `formatUpdatedAt, toLearningHistory`，并补充：

```ts
import type { Course } from '../types/domain'

const historyCourse: Course = {
  id: 'course-1', title: '智能手机基础操作', category: '数字素养', description: 'd',
  duration: '约 10 分钟', color: 'blue', symbol: '📖', progress: 0, outline: [], videoUrl: null,
}

describe('elder learningHistory mapper', () => {
  it('只保留有进度的记录，按课程合并标题，并按更新时间倒序', () => {
    const records = [
      { course_id: 'course-1', progress_percent: 40, updated_at: '2026-11-13T02:03:00Z' },
      { course_id: 'course-1', progress_percent: 0, updated_at: '2026-11-12T00:00:00Z' },
      { course_id: 'missing', progress_percent: 50, updated_at: '2026-11-14T00:00:00Z' },
      { course_id: 'course-1', progress_percent: 80, updated_at: '2026-11-14T01:00:00Z' },
    ]
    // 同课程在真实后端只有一条（upsert）；这里用两条验证排序与过滤互不影响
    const items = toLearningHistory([historyCourse], records)
    expect(items.map((item) => item.progressPercent)).toEqual([80, 40])
    expect(items[0]!.course.title).toBe('智能手机基础操作')
    expect(items[0]!.course.progress).toBe(80)
  })

  it('没有匹配课程或全为 0 进度时返回空数组', () => {
    expect(toLearningHistory([], [])).toEqual([])
    expect(toLearningHistory([historyCourse], [
      { course_id: 'course-1', progress_percent: 0, updated_at: '2026-11-13T00:00:00Z' },
    ])).toEqual([])
  })

  it('更新时间格式化为 MM-DD HH:mm（东八区），非法时间返回空串', () => {
    expect(formatUpdatedAt('2026-11-13T02:03:00Z')).toBe('11-13 10:03')
    expect(formatUpdatedAt('not-a-date')).toBe('')
  })
})
```

注：真实后端对同一 `course_id` 只会有一条记录；测试里刻意放入两条同课程记录，只为验证「过滤 0 进度」与「时间倒序」两条规则独立成立。

- [ ] **Step 2: 运行测试确认失败**

```bash
cd code1-elder/frontend
npm test -- src/mappers/courseMapper.spec.ts
```

Expected: FAIL，`toLearningHistory` / `formatUpdatedAt` 未导出。

- [ ] **Step 3: 新增类型**

在 `types/domain.ts` 的 `Course` 定义之后追加：

```ts
export interface LearningHistoryItem { course:Course; progressPercent:number; updatedAt:string }
```

- [ ] **Step 4: 实现映射**

在 `courseMapper.ts` 顶部 import 中加入 `LearningRecordDto` 与 `LearningHistoryItem`：

```ts
import type { CourseDetailDto, CourseSummaryDto, LearningRecordDto } from '../types/courses'
import type { Course, LearningHistoryItem } from '../types/domain'
```

在文件末尾追加：

```ts
/** 课程目录 + 学习记录 → 历史列表：过滤 0 进度与孤立记录，按更新时间倒序 */
export function toLearningHistory(courses: Course[], records: LearningRecordDto[]): LearningHistoryItem[] {
  const byId = new Map(courses.map((course) => [course.id, course]))
  const time = (iso: string) => {
    const parsed = Date.parse(iso)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return records
    .filter((record) => record.progress_percent > 0)
    .flatMap((record) => {
      const course = byId.get(record.course_id)
      if (course === undefined) return []
      return [{
        course: { ...course, progress: record.progress_percent },
        progressPercent: record.progress_percent,
        updatedAt: record.updated_at,
      }]
    })
    .sort((a, b) => time(b.updatedAt) - time(a.updatedAt))
}

/** ISO 时间 → MM-DD HH:mm（东八区）；非法时间返回空串 */
export function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const part = (type: 'month' | 'day' | 'hour' | 'minute') =>
    parts.find((item) => item.type === type)?.value ?? ''
  return `${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd code1-elder/frontend
npm test -- src/mappers/courseMapper.spec.ts
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git -C E:/c2--/code add code1-elder/frontend/src/types/domain.ts code1-elder/frontend/src/mappers/courseMapper.ts code1-elder/frontend/src/mappers/courseMapper.spec.ts
git -C E:/c2--/code commit -m "feat(learning): map learning records into history items"
```

---

### Task 3: Provider 与 composable 接线

**Files:**
- Modify: `code1-elder/frontend/src/data/courseProvider.ts`
- Modify: `code1-elder/frontend/src/data/courseProvider.spec.ts`
- Modify: `code1-elder/frontend/src/composables/useCourses.ts`
- Modify: `code1-elder/frontend/src/composables/useCourses.spec.ts`
- Modify: `code1-elder/frontend/src/composables/useElderApp.ts`

**Interfaces:**
- Consumes: `getLearningRecords`（Task 1）、`toLearningHistory`（Task 2）
- Produces:
  - `CourseProvider.learningHistory(): Promise<LearningHistoryItem[]>`
  - `CoursesState.apiHistory: LearningHistoryItem[]`
  - `useCourses(...).loadLearningHistory(): Promise<void>`
  - `useElderApp().openLearningHistory(): void`

- [ ] **Step 1: 写失败测试（provider）**

在 `courseProvider.spec.ts` 中追加：

```ts
  it('api provider 合并课程与学习记录；mock 返回空历史', async () => {
    const record = { course_id: 'course-1', progress_percent: 40, updated_at: '2026-11-13T02:03:00Z' }
    const fetchFn = vi.fn(async (url: string) =>
      url.endsWith('/learning-records')
        ? new Response(JSON.stringify([record]), { status: 200 })
        : new Response(JSON.stringify([detail]), { status: 200 }),
    )
    const history = await createApiCourseProvider(fetchFn).learningHistory()
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      progressPercent: 40,
      updatedAt: '2026-11-13T02:03:00Z',
      course: { id: 'course-1', title: '智能手机基础操作' },
    })
    expect(fetchFn).toHaveBeenCalledWith(expect.stringContaining('/api/v1/learning-records'))
    await expect(createMockCourseProvider().learningHistory()).resolves.toEqual([])
  })
```

- [ ] **Step 2: 写失败测试（composable）**

在 `useCourses.spec.ts` 顶部 import 改为：

```ts
import type { Course, LearningHistoryItem } from '../types/domain'
```

把 `state()` 改为包含历史字段：

```ts
function state(): CoursesState & Record<string, unknown> {
  return reactive({ apiCourses: [] as Course[], apiCourse: null as Course | null, apiHistory: [] as LearningHistoryItem[], feedback: '' })
}
```

给该文件所有 provider 字面量补上 `learningHistory: vi.fn(async () => [])`（共 8 处：`provider`×4、`broken`×2、`failing`、`mock`）。例如：

```ts
const provider = { mode: 'api' as const, list: vi.fn(async () => [course]), detail: vi.fn(async () => course), updateProgress: vi.fn(async () => undefined), learningHistory: vi.fn(async () => []) }
```

然后追加用例：

```ts
  it('loadLearningHistory：api 模式写入历史；失败写 feedback；mock 不调用', async () => {
    const entry: LearningHistoryItem = { course, progressPercent: 40, updatedAt: '2026-11-13T02:03:00Z' }
    const s = state()
    const provider = { mode: 'api' as const, list: vi.fn(async () => []), detail: vi.fn(async () => course), updateProgress: vi.fn(async () => undefined), learningHistory: vi.fn(async () => [entry]) }
    await useCourses(s, vi.fn(), provider).loadLearningHistory()
    expect(s.apiHistory).toEqual([entry])
    expect(s.feedback).toBe('')

    const s2 = state()
    const failing = { mode: 'api' as const, list: vi.fn(async () => []), detail: vi.fn(async () => course), updateProgress: vi.fn(async () => undefined), learningHistory: vi.fn(async () => { throw new Error('学习记录加载失败（HTTP 503）') }) }
    await useCourses(s2, vi.fn(), failing).loadLearningHistory()
    expect(s2.feedback).toBe('学习记录加载失败（HTTP 503）')

    const loadHistory = vi.fn(async () => [entry])
    const mock = { mode: 'mock' as const, list: vi.fn(async () => []), detail: vi.fn(async () => course), updateProgress: vi.fn(async () => undefined), learningHistory: loadHistory }
    const s3 = state()
    await useCourses(s3, vi.fn(), mock).loadLearningHistory()
    expect(loadHistory).not.toHaveBeenCalled()
    expect(s3.apiHistory).toEqual([])
  })
```

- [ ] **Step 3: 运行测试确认失败**

```bash
cd code1-elder/frontend
npm test -- src/data/courseProvider.spec.ts src/composables/useCourses.spec.ts
npm run type-check
```

Expected: 测试 FAIL（`learningHistory` 不存在）；type-check 报 provider 字面量缺字段。

- [ ] **Step 4: 实现 provider**

`courseProvider.ts`：

```ts
import { getCourses, getCourseDetail, getLearningRecords, updateLearningRecord, type FetchLike } from '../api/elderCourses'
import type { Course, LearningHistoryItem } from '../types/domain'
import { toDomainCourse, toDomainCourseDetail, toLearningHistory } from '../mappers/courseMapper'

export interface CourseProvider {
  mode: CourseSourceMode
  list: () => Promise<Course[]>
  detail: (courseId: string) => Promise<Course>
  updateProgress: (courseId: string, progressPercent: number) => Promise<void>
  /** api 模式：学习记录（课程目录 + 记录合并，按更新时间倒序）；mock 返回空数组 */
  learningHistory: () => Promise<LearningHistoryItem[]>
}
```

api 实现改为共用 `listCourses`：

```ts
export function createApiCourseProvider(fetchFn: FetchLike = fetch): CourseProvider {
  const listCourses = async () => (await getCourses(fetchFn)).map((dto, index) => toDomainCourse(dto, index))
  return {
    mode: 'api',
    list: listCourses,
    detail: async (courseId) => toDomainCourseDetail(await getCourseDetail(courseId, fetchFn), 0),
    updateProgress: async (courseId, progressPercent) => {
      await updateLearningRecord(courseId, progressPercent, fetchFn)
    },
    learningHistory: async () => {
      const [courses, records] = await Promise.all([listCourses(), getLearningRecords(fetchFn)])
      return toLearningHistory(courses, records)
    },
  }
}
```

mock 实现补充：

```ts
    learningHistory: async () => [],
```

- [ ] **Step 5: 实现 composable**

`useCourses.ts`：

```ts
import type { Course, LearningHistoryItem } from '../types/domain'

export interface CoursesState {
  apiCourses: Course[]
  apiCourse: Course | null
  /** api 模式学习记录（课程信息 + 进度） */
  apiHistory: LearningHistoryItem[]
  feedback: string
}
```

新增函数并加入返回值：

```ts
  /** api 模式：打开学习记录页前加载真实记录；失败只提示，不阻塞页面 */
  async function loadLearningHistory(): Promise<void> {
    if (!isApi) return
    try {
      state.apiHistory = await provider.learningHistory()
    } catch (error) {
      state.feedback = error instanceof Error ? error.message : '学习记录加载失败'
    }
  }

  return { isApi, loadCourses, openApiCourse, recordProgress, loadLearningHistory }
```

- [ ] **Step 6: 组装 useElderApp**

`useElderApp.ts`：
- import 类型：`import type { ChatMessage, Course, LearningHistoryItem, RequestRecord, SosState } from '../types/domain'`
- state 增加：`apiHistory: [] as LearningHistoryItem[],`
- 解构：`const {isApi,loadCourses,openApiCourse,recordProgress,loadLearningHistory}=useCourses(state,go)`
- 新增函数（放在 `loadCourses()` 调用之后）：

```ts
  function openLearningHistory(){go('learning-history');loadLearningHistory()}
```

- 返回值增加 `openLearningHistory`。

- [ ] **Step 7: 运行测试与类型检查**

```bash
cd code1-elder/frontend
npm test -- src/data/courseProvider.spec.ts src/composables/useCourses.spec.ts
npm run type-check
```

Expected: 两个 spec 全过；type-check 0 错。

- [ ] **Step 8: 提交**

```bash
git -C E:/c2--/code add code1-elder/frontend/src/data/courseProvider.ts code1-elder/frontend/src/data/courseProvider.spec.ts code1-elder/frontend/src/composables/useCourses.ts code1-elder/frontend/src/composables/useCourses.spec.ts code1-elder/frontend/src/composables/useElderApp.ts
git -C E:/c2--/code commit -m "feat(learning): load learning history through provider and composable"
```

---

### Task 4: 页面渲染、集成测试与文档

**Files:**
- Modify: `code1-elder/frontend/src/pages/LearningPage.vue`
- Test: `code1-elder/frontend/src/pages/learning-history.spec.ts`（新建）
- Modify: `docs/progress.md`
- Modify: `HANDOVER.md`

**Interfaces:**
- Consumes: `app.isCourseApi`、`app.state.apiHistory`、`app.openLearningHistory()`、`app.openApiCourse()`、`formatUpdatedAt`
- Produces: 历史页真实记录 UI；`data-testid="learning-history"` 入口按钮

- [ ] **Step 1: 写失败集成测试**

新建 `src/pages/learning-history.spec.ts`：

```ts
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../App.vue'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('api 模式展示真实学习记录，并可打开对应课程', async () => {
  vi.stubEnv('VITE_COURSE_DATA_MODE', 'api')
  const course = {
    id: 'course-1', title: '智能手机基础操作', category: '数字素养',
    description: '从开关机到连 Wi-Fi。', duration_seconds: 600, video_url: null,
  }
  const record = { course_id: 'course-1', progress_percent: 40, updated_at: '2026-11-13T02:03:00Z' }
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/api/v1/courses')) return new Response(JSON.stringify([course]), { status: 200 })
    if (url.endsWith('/api/v1/learning-records')) return new Response(JSON.stringify([record]), { status: 200 })
    if (url.endsWith('/api/v1/courses/course-1')) {
      return new Response(JSON.stringify({ ...course, outline: ['认识屏幕与按键'] }), { status: 200 })
    }
    return new Response('no', { status: 404 })
  }))

  const wrapper = mount(App)
  await flushPromises()
  await wrapper.get('[data-testid="nav-learn"]').trigger('click')
  await wrapper.get('[data-testid="learning-history"]').trigger('click')
  await flushPromises()

  expect(wrapper.text()).toContain('智能手机基础操作')
  expect(wrapper.text()).toContain('已学习 40%')
  expect(wrapper.text()).toContain('更新于 11-13 10:03')

  await wrapper.get('[data-testid="course-item"]').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('本课内容')
  wrapper.unmount()
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd code1-elder/frontend
npm test -- src/pages/learning-history.spec.ts
```

Expected: FAIL，找不到 `[data-testid="learning-history"]`。若因 `data-testid` 不存在而直接报错，即为预期失败。

- [ ] **Step 3: 修改页面**

`LearningPage.vue`：
1. 在 `<script setup>` 的 mapper import 中加入 `formatUpdatedAt`：

```ts
import { formatUpdatedAt, toProgressPercent } from '../mappers/courseMapper'
```

2. 入口按钮加 testid 并改调用：

```html
<button class="row card" data-testid="learning-history" @click="app.openLearningHistory()"><strong>学习记录</strong><span>›</span></button>
```

3. 把第三个分支（`<div v-else class="content">`）替换为：

```html
<div v-else class="content">
  <template v-if="app.isCourseApi">
    <p class="demo-note">学习记录来自课程服务（演示环境）。</p>
    <template v-if="app.state.apiHistory.length > 0">
      <section v-for="item in app.state.apiHistory" :key="item.course.id" class="card">
        <CourseList :courses="[item.course]" @select="app.openApiCourse($event)"/>
        <progress :value="item.progressPercent" max="100" :aria-label="item.course.title + '学习进度'"/>
        <p>已学习 {{ item.progressPercent }}% · 更新于 {{ formatUpdatedAt(item.updatedAt) }}</p>
      </section>
    </template>
    <p v-else class="empty">暂无学习记录</p>
  </template>
  <template v-else-if="app.state.data">
    <p class="demo-note">以下为模拟学习记录</p>
    <section v-for="course in app.state.data.courses.filter(c => c.progress > 0)" :key="course.id" class="card">
      <CourseList :courses="[course]" @select="app.go('course-detail', $event)"/>
      <progress :value="course.progress" max="100" :aria-label="course.title + '学习进度'"/>
      <p>已学习 {{ course.progress }}% · 模拟</p>
    </section>
  </template>
  <p v-else class="empty">学习记录服务尚未接入</p>
</div>
```

注意：`v-else` 只能紧跟 `v-else-if`/`v-if`；本段结构为 `v-if` → `v-else-if` → `v-else`，中间不得插入其他元素（上一个切片刚修复过同类错配）。

- [ ] **Step 4: 运行集成测试确认通过**

```bash
cd code1-elder/frontend
npm test -- src/pages/learning-history.spec.ts
```

Expected: PASS。

- [ ] **Step 5: 更新文档**

`docs/progress.md` 在 `更新日期：2026-11-14` 之后新增章节：

```markdown
## 2026-11-14：老人端学习记录接真实数据（前端切片）

- **功能**：api 模式（`VITE_COURSE_DATA_MODE=api`）下，「学习记录」页通过 `GET /api/v1/learning-records` 读取真实进度，与课程目录按 `course_id` 合并展示标题/分类/进度/更新时间，按更新时间倒序；点击记录可打开课程详情。mock 模式演示分支与入口行为保持不变。
- **分层**：`api/elderCourses.ts` 新增 `getLearningRecords` → `mappers/courseMapper.ts` 新增 `toLearningHistory`/`formatUpdatedAt` → `data/courseProvider.ts` 新增 `learningHistory()` → `composables/useCourses.ts` 新增 `apiHistory`/`loadLearningHistory` → `useElderApp` 暴露 `openLearningHistory` → `LearningPage.vue` 渲染。
- **契约**：零后端改动、零契约变更；仅消费已实现的 GET 接口。过滤 0 进度与孤立记录（课程不存在），避免展示无意义条目。
- **验证**：elder 前端 `npm test` 全过、`type-check` 0 错、`vite build` 通过；elder 后端 `pytest` 仍 53 项全过（具体新增用例数写入实现报告，不硬编码进文档）。
```

`HANDOVER.md`：
- 第一节现状末尾追加：`老人端学习记录页已接真实 GET 接口（零契约变更）。`
- 第四节候选 1 改为已完成，并把候选顺延：

```markdown
1. **老人端「我的求助」记录页接真实 SOS 列表（推荐）**：`GET /api/v1/sos-events` 已实现，`RequestsPage` 目前只读演示数据；api 模式下按 `elder-001` 拉取事件并复用现有 SOS 状态文案。
2. 课程上下架（code3 courses 501 → 真实，需契约讨论）
3. AI/知识库（需用户先决策模型选型，勿自行启动）
4. 人工联调欠账：api 模式双端 SOS 联调（监护人处置 → 老人端刷新）、趋势曲线、功能建设中 toast、课程视频播放/上传联调
```

- [ ] **Step 6: 全量验证**

```bash
cd E:/c2--/code/code1-elder/frontend
npm test
npm run type-check
npm run build

cd E:/c2--/code/code1-elder/backend
E:/workspace/silver-companion-env/python.exe -m pytest -q
```

Expected:
- 前端全部 spec 通过（基线 70 项 + 本次新增）；
- type-check 0 错；
- `vite build` 成功；
- 后端 `53 passed`（无后端改动，数字不应变化）。

- [ ] **Step 7: 提交**

```bash
git -C E:/c2--/code add code1-elder/frontend/src/pages/LearningPage.vue code1-elder/frontend/src/pages/learning-history.spec.ts docs/progress.md HANDOVER.md
git -C E:/c2--/code commit -m "feat(learning): show real learning history in api mode"
```

---

## Self-Review

- **Spec coverage**：学习记录列表请求（Task 1）、合并/排序/时间展示（Task 2）、provider 与状态编排（Task 3）、页面渲染与入口（Task 4）、文档同步（Task 4）。无遗漏。
- **Placeholder scan**：无 TBD/TODO；所有代码步骤给出完整实现；验证数字在 Task 4 以“执行后填写”标注，执行时替换。
- **Type consistency**：`LearningHistoryItem {course, progressPercent, updatedAt}` 在类型、mapper、provider、state、页面中名称一致；`learningHistory()` 与 `loadLearningHistory()` 命名与用法一致；`formatUpdatedAt` 仅页面使用。
- **边界**：mock 模式不改；后端不改；无新增依赖；不自动推送。
