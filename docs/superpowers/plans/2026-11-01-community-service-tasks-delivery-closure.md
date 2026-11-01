# Community Service Tasks Delivery Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复剩余的前端错误提示与并发测试缺口，建立无需安装依赖即可重复执行的官方验证入口，并对微信小程序交付路径给出可复现结论。

**Architecture:** 不改变社区服务任务业务链路。前端本地校验错误在 composable 边界保留，HTTP 错误继续走统一归一化；SQLite 条件更新保持不变，只补真正的竞争测试；测试配置与 uni 构建配置分离，避免纯 TS 测试加载不需要的 uni 插件。

**Tech Stack:** Vue 3、TypeScript、uni-app、Vitest、vue-tsc、FastAPI、pytest、Python 标准库 sqlite3。

**Spec:** `docs/superpowers/specs/2026-11-01-community-service-tasks-loop-design.md`

## Global Constraints

- 工作目录：`E:\c2--\code`。
- 先完整阅读 `AGENTS.md`、设计文档、loop 计划、hardening 计划和本计划。
- 严禁安装、升级、卸载或补齐任何依赖。
- 严禁修改 `node_modules`、生成或复制 `.bin` shim。
- 不修改老人端、监护人端或社区救援/知识/课程业务代码。
- 不创建 seed、预置数据或真实个人数据。
- 不提交、不推送、不创建分支。
- 不删除、放宽或跳过测试来制造通过结果。
- 微信构建缺依赖时必须记录阻塞，不得从其他应用复制依赖。
- 每个任务先补失败测试，再做最小修改，再运行相关验证。

## Review Focus

- 空字段、超长字段、非法日期必须显示 mapper 提供的具体原因，不能退化为“操作失败”。
- 两个独立 SQLite 连接竞争同一 pending/in_service 任务时只能一个条件更新成功。
- `npm test` 必须执行全部 9 个现有 spec，不能只挑社区服务任务测试。
- 新测试配置不得加载 uni 插件，也不得改变生产构建配置。
- `npm run build:mp-weixin` 的结果必须来自当前代码和当前依赖，旧 dist 不能作为通过证据。

---

## Task 1: 保留前端本地校验的具体错误

**Files:**
- Modify: `code3-community/frontend/src/composables/useServiceTasks.ts`
- Modify: `code3-community/frontend/src/composables/useServiceTasks.spec.ts`

**Interfaces:**
- Consumes: `ServiceTaskMappingError` from `mappers/serviceTaskMapper.ts`。
- Produces: 本地草稿错误直接进入 `actionError`；HTTP/API 错误继续使用 `toServiceTaskError()`。

- [x] **Step 1: 写失败测试**

新增三类断言：空标题显示具体字段错误；101 字标题显示“最多 100 个字符”；非法日期显示“服务日期不合法”。三种情况均不得调用 `api.create()`，且不得只显示“操作失败，请重试”。

- [x] **Step 2: 运行 composable 测试并确认失败**

优先运行计划 Task 3 建立后的官方命令；在 Task 3 之前可直接调用现有 Vitest 包入口和仓库外临时配置，但不得据此宣称官方命令已恢复。

- [x] **Step 3: 最小修改 `run()` 错误分支**

若 error 是 `ServiceTaskMappingError`，将其原始 `message` 写入 `actionError` 并返回 false；其他错误保持现有 HTTP 归一化、409/404 重载逻辑。不要让 composable 依赖字段上限常量或复制 mapper 规则。

- [x] **Step 4: 运行相关测试**

确认新增用例、创建失败不污染列表、重复点击互斥和 409 重载用例均通过。

## Task 2: 补真正的 SQLite 竞争测试

**Files:**
- Modify: `code3-community/backend/tests/test_sqlite_service_task_repository.py`
- Modify: `code3-community/backend/src/silver_companion_community/repositories/sqlite_service_tasks.py` only if the test exposes a real defect

**Interfaces:**
- Consumes: `SqliteServiceTaskRepository.transition_task(task, expected_status) -> bool`。
- Produces: 两个独立 Repository/SQLite 连接同时竞争时，一个 true、一个 false。

- [x] **Step 1: 编写并发集成测试**

用同一个 `tmp_path/community.db` 创建两个 Repository 实例；使用 `threading.Barrier` 同步两个工作线程，同时通过各自事件循环调用 `transition_task()`。收集结果并断言排序后等于 `[False, True]`，最终状态正确且没有未捕获异常。

- [x] **Step 2: 增加 complete 竞争覆盖**

先把任务推进到 in_service，再让两个独立连接同时尝试 completed；断言仅一个成功，最终 note 等于成功写入者的 note，而不是拼接或空值。

- [x] **Step 3: 运行 Repository 测试**

Run: `E:\workspace\silver-companion-env\python.exe -m pytest tests/test_sqlite_service_task_repository.py -q`

若出现 `database is locked`，先判断是预期竞争还是超时配置缺陷；只允许在 Repository 连接层设置明确且有测试的有限 timeout，不得重试业务状态转换。

- [x] **Step 4: 运行 Service 与 API 回归测试**

Run: `E:\workspace\silver-companion-env\python.exe -m pytest tests/test_service_tasks_service.py tests/test_service_tasks_api.py -q`

## Task 3: 恢复可重复的官方前端测试与类型检查入口

**Files:**
- Create: `code3-community/frontend/vitest.config.ts`
- Modify: `code3-community/frontend/package.json`
- Do not modify: `code3-community/frontend/vite.config.ts`

**Interfaces:**
- Produces: `npm test` 覆盖 `src/**/*.spec.ts`；`npm run type-check` 直接调用已存在的 vue-tsc 包入口。

- [x] **Step 1: 新增独立 Vitest 配置**

`vitest.config.ts` 只使用 `defineConfig`，设置 `test.environment='node'` 和 `include=['src/**/*.spec.ts']`；不得导入 `@dcloudio/vite-plugin-uni`、Vue 插件或生产 `vite.config.ts`。

- [x] **Step 2: 修改 package scripts**

将：

- `test` 设为 `node ./node_modules/vitest/vitest.mjs run --config vitest.config.ts`；
- `type-check` 设为 `node ./node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.app.json`。

只绕过缺失的 `.bin` shim，不更改依赖版本、package-lock 或测试范围。

- [x] **Step 3: 验证官方命令**

Run: `npm test`

Expected: 发现并执行全部 9 个 spec；测试数不得少于当前记录的 76 项加 Task 1 新增项。

Run: `npm run type-check`

Expected: exit 0，无 TypeScript 错误。

- [x] **Step 4: 防止测试配置污染构建**

静态检查 `vite.config.ts` 未被修改；运行测试时日志不得加载 uni 插件或要求 `@babel/core`。

## Task 4: 建立无需 `.bin` 的小程序构建入口并真实执行

**Files:**
- Modify: `code3-community/frontend/package.json`
- Modify: `docs/progress.md` based on actual result only

**Interfaces:**
- Produces: `npm run build:mp-weixin` 直接调用 `@dcloudio/vite-plugin-uni/bin/uni.js`。

- [x] **Step 1: 修改 uni scripts 的启动方式**

将 `dev:mp-weixin` 和 `build:mp-weixin` 中的 `uni` 替换为 `node ./node_modules/@dcloudio/vite-plugin-uni/bin/uni.js`；保留现有参数和先执行 type-check 的顺序。

- [x] **Step 2: 运行当前代码的生产构建** —— **状态：后续复验通过**

Run: `npm run build:mp-weixin`

不得安装缺失的 `@babel/core`。若失败，记录完整首个根因和 exit code，并将构建状态标记为 blocked；不得引用旧 `dist/build/mp-weixin` 作为通过证据。

实际结果（2026-11-01 16:35 前后复跑，与 14:3x 一轮结果一致，均未通过）：type-check 先通过，随后 uni CLI 失败，exit code `1`，首个根因为：

```text
Error: Cannot find module '@ampproject/remapping'
code: 'MODULE_NOT_FOUND'
require 链首项: node_modules\@dcloudio\uni-cli-shared\dist\vite\plugins\vitejs\utils.js
```

`node_modules/@ampproject/remapping` 目录存在但为空（无 `package.json`、无文件），`@babel/core` 同样缺失。未安装、未复制、未创建 shim。

后续状态（2026-11-01）：用户明确授权安装后执行 `npm ci` 重建锁定依赖；`npm run build:mp-weixin` 随后完成 type-check 与 uni CLI 构建，exit code `0`。本条保留上方首次失败证据，同时以本段作为当前构建结论。

- [x] **Step 3: 构建成功时检查产物** —— **状态：后续构建已生成新产物**

只有 exit 0 时才检查新产物时间、服务页面生成文件和静态资源；确认构建未把 `.env`、数据库或测试配置打进业务数据。

后续成功构建已刷新 `dist/build/mp-weixin`；构建产物继续由 `.gitignore` 排除，未进入提交。

- [ ] **Step 4: 微信开发者工具预览门槛** —— **状态：未完成（未验证）**

只有生产构建成功后才允许导入当前生成的 `dist/build/mp-weixin`。如本轮无法操作 GUI，明确记录“CLI 构建通过但开发者工具预览未验证”，不得写成完整交付通过。

CLI 构建现已通过；当前构建产物的开发者工具预览仍标记为未验证，不据此宣称完整交付通过。

## Task 5: 后端全量验证的可诊断执行

**Files:**
- Modify tests/product code only if a reproducible failing test identifies a defect
- Modify: `docs/progress.md` based on evidence

**Interfaces:**
- Produces: 可定位到具体测试节点的后端验证结果。

- [x] **Step 1: 先运行纯 Service/Repository 测试**

Run: `E:\workspace\silver-companion-env\python.exe -m pytest tests/test_service_tasks_service.py tests/test_sqlite_service_task_repository.py -vv -s`

- [x] **Step 2: 再运行 API/错误测试**

Run: `E:\workspace\silver-companion-env\python.exe -m pytest tests/test_service_tasks_api.py tests/test_error_contract.py -vv -s`

若挂起，使用 `-vv` 最后打印的测试节点作为阻塞证据；不得继续声称 78 项通过。

- [x] **Step 3: 运行社区后端全量测试**

Run: `E:\workspace\silver-companion-env\python.exe -m pytest -q`

记录通过数、失败数、警告和 exit code。只有 exit 0 才能更新“全量通过”。

## Task 6: 最终交付审计

**Files:**
- Modify: `docs/progress.md`
- Append audit note: `docs/superpowers/plans/2026-11-01-community-service-tasks-hardening.md`

**Interfaces:**
- Produces: 区分代码实现、自动测试、CLI 构建和 GUI 预览的真实状态。

- [x] **Step 1: 更新文档**

只写本轮实际复现的结果；删除或改写无法复现的“全量通过”表述。临时配置结果必须明确标为历史旁路验证。

- [x] **Step 2: 检查 Git 和禁用产物**

Run: `git diff --check`

Run: `git status --short`

确认没有 `.db`、真实 `.env`、测试临时文件进入待提交集合；忽略目录中的历史 dist/__pycache__ 不得误写成“磁盘不存在”。

- [x] **Step 3: 对照验收分层报告**

分别报告：

1. 代码审查已确认；
2. 后端自动测试；
3. 前端官方测试；
4. 类型检查；
5. 微信 CLI 构建；
6. 微信开发者工具预览；
7. 尚未实现的认证/通知等产品能力。

- [x] **Step 4: 停止**

不提交、不推送。把所有失败和阻塞保留给用户决定，不擅自安装依赖或扩大范围。

---

## 本轮执行结果（2026-11-01，追加记录，不改写上文）

- Task 1：完成。`run()` 对 `ServiceTaskMappingError` 保留原始 message；新增 4 个用例（空标题、超长标题、非法日期、校验失败不动列表），composable 由 15 项增至 19 项。
- Task 2：完成。新增 `_run_racing_transition` 夹具与 2 个双连接竞争用例，Repository 测试由 10 项增至 12 项，全绿。夹具敏感性用仓库外脚本证明：非原子「先查后写」实现同样并发下返回 `[True, True]`，原子实现返回 `[False, True]`。同时修掉一处测试卫生缺陷：原 `with sqlite3.connect(...)` 不关闭连接，Windows 下导致 pytest 临时目录清理失败（`%TEMP%\pytest-of-Asus` 累积 33 个 `garbage-*`、stderr 打印 `SystemExit: 1`）；改用 `contextlib.closing` 后连续 3 次运行无 stderr、无新增 garbage 目录。
- Task 3：完成。新增 `vitest.config.ts`；`npm test` → 9 spec / 80 项通过；`npm run type-check` → exit 0；`vite.config.ts` 零改动；测试日志无 uni 插件与 `@babel/core` 痕迹。
- Task 4：Step 1 完成；Step 2 初次因不完整依赖目录 blocked，后在用户明确授权下执行 `npm ci`，官方 `npm run build:mp-weixin` 复验通过并刷新产物；Step 3 完成；Step 4 当前产物的开发者工具预览仍未验证。
- Task 5：完成。分组 `-vv -s` 运行 23 + 29 项，无挂起；全量 `pytest -q` → 80 passed，exit 0。
- Task 6：完成。`docs/progress.md` 按本轮证据改写，历史旁路结果明确标注；本文件与 hardening 计划追加记录；未提交。

## 交付审计（Task 6 Step 3 分层结论，2026-11-01）

| 层级 | 结论 | 证据 |
|---|---|---|
| 1. 代码审查 | 已确认 | `run()` 保留 `ServiceTaskMappingError.message`；`transition_task` 用 `BEGIN IMMEDIATE` + `WHERE id=? AND status=?`；`vitest.config.ts` 不含 uni/Vue 插件；`vite.config.ts` 零改动 |
| 2. 后端自动测试 | 通过 | 分组 23 + 29 passed；全量 `pytest -q` → 80 passed，exit 0，1 个第三方 `httpx2` 警告 |
| 3. 前端官方测试 | 通过 | `npm test` → 9 spec / 80 项，exit 0（连跑两次一致） |
| 4. 类型检查 | 通过 | `npm run type-check` → exit 0 |
| 5. 微信 CLI 构建 | 通过 | 用户授权后执行 `npm ci` 重建锁定依赖；`npm run build:mp-weixin` exit 0，生成新产物 |
| 6. 开发者工具预览 | 未验证 | CLI 新产物已生成，但当前产物尚未作为本轮开发者工具预览证据 |
| 7. 产品能力 | 未实现 | 认证、授权、通知、求助、RAG、设备；救援/知识/课程仍 501 |

工作区：19 个已修改 + 21 个未跟踪，全部未提交、未推送、未建分支；`git diff --check` exit 0。仓库内无 `*.db`、无真实 `.env`；`%TEMP%\pytest-of-Asus` 下 33 个历史 `garbage-*` 目录为既有遗留，本轮已确认不再新增。

剩余风险：uni 构建缺件可能不止 `@ampproject/remapping` 与 `@babel/core`；竞争测试依赖线程调度，未在高负载下压测；npm 脚本写死包内入口路径，升级依赖后需复核；认证/授权未实现；`docs/progress.md` 的「已完成」小节仍保留 2026-10-31 历史数字。
