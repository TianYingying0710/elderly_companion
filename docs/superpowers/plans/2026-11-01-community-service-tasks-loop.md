# 社区服务任务真实闭环 — 实施计划

- 日期：2026-11-01
- 依据：`docs/superpowers/specs/2026-11-01-community-service-tasks-loop-design.md`（最新版，唯一依据）
- 授权：用户 2026-11-01 指令「先最小化更新 AGENTS.md，再编写计划」，仅对社区服务任务解除数据库禁令
- 约束：不装依赖、不 seed、不预置数据、不跨领域、不提交、不推送
- 执行方式：每个任务「失败测试 → 最小实现 → 跑相关测试」，一次只碰该步所需文件

## 任务 0：AGENTS.md 域内例外（已完成）

- 文件：`AGENTS.md`（1 条 bullet 扩写）
- 内容：仅 `code3-community/backend`、仅社区服务任务、仅 `sqlite3` + 单表 `service_tasks`、仅 `CREATE TABLE IF NOT EXISTS`、测试数据只进临时库、运行数据只能由页面主动录入且不含真实个人信息；不解除认证/通知/求助/老人端/监护人端/救援/知识/课程禁令。

## 任务 1：后端错误契约（不接数据库）

- 新增 `backend/src/silver_companion_community/service_errors.py`（纯异常，不导入 FastAPI）：
  - `class TaskNotFoundError(Exception)`：`task_id: str`
  - `class InvalidStateTransitionError(Exception)`：`task_id, current: str, command: str`
  - `class ServiceUnavailableError(Exception)`
- 修改 `backend/src/silver_companion_community/errors.py`：新增 4 个处理器
  - `task_not_found_handler` → `404 {"error":{"code":"task_not_found","message":"服务任务不存在"}}`
  - `invalid_state_transition_handler` → `409 {"error":{"code":"invalid_state_transition","message":"该任务当前状态不允许此操作"}}`
  - `service_unavailable_handler` → `503 {"error":{"code":"service_unavailable","message":"服务暂时不可用"}}`
  - `internal_error_handler`（`Exception`）→ `500 {"error":{"code":"internal_error","message":"服务内部错误"}}`，不含 SQL/路径/堆栈
- 修改 `backend/src/silver_companion_community/main.py`：注册上述 4 个处理器；`/health` 不动
- 测试：`tests/test_error_contract.py`（4 个 code/状态码/信封形状；`/health` 仍 200）

## 任务 2：Schema 契约替换

- 修改 `schemas/service.py`：删 `ServiceTransition`；新增
  - `ServiceTaskCreate`：`title/elder_name/category/location/description: NonEmptyText`、`scheduled_at: AwareDatetime`、`extra="forbid"`
  - `ServiceTaskComplete`：`note: NonEmptyText`（空白串 → 422）
- 修改 `schemas/__init__.py`、`services/protocols.py` 的导入与 `ServiceTaskService` 协议：
  - `list_tasks(status, limit)` / `get_task(task_id)` / `create_task(payload)` / `accept(task_id)` / `complete(task_id, note)`
- 测试：`tests/test_schemas.py` 服务域用例改写为 `ServiceTaskCreate` 禁止 `id/status/note`、`ServiceTaskComplete` 空 note 报错

## 任务 3：Service（唯一状态机真源，不接数据库）

- 新增 `backend/src/silver_companion_community/services/service_tasks.py`
  - `class ServiceTaskService: def __init__(self, repository: ServiceTaskRepository) -> None`
  - `async def list_tasks(self, status: ServiceStatus | None = None, limit: int = 20) -> Sequence[ServiceTask]`
  - `async def get_task(self, task_id: str) -> ServiceTask`（缺失 → `TaskNotFoundError`）
  - `async def create_task(self, payload: ServiceTaskCreate) -> ServiceTask`（`id=uuid4()`、`status=pending`、`note=None`）
  - `async def accept(self, task_id: str) -> ServiceTask`（仅 `pending`，否则 409）
  - `async def complete(self, task_id: str, note: str) -> ServiceTask`（仅 `in_service`，否则 409）
  - 每次写前重新 `get_task` 读服务端真值；不导入 FastAPI / sqlite3 / 具体 Repository
- 测试：`tests/test_service_tasks_service.py`（手写 fake repo，`asyncio.run` 驱动）
  - 6 种转换全覆盖：`pending+accept`、`pending+complete`→409、`in_service+accept`→409、`in_service+complete`→completed+note、`completed+accept/complete`→409
  - 不存在 → 404；`create` 生成 pending + UUID；写前重读（fake 记录读取次数）

## 任务 4：SQLite Repository（集成测试先行）

- 测试：`tests/test_sqlite_service_task_repository.py`（`tmp_path` 临时库）
  - `initialize()` 幂等、空库 `list_tasks()` 返回 `[]`
  - `save_task` → `get_task` 往返字段一致（含带时区 `scheduled_at`）
  - `list_tasks(status=...)` 过滤、`limit` 生效
  - 关闭后重新构造 Repository，数据仍在（重启保留）
  - 路径不可用（父目录为文件）→ `ServiceUnavailableError`
- 新增 `backend/src/silver_companion_community/repositories/sqlite_service_tasks.py`
  - `class SqliteServiceTaskRepository: def __init__(self, database_path: str | Path)`
  - `def initialize(self) -> None`（仅 `CREATE TABLE IF NOT EXISTS service_tasks`，零插入）
  - `async def list_tasks(self, status=None, limit=20) -> Sequence[ServiceTask]`
  - `async def get_task(self, task_id) -> ServiceTask | None`
  - `async def save_task(self, task) -> None`（`BEGIN IMMEDIATE` + commit/rollback；`ON CONFLICT DO UPDATE` 保留 `created_at`）
  - 列：`id/title/elder_name/category/scheduled_at/location/description/status/note/created_at/updated_at`
  - `sqlite3.Error` 统一翻译为 `ServiceUnavailableError`；不含状态机判断

## 任务 5：FastAPI 依赖注入与 5 个端点

- 新增 `backend/src/silver_companion_community/dependencies/database.py`
  - `DATABASE_PATH_ENV = "COMMUNITY_DATABASE_PATH"`
  - `def get_service_task_repository() -> SqliteServiceTaskRepository`（未配置 → `ServiceUnavailableError`；构造后 `initialize()`）
  - `def get_service_task_service(repository=Depends(get_service_task_repository)) -> ServiceTaskService`
- 修改 `backend/src/silver_companion_community/api/service_tasks.py`：
  - `POST ""` → 201 + `ServiceTask`（`ServiceTaskCreate`）
  - `GET ""` → 200 + `list[ServiceTask]`（`status?`、`limit`）
  - `GET "/{task_id}"` → 200 + `ServiceTask`
  - `POST "/{task_id}/accept"` → 200 + `ServiceTask`
  - `POST "/{task_id}/complete"` → 200 + `ServiceTask`（`ServiceTaskComplete`）
  - 删除 `transitions`；每个端点声明 `404/409/422/503`；不写 SQL、不写状态机
- 修改 `backend/.env.example`：加 `COMMUNITY_DATABASE_PATH=data/community.db`（占位）
- 测试：`tests/test_service_tasks_api.py`（`COMMUNITY_DATABASE_PATH` 指向 `tmp_path`）
  - 201 创建 → 初始 `pending`；列表/详情；`accept`→`in_service`；`complete`→`completed` + note
  - 404（不存在）、409（三种非法）、422（空 note、未知枚举、空白 ID、`limit` 越界、多余字段）
  - 503（未配置路径 / 路径不可用）
- 修改 `tests/test_contract_routes.py`：移除服务域的 `transitions`，改断言服务域不再返回 501；救援/知识/课程仍 501；`EXPECTED_PATHS` 同步

## 任务 6：前端类型与 mapper

- 新增 `frontend/src/types/serviceTask.ts`
  - `ServiceTaskStatus = 'pending' | 'in_service' | 'completed'`
  - `ServiceTaskDto`（snake_case，`status: string` 以便校验非法值）、`ServiceTaskCreatePayload`、`ServiceTaskDraft`
  - `ServiceTask`（`elderName`、`scheduledAt`、`scheduledText`、`record`）
- 新增 `frontend/src/mappers/serviceTaskMapper.ts`
  - `class ServiceTaskMappingError extends Error`
  - `formatScheduled(iso: string): string`（固定 `+08:00` 偏移换算为 `MM-DD HH:mm`，不依赖 `Intl`）
  - `toServiceTask(dto: ServiceTaskDto): ServiceTask`（缺失字段/未知状态/非法时间 → 抛 `ServiceTaskMappingError`）
  - `toServiceTaskList(raw: unknown): ServiceTask[]`
  - `toCreatePayload(draft: ServiceTaskDraft): ServiceTaskCreatePayload`（`scheduledDate + scheduledTime` → `YYYY-MM-DDTHH:mm:00+08:00`）
- 测试：`frontend/src/mappers/serviceTaskMapper.spec.ts`
  - 字段映射、三种状态、`note: null → record: null`、带时区时间格式化（含跨 UTC 日界）、未知状态/缺字段/非法时间报错、草稿转 ISO

## 任务 7：前端 domain（纯展示规则）

- 修改 `frontend/src/domain/serviceFlow.ts`：删除 `nextServiceStatus` / `completeWithRecord`（不再本地推进状态）；改为
  - `SERVICE_STATUS_ORDER: ServiceTaskStatus[]`
  - `statusLabel(status)`、`cardActionLabel(status)`、`detailActionLabel(status)`、`canAccept(status)`、`canComplete(status)`、`groupServices(tasks)`
- 测试：`frontend/src/domain/serviceFlow.spec.ts` 重写（三种状态的动作/文案/可用性、分组顺序与空组、非法状态兜底）

## 任务 8：前端 API 模块与错误归一化

- 新增 `frontend/src/api/errors.ts`
  - `type ServiceErrorKind = 'network'|'unauthorized'|'forbidden'|'notFound'|'conflict'|'validation'|'capabilityMissing'|'unavailable'|'server'|'unexpected'`
  - `class ServiceTaskRequestError extends Error`（`kind`、`statusCode`、`code`、`fields`）
  - `toServiceTaskError(error: unknown): ServiceTaskRequestError`（0→network、401/403/404/409/422/503/500、501→capabilityMissing、其余→unexpected）
  - `errorMessage(kind): string`
- 新增 `frontend/src/api/serviceTasks.ts`
  - `interface ServiceTasksApi { list(); get(id); create(payload); accept(id); complete(id, note) }`
  - `createServiceTasksApi(request = apiRequest): ServiceTasksApi`，路径与方法只在此文件出现
- 测试：`frontend/src/api/serviceTasks.spec.ts`（5 个操作的 URL/方法/请求体；各状态码归一；网络失败；不返回空数组）

## 任务 9：composable

- 新增 `frontend/src/composables/useServiceTasks.ts`
  - `useServiceTasks(api: ServiceTasksApi = createServiceTasksApi())`
  - 暴露 `tasks`、`state: 'loading'|'ready'|'error'`、`errorMessage`、`actionError`、`busy`、`busyId`
  - `load()`、`retry()`、`createTask(draft)`、`accept(id)`、`complete(id, note)`
  - 规则：失败只置错误、不改 `tasks`；`busy` 期间拒绝重复提交；409 后自动重新拉取
- 测试：`frontend/src/composables/useServiceTasks.spec.ts`（loading/empty/error/retry/创建成功刷新/接收/完成/失败不污染/重复点击互斥/409 重载）

## 任务 10：页面接入真实链路

- 修改 `frontend/src/pages/service/index.vue`
  - 移除 `mock/community` 导入；改为 `useServiceTasks()`
  - 新增 loading / 空状态（含「新建服务任务」）/ 错误状态（含重试）/ 操作中禁用
  - 新建表单：6 个字段、必填校验、提交中禁用、成功后关闭并刷新、失败保留输入并提示
  - 详情仅用 ViewModel；按钮文案与可用性来自 `domain/serviceFlow.ts`
- 测试：`frontend/src/pages/service/page-boundaries.spec.ts`（静态断言：不导入 `mock/`、无 `http` 字面量、无状态码判断、使用 composable）

## 任务 11：文档同步

- `docs/api.md`：社区服务任务改为已实现的 5 个端点 + 201/404/409/422/503/500
- `docs/architecture.md`：补社区服务任务数据流与 SQLite 边界
- `docs/progress.md`：追加 2026-11-01 条目（已实现 / 未实现分开写）
- `docs/superpowers/specs/2026-10-31-community-backend-contract-design.md`：服务任务小节标注「已被 2026-11-01 设计取代」

## 任务 12：验证与自查

- 后端：`E:\workspace\silver-companion-env\python.exe -m pytest -q`（社区端全部）
- 前端：官方 `npm test` 预期仍因缺 `@babel/core` 失败（不修、不装）；用仓库外临时配置跑纯 TS 测试，如实标注
- 检查：`git status`、`git diff --numstat`（甄别 CRLF 假改动）、无 `.db/.env/dist` 入库
- 对照设计文档 §13 的 11 条验收标准逐条给出证据

## 自检：计划对设计文档的覆盖

| 设计条目 | 覆盖任务 |
|---|---|
| §2 硬门槛 / AGENTS.md 例外 | 任务 0 |
| §3 目标：新建/列表/详情/接收/完成、刷新保留 | 任务 3–5、9–10 |
| §3.2 非目标（无编辑/删除/批量） | 仅 5 个端点，未加 CRUD |
| §4 依赖方向与职责 | 任务 3（Service 不导 FastAPI/sqlite）、任务 4（Repo 无状态机）、任务 10（页面不拼 URL） |
| §5 HTTP 契约（含 201、Create 字段、id/status/note 不可提交） | 任务 2、5 |
| §6 状态机 6 种组合与字段边界 | 任务 3、6、7 |
| §7 持久化（env、单表、IF NOT EXISTS、显式事务、临时测试库、git 忽略） | 任务 4、5 |
| §8 错误契约 404/409/422/503/500、不泄露内部信息 | 任务 1、5、8 |
| §9 前端隔离与三态、空状态新建入口 | 任务 9、10 |
| §10 测试策略（后端 fake/临时库/依赖注入/health/其他 501；前端 6 类） | 任务 1–10 |
| §11 实施顺序 | 任务顺序一致 |
| §12 强制执行约束 | 全程遵守，任务 12 复核 |
| §13 验收标准 11 条 | 任务 12 逐条取证 |

自检结论：设计文档 14 节均有对应任务，无遗漏；未发现与现有代码无法局部解决的冲突（唯一连带改动：`transitions` 相关 4 处测试/文档，设计 §5 已明确要求）。

## 审计补记（2026-11-01，加固轮追加，不修改上文历史）

本轮按 `2026-11-01-community-service-tasks-hardening.md` 复核后修正了 5 处缺陷，并补齐了本计划任务 12 当时缺失的新鲜证据：

- 已完成详情的主按钮文案为「关闭」但点击无效 → 现在真的关闭详情。
- `.env.example` 的 `data/community.db` 首次启动返回 503 → 组合根为已配置的单个数据库文件创建父目录，失败仍返回 503。
- `accept`/`complete` 先查后写会出现并发丢失更新 → 改为 `BEGIN IMMEDIATE` 内条件 UPDATE，只有一个请求成功，另一个得到 409。
- 文本字段只有 `min_length=1`、完成请求接受多余字段 → 增加 `title`/`elder_name`/`category` 100、`location` 200、`description`/`note` 2000 上限，创建与完成请求 `extra="forbid"`，前端 mapper 同步同一组上限。
- 刷新失败会把整页替换成错误页 → 已有列表时保持 `ready`、保留旧列表并走列表外非阻塞提示，只有首次加载失败才显示整页错误。

实际验证（本轮新鲜结果）：

- 后端 `pytest -q`：78 passed，1 个第三方 `httpx2` 弃用警告，exit 0。
- 官方 `npm test` 仍无法启动：`node_modules/.bin/vitest.cmd` 缺失（`'vitest' 不是内部或外部命令`），未安装依赖；改用仓库外临时 vitest 配置直接调用 `node_modules/vitest/vitest.mjs`，9 个测试文件 76 项全部通过，exit 0。
- `vue-tsc --noEmit -p tsconfig.app.json`：exit 0。
- 工作区无 `.db`、`.env`、`dist`、`__pycache__`、`node_modules` 入库，跨领域目录（老人端、监护人端）无改动。
- 仍未实现：认证/授权、通知、求助流程、RAG、设备能力；救援、知识、课程三域仍返回 501。
