# 课程上下架真实化 设计

## 1. 背景

课程链路已真实：code1 提供创建课程、目录、详情、视频上传/播放、学习记录，并在 `ELDER_DATABASE_PATH` 下用 SQLite 持久化；社区端 api 模式直连 code1 建课并展示学员进度。缺少的是课程生命周期：课程创建后永久出现在老人端，社区端无法下架或重新发布。社区端 mock 分支已有发布/下架交互，api 分支把这两个动作隐藏了。

code3 后端课程域仍是 501 契约骨架，但社区端课程数据源明确是 code1（单一内容源），因此上下架必须落在 code1。

## 2. 目标

1. code1 课程新增发布状态 `published` / `unpublished`，随 `ELDER_DATABASE_PATH` 持久化。
2. 社区端 api 模式可对动态课程执行下架/重新发布，并看到当前状态。
3. 老人端课程目录与详情只返回已发布课程；已下架课程不出现，学习记录保留。
4. 预置演示课程不可上下架、不落库。
5. 零新依赖；契约新增显式报备；不触碰 code3 后端课程域、SOS、服务任务、监护人端与老人端前端生产代码。
6. 验收基座新增上下架、过滤与重启持久化检查。

## 3. 非目标

- 不做草稿态、审核流、定时发布、权限与认证。
- 不做课程编辑/删除、大纲修改、视频替换。
- 不解除 AGENTS.md 对社区端课程域的禁令，code3 后端课程路由保持 501。
- 不改老人端前端生产代码：服务端过滤已足够。
- 不引入迁移框架、seed 或预置数据。

## 4. 方案选择

### 方案 A（采用）：code1 新增单表 `course_publications`

- `course_id` 主键、`status`、`updated_at`。
- 表内**没有行等价于 `published`**，因此既有数据库与既有动态课程无需回填。
- 只使用 `CREATE TABLE IF NOT EXISTS`，不改既有 `courses` 表，不写迁移脚本。

理由：满足持久化与“缺行即默认已发布”的兼容性；不触碰既有三张表的结构；语义与社区端服务任务、SOS 的单表持久化模式一致。

### 方案 B（未采用）：`ALTER TABLE courses ADD COLUMN status`

`ALTER` 本质是迁移，且需要为既有行补默认值；与 AGENTS.md“禁止迁移”更冲突，也没有额外收益。

### 方案 C（未采用）：进程内发布状态

重启即丢，无法验收持久化，直接违背目标 1。

### 方案 D（未采用）：在 code3 后端实现课程域

社区端已直连 code1，code3 的课程 DTO 字段（`format` / `duration_label` / `note`）与 code1 不一致；实现它等于解除社区端课程域禁令并制造第二内容源。

## 5. 契约变更（需用户显式批准）

### 5.1 课程字段

`CourseSummary` 与 `CourseDetail` 新增：

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | `"published" \| "unpublished"` | 默认 `published` |
| `editable` | `boolean` | 预置演示课程 `false`，动态课程 `true` |

`POST /api/v1/courses` 不接受客户端传入 `status`/`editable`：新建动态课程固定为 `published`、`editable=true`。

### 5.2 列表与详情

| 方法与路径 | 变更 |
|---|---|
| `GET /api/v1/courses` | 默认只返回 `published`；新增查询参数 `include_unpublished=true` 时返回全部 |
| `GET /api/v1/courses/{course_id}` | 已下架课程按不存在处理，返回 `404 course_not_found` |

社区端管理页使用 `include_unpublished=true`；老人端保持默认。

### 5.3 上下架写入口

| 方法与路径 | 请求体 | 成功 |
|---|---|---|
| `POST /api/v1/courses/{course_id}/publication` | `{"status":"published" \| "unpublished"}` | `200`，返回更新后的 `CourseDetail` |

只提供 POST：微信小程序 `uni.request` 不支持 PATCH，与 SOS `POST /transitions` 同一平台约束；不再额外提供 PATCH 别名。

### 5.4 状态机

| 当前状态 | 目标状态 | 结果 |
|---|---|---|
| `published` | `unpublished` | `200` |
| `unpublished` | `published` | `200` |
| 相同状态 | 相同状态 | `409 illegal_course_publication` |
| 预置课程 | 任意 | `409 course_not_editable` |
| 课程不存在 | 任意 | `404 course_not_found` |
| 未知状态值 | — | `422 validation_failed` |

并发下两个相同目标请求只有一个成功；另一个因条件更新未命中返回 `409`。

## 6. 存储模型

```sql
CREATE TABLE IF NOT EXISTS course_publications (
    course_id TEXT PRIMARY KEY NOT NULL,
    status TEXT NOT NULL,
    updated_at TEXT NOT NULL
)
```

- 与 `courses` / `course_videos` / `learning_records` 共用 `ELDER_DATABASE_PATH` 指向的数据库文件。
- 初始化只执行 `CREATE TABLE IF NOT EXISTS`。
- 读：无行 → `published`；预置课程永不查询该表，恒为 `published`。
- 写：`BEGIN IMMEDIATE` 内确认课程存在、读取当前状态、与调用方观测到的期望状态比较，一致才 upsert；不一致返回未命中（`409`）。
- 未设置 `ELDER_DATABASE_PATH` 时，内存仓库用字段保存同一状态，语义与 SQLite 一致。

## 7. 前端行为

### 7.1 社区端（code3 frontend）

- DTO 与视图新增 `status`、`editable`。
- `getElderCourses` 支持 `includeUnpublished`，管理页调用时传 `true`。
- 新增 `updateCoursePublication(courseId, status)`，走 `POST /publication`，使用 `data` + `header`。
- 编排层新增 `setPublication` 与 `updatingId`；成功后重新拉取目录，失败写入 `publishError`。
- 教学页 api 分支：显示「已发布/已下架」标签；动态课程显示「下架/重新发布」，预置课程显示「预置课程」且无操作。
- mock 分支行为不变。

### 7.2 老人端（code1 frontend）

- 生产代码零改动：列表与详情由服务端过滤。
- 已下架课程从目录与学习记录页消失；学习记录本身保留在服务端，重新发布后恢复展示。
- 新增字段不会破坏老人端严格解析器：解析器只取已知字段，多余字段被忽略。

## 8. 验收扩展

在既有 22 项跨端检查上新增 11 项，总计 33 项：

| 步骤 | 请求 | 期望 |
|---|---|---|
| S04a | elder `POST /courses/{id}/publication {"status":"unpublished"}` | 200，`status=unpublished` |
| S04b | elder `GET /courses` | 不含该课程 |
| S04c | elder `GET /courses?include_unpublished=true` | 含该课程，`status=unpublished`、`editable=true` |
| S04d | elder `GET /courses/{id}` | 404 `course_not_found` |
| S04e | 再次下架 | 409 `illegal_course_publication` |
| S04f | 对不存在课程上下架 | 404 `course_not_found` |
| S18a | elder 重启后 `GET /courses?include_unpublished=true` | 仍为 `unpublished` |
| S18b | elder 重启后 `GET /courses` | 仍不含该课程 |
| S18c | elder 重启后 `GET /learning-records` | 进度 42 仍保留 |
| S18d | elder 重启后重新发布 | 200，`status=published` |
| S18e | elder 重启后 `GET /courses` | 再次包含该课程 |

验收不依赖预置课程 id 或演示数据；预置课程不可编辑由后端单测覆盖。

## 9. 隔离与低耦合

| 对象 | 约束 |
|---|---|
| SOS / 服务任务 / 监护人端 | 零改动 |
| 老人端前端 | 零改动 |
| code3 后端课程域 | 保持 501 |
| code4-shared | 零改动 |
| 既有课程表结构 | 不改，只新增 `course_publications` |
| 既有验证入口 | `verify-framework.ps1` 不改、不被调用 |
| 依赖方向 | 社区端 → code1 HTTP 契约；无跨应用内部导入 |
| 数据 | 无 seed、无预置数据；预置课程仍由代码提供 |

## 10. 前置决策门（未获确认不得进入实现）

1. **授权新表**：AGENTS.md 当前例外只列 `courses`/`course_videos`/`learning_records`。需授权 `code1-elder/backend` 在 `ELDER_DATABASE_PATH` 同一数据库新增单表 `course_publications`，仅 `CREATE TABLE IF NOT EXISTS`、禁止 seed 与迁移框架。
2. **批准契约新增**：`status`/`editable` 字段、`include_unpublished` 查询参数、`POST /courses/{id}/publication`、错误码 `course_not_editable` 与 `illegal_course_publication`。
3. **确认产品语义**：预置课程不可上下架；已下架课程从老人端目录/历史消失但学习记录保留，重新发布后恢复。
4. **确认 code3 后端课程域仍为 501**，不在本切片解除禁令。

任一项未获确认，停止实现并重新设计。

## 11. 风险与对策

| 风险 | 对策 |
|---|---|
| 契约新增破坏消费端严格解析 | 社区端同切片更新；老人端解析器忽略多余字段；后端测试断言字段集合 |
| 既有数据库无新表 | 缺行即 `published`；`CREATE TABLE IF NOT EXISTS` 自动建表 |
| 并发重复上下架 | `BEGIN IMMEDIATE` + 期望状态比较，未命中返回 409 |
| 下架导致学习记录“消失” | 记录保留；重新发布恢复；验收 S18c 证明记录仍在 |
| 预置课程被误改 | `editable=false` + 路由 409 + 仓库拒写 |
| 验收依赖演示数据 | 验收只用本次 run-id 创建课程；预置行为由单测覆盖 |
| 验收基座尚未实现 | 先完成既有的跨端验收基座规格与实现，再执行本计划的验收任务 |

## 12. 决策记录

- 发布状态放 code1，不实现 code3 课程域。
- 新表而非 `ALTER`，缺行即默认已发布。
- 只提供 POST `/publication`，不提供 PATCH。
- 预置课程不可编辑，不持久化预置状态。
- 老人端零改动，服务端过滤。
- 同状态重复变更按 409 处理，与 SOS、服务任务的状态机风格一致。
