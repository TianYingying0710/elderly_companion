# Community Service Tasks Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复社区服务任务真实链路中已确认的交互与启动缺陷，并补强并发一致性、输入边界和可验证性。

**Architecture:** 保持现有 `page → composable → API/mapper → FastAPI → service → repository` 单向依赖，不重写已完成链路。业务状态仍以 Service 为唯一真源；SQLite Repository 新增原子条件更新能力，Service 只依赖 Protocol。

**Tech Stack:** Vue 3、TypeScript、uni-app、FastAPI、Pydantic 2、Python 标准库 `sqlite3`、pytest、Vitest。

**Spec:** `docs/superpowers/specs/2026-11-01-community-service-tasks-loop-design.md`

## Global Constraints

- 工作目录固定为 `E:\c2--\code`。
- 完整阅读 `AGENTS.md`、原实施计划和本计划后再修改代码。
- 严禁安装、升级或删除依赖；不得运行任何 install 命令。
- 仅修改社区服务任务及其直接测试/文档，不改老人端、监护人端或社区其他领域。
- 不创建 seed、预置业务数据或真实个人数据。
- 不提交、不推送、不创建分支。
- 不用 mock、固定响应、吞异常或降低断言换取通过。
- 保持 `/health` 无数据库依赖。
- 每个任务先写失败测试，再做最小修复；无法执行的测试必须如实标为未验证。

## Review Focus

- 已完成任务的“关闭”操作必须真的关闭详情，不能保留无效主按钮。
- 示例数据库路径的父目录不存在时，首次启动必须可创建本地库，同时禁止越界创建任意目录树。
- 两个请求同时接收或完成同一任务时，只允许一个状态转换成功，另一个得到 409。
- 超长文本、多余字段和非法时间必须在 API 边界返回 422，不能进入 SQLite。
- 刷新失败但已有任务时应保留并显示旧列表，同时显示非阻塞错误，而不是整页替换成错误页。

---

## Audit Summary

原计划 0–11 对应的文件均已出现，主要链路已编码：SQLite Repository、Service、5 个 API、前端 mapper/API/composable 和页面接线均存在。当前不能宣称完整通过：社区端官方前端测试因本机缺少 `vitest.cmd` 无法启动；后端 pytest 在本次环境中无输出长时间挂起并被停止。

本轮静态核对确认以下差距：

1. `pages/service/index.vue` 对 completed 仍渲染文案为“关闭”的主按钮，但 `advance()` 不处理 completed，点击无效。
2. `.env.example` 使用 `data/community.db`，仓库中没有 `backend/data`，Repository 也不创建受控父目录，按示例配置首次访问返回 503。
3. `Service.accept/complete` 是“读取后无条件 upsert”，并发请求可能同时通过旧状态检查。
4. Pydantic 文本字段只有 `min_length=1`，`ServiceTaskComplete` 未禁止多余字段，缺少存储边界。
5. composable 刷新失败会把 `state` 改为 error；页面优先渲染错误页，即使 `tasks` 中仍保留真实旧数据。
6. 页面打开另一任务或创建表单时未统一清理上一操作的 `actionError`。

## Task 1: 修复详情关闭与错误状态生命周期

**Files:**
- Modify: `code3-community/frontend/src/pages/service/index.vue`
- Modify: `code3-community/frontend/src/composables/useServiceTasks.ts`
- Modify: `code3-community/frontend/src/composables/useServiceTasks.spec.ts`
- Modify: `code3-community/frontend/src/pages/service/page-boundaries.spec.ts`

**Interfaces:**
- Consumes: `detailActionLabel(status)`、`clearActionError()`。
- Produces: completed 详情的确定关闭行为；打开详情/新建表单时无陈旧错误。

- [x] **Step 1: 写失败测试**

在 composable 测试增加 `clearActionError()` 清理上一操作错误的断言；在页面边界测试增加 completed 主操作调用 `closeDetail()` 的静态/行为边界，且 `openDetail()`、`openCreate()` 调用 `clearActionError()`。

- [x] **Step 2: 运行相关测试并确认失败**

Run: `npm test -- --run src/composables/useServiceTasks.spec.ts src/pages/service/page-boundaries.spec.ts`

若因既有依赖缺失无法启动，记录准确错误，不安装依赖；继续以代码审查和后续可运行的纯 TS 配置验证。

- [x] **Step 3: 最小修复页面行为**

在 `advance()` 中对 `completed` 明确调用 `closeDetail()`；`openDetail()` 与 `openCreate()` 先调用 `clearActionError()`。不要在 domain 增加伪状态转换。

- [x] **Step 4: 运行相关验证**

确认 completed 详情不再出现点击无效路径，且错误提示不会跨任务残留。

## Task 2: 让示例数据库路径首次启动可用

**Files:**
- Modify: `code3-community/backend/src/silver_companion_community/dependencies/database.py`
- Modify: `code3-community/backend/tests/test_service_tasks_api.py`
- Modify: `code3-community/backend/.env.example` only if path semantics need clarification

**Interfaces:**
- Consumes: `COMMUNITY_DATABASE_PATH`。
- Produces: `get_service_task_repository()` 在受控范围内创建单层父目录后初始化数据库。

- [x] **Step 1: 写失败测试**

新增测试：环境变量指向 `tmp_path / "data" / "community.db"`，父目录不存在；首次 GET 返回 200 与 `[]`，目录和数据库被创建。另测父路径被文件占用仍返回 503。

- [x] **Step 2: 运行测试并确认失败**

Run: `E:\workspace\silver-companion-env\python.exe -m pytest tests/test_service_tasks_api.py -q`

- [x] **Step 3: 实现受控父目录创建**

在组合根解析 `Path`，只为已配置数据库文件执行 `parent.mkdir(parents=True, exist_ok=True)`；任何 `OSError` 转换为 `ServiceUnavailableError`。不得在 Repository 内隐式创建任意路径，不得插入数据。

- [x] **Step 4: 运行相关测试**

预期新增首次启动用例与既有 503、health 独立性用例均通过。

## Task 3: 原子化状态转换，消除并发丢失更新

**Files:**
- Modify: `code3-community/backend/src/silver_companion_community/repositories/protocols.py`
- Modify: `code3-community/backend/src/silver_companion_community/repositories/sqlite_service_tasks.py`
- Modify: `code3-community/backend/src/silver_companion_community/services/service_tasks.py`
- Modify: `code3-community/backend/tests/test_service_tasks_service.py`
- Modify: `code3-community/backend/tests/test_sqlite_service_task_repository.py`

**Interfaces:**
- Produces: `async def transition_task(self, task: ServiceTask, expected_status: ServiceStatus) -> bool`。
- Semantics: 在单个 `BEGIN IMMEDIATE` 事务中执行带 `WHERE id=? AND status=?` 的 UPDATE；成功更新一行返回 true，否则 false。

- [x] **Step 1: 扩展 Protocol 与 fake repository 失败测试**

测试 Service 的 accept/complete 使用 `transition_task`，返回 false 时重新读取当前任务并抛 `InvalidStateTransitionError`；不存在时仍抛 `TaskNotFoundError`。

- [x] **Step 2: 编写 SQLite 原子转换集成测试**

同一 pending 任务执行两次 expected=pending 的转换：第一次 true，第二次 false；最终状态为 in_service。完成转换同理，并验证 created_at 不改变。

- [x] **Step 3: 实现最小原子更新**

Repository 使用条件 UPDATE，不用先查后 upsert 代替原子判断。Service 继续负责允许哪些转换，Repository 只执行“期望旧状态”的条件写入。

- [x] **Step 4: 运行 Service 与 Repository 测试**

Run: `E:\workspace\silver-companion-env\python.exe -m pytest tests/test_service_tasks_service.py tests/test_sqlite_service_task_repository.py -q`

## Task 4: 收紧请求和存储输入边界

**Files:**
- Modify: `code3-community/backend/src/silver_companion_community/schemas/service.py`
- Modify: `code3-community/backend/tests/test_schemas.py`
- Modify: `code3-community/backend/tests/test_service_tasks_api.py`
- Modify: `code3-community/frontend/src/mappers/serviceTaskMapper.ts`
- Modify: `code3-community/frontend/src/mappers/serviceTaskMapper.spec.ts`

**Interfaces:**
- Produces: 明确的字段最大长度；创建和完成请求均 `extra="forbid"`。

- [x] **Step 1: 写边界测试**

固定限制：`title/category/elder_name` 最大 100，`location` 最大 200，`description/note` 最大 2000。测试边界值通过、超一字符返回 422；complete 多余字段返回 422。

- [x] **Step 2: 实现 Pydantic 约束**

使用独立 Annotated 类型表达不同上限，不把所有字段继续绑定到一个无上限 `NonEmptyText`。`ServiceTaskCreate` 和 `ServiceTaskComplete` 均设置 `extra="forbid"`。

- [x] **Step 3: 前端 mapper 同步相同上限**

在提交前给出确定错误，避免明显无效请求；前端校验不是权威，后端仍必须独立拒绝。

- [x] **Step 4: 运行 schema、API 和 mapper 测试**

分别报告实际可运行结果；不得因前端环境缺失而跳过后端边界验证。

## Task 5: 保留旧数据时使用非阻塞刷新错误

**Files:**
- Modify: `code3-community/frontend/src/composables/useServiceTasks.ts`
- Modify: `code3-community/frontend/src/composables/useServiceTasks.spec.ts`
- Modify: `code3-community/frontend/src/pages/service/index.vue`

**Interfaces:**
- Produces: 首次加载失败使用整页 error；已有 tasks 的刷新失败保留 `state='ready'` 并写入非阻塞 `actionError`。

- [x] **Step 1: 写失败测试**

覆盖首次失败和已有真实列表后的刷新失败两种情况。后者必须保留列表、保持 ready，并显示刷新失败提示。

- [x] **Step 2: 修改 `load()` 状态规则**

进入加载前记录是否已有数据；失败时只有无数据才进入 error，有数据则恢复 ready 并写 `actionError`。成功时清理两类错误。

- [x] **Step 3: 页面展示非阻塞错误**

列表仍可见，在页面固定提示通道展示刷新失败；不得复制数据或回退 mock。

- [x] **Step 4: 运行 composable 与页面边界测试**

确认首次错误仍有重试入口，刷新错误不再隐藏旧列表。

## Task 6: 文档与最终验证

**Files:**
- Modify: `docs/api.md` only if limits/error semantics changed
- Modify: `docs/architecture.md`
- Modify: `docs/progress.md`
- Modify: `docs/superpowers/plans/2026-11-01-community-service-tasks-loop.md` only to append an audit note; do not rewrite history

**Interfaces:**
- Produces: 真实实现状态、已知环境缺口和验证证据。

- [x] **Step 1: 同步文档**

记录字段上限、原子状态转换、首次数据库目录创建边界、非阻塞刷新错误；明确认证仍未实现。

- [x] **Step 2: 后端完整验证**

Run: `E:\workspace\silver-companion-env\python.exe -m pytest -q`

必须记录退出码、通过数、失败数和警告；若挂起，记录卡住的测试节点，不得写“通过”。

- [x] **Step 3: 前端验证**

先运行 `npm test -- --reporter=dot`。若缺 `vitest.cmd` 或其他依赖，停止前端命令，不安装；只运行仓库现有工具能够执行的检查，并将页面/构建标为未验证。

- [x] **Step 4: 产物和边界检查**

检查 `git status --short`、`git diff --check`、数据库文件、`.env`、dist、缓存和跨领域改动。不得删除用户原有改动。

- [x] **Step 5: 最终报告**

逐项报告：已修复问题、实际测试、未验证项、工作区状态、剩余风险。没有新鲜证据不得宣称完成。

---

## 交付收口补记（2026-11-01，delivery-closure 轮追加，不修改上文历史）

本计划执行后仍有 3 处未真正收口，已由 `2026-11-01-community-service-tasks-delivery-closure.md` 处理并更正记录：

1. **本地校验错误被吞**：mapper 抛出的 `ServiceTaskMappingError` 会被 `toServiceTaskError()` 归一成 `unexpected`，页面只显示「操作失败，请重试」。现在 `run()` 优先保留 mapper 原始 message——空字段显示字段名、超长显示「最多 N 个字符」、非法日期显示「服务日期不合法」，且三种情况都不发请求。
2. **并发测试是伪并发**：`test_transition_succeeds_only_once_for_the_expected_status` 只是顺序调用两次。现新增两个真实竞争用例：同一 `tmp_path/community.db`、两个独立 Repository/SQLite 连接、`threading.Barrier` 同步两个线程同时 `transition_task()`，分别覆盖 accept 与 complete，断言结果为 `[False, True]` 且 complete 只保留胜者 note。仓库外脚本验证了夹具敏感性：同样并发下，故意还原的「先查后写」实现返回 `[True, True]`。
3. **验证入口不可复现**：官方 `npm test` 因 `.bin` 缺 `vitest.cmd` 无法启动。现新增独立 `vitest.config.ts`（不加载 uni/Vue 插件、不引用 `vite.config.ts`），`npm test` / `npm run type-check` 直接调用已存在的 `node_modules` 包入口。实测 `npm test` → 9 spec / 80 项通过、`npm run type-check` → exit 0。

实际验证更正（本轮新鲜结果）：

- 后端分组：Service + Repository → 23 passed；API + 错误契约 → 29 passed（1 个第三方 `httpx2` 弃用警告）；全量 `pytest -q` → **80 passed，exit 0**（此前记录的 78 为加固轮结果）。
- 前端：`npm test` → 9 文件 80 项通过，exit 0；此前 76 项为仓库外临时配置的**旁路结果**，不再是当前证据。
- 微信小程序 CLI 构建：**blocked**。`npm run build:mp-weixin` 的 type-check 通过后，uni CLI 报 `Cannot find module '@ampproject/remapping'`（`node_modules/@ampproject/remapping` 目录存在但为空、无 `package.json`；`@babel/core` 同样缺失），exit 1。未安装任何依赖，`dist/build/mp-weixin` 仍是 2026-10-31 旧产物，微信开发者工具预览未验证。
