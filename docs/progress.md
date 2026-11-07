# 开发进度

更新日期：2026-11-03

> **⚠️ 工作目录漂移提醒（2026-11-03）**：本项目存在多个 git worktree，代码开发与微信开发者工具实际打开的不是同一目录，容易误判进度。
> - 开发/提交位置：`E:\c2--\code-guardian-hardening`（worktree，分支 `feat-guardian-secondary-pages`，HEAD `012879e`）。
> - 开发者工具实际打开的目录：`E:\c2--\code-guardian`（**已被 `git worktree` 注销的残留目录**，不在 `git worktree list` 中，`git` 报 `not a git repository`）。
> - 主仓库：`E:\c2--\code`（worktree 列表仅含 `code`@main、`code-guardian-hardening`@feat-guardian-secondary-pages、`code-guardian-recovered`@feat-guardian-frontend 三项）。
> - 后果：`code-guardian` 的 `src/` 源码是旧基线（缺六态代码，测试仅 3 文件/11 项）；此前只同步过 `dist/build/mp-weixin` 编译产物，**源码从未对齐**。凡是以 `code-guardian` 目录看到的代码/测试为准判断进度，都会与 `code-guardian-hardening` 的真实实现不符。
> - 建议：把开发者工具的项目路径直接改为 `E:\c2--\code-guardian-hardening\code2-guardian\frontend\dist\build\mp-weixin`，或一次性把 `code-guardian-hardening` 的 `src` 完整同步过去，消除双目录漂移。
> - **已执行（方案一）**：已将 `code-guardian` 的 `project.private.config.json`（开发者工具本地私有配置）复制到 hardening 的 `dist\build\mp-weixin`，两边 `project.config.json` 核对一致（appid=touristappid）。**待用户在微信开发者工具里手动把导入路径改为 `E:\c2--\code-guardian-hardening\code2-guardian\frontend\dist\build\mp-weixin`**，之后每次重跑 `build:mp-weixin` 即自动生效，无需再手动同步旧目录。

2026-11-07：监护人端死链盘点收尾（已实现）。全量盘点 12 个页面的可点入口：advice 4 卡片（→ advice-detail）、消息列表（→ message-detail）、首页 3 入口（→ 三个二级页）此前均已接通；唯一剩余死链为「我的」页菜单 id 1–4（老人管理/家庭成员/提醒设置/消息通知设置），绑定了 `@tap` 但点击无任何响应。处置：保留绑定，点击统一提示「功能建设中」（与首页既有占位提示模式一致），不新增页面、不新增路由、不改后端。测试契约同步改写：`profile-secondary.spec.ts` 锁定完整 toast 调用语句；变异验证确认非空转（删 toast 调用 → 1 failed，还原 → 13 passed；初版断言只匹配到注释文字，已修正）。`npm test` 20 文件 / 114 项、`type-check` exit 0、`build:mp-weixin` DONE；产物已同步到开发者工具监听目录，编译产物 `pages/profile/index.js` 确认含 toast 兜底逻辑。

2026-11-03：监护人端健康展示状态化（代码已在 `code-guardian-hardening` worktree 实现并提交 `012879e`，但**尚未同步到开发者工具实际打开的 `code-guardian` worktree，也未合并 main**；在开发者工具里看到的仍是旧基线，不可据此宣称已交付）。把首页「健康概况 + 近 7 天趋势」与「健康趋势详情」从「直接读取 mock 常量」改为「通过可替换 HealthDataProvider 驱动的六态状态化界面」，面向未来硬件接入的真实使用场景。六态为：`not_connected`（未接入硬件，默认）、`connecting`（连接中，由 useHealthData 的 loading 派生）、`no_data`（已连接暂无数据）、`has_data`（有数据，标注演示数据）、`stale`（数据过期，超过 24 小时）、`error`（数据异常）。新增 `domain/healthDataState.ts`（`deriveHealthState` 纯函数，六态优先级 + 24h 过期阈值可注入 + 非数据态清空 metrics/trend）、`data/healthDataProvider.ts`（`HealthDataProvider` 接口 + `MockHealthDataProvider`，`setState` 仅开发/测试期，不暴露生产）、`composables/useHealthData.ts`（loading 编排 + 错误映射：`health_data_source_unavailable` → not_connected，其余 → error）。页面只依赖 Provider，不直接读 mock 健康常量；`isDemo` 由 Provider 标记，仅 has_data/stale 为 true。未新增后端接口、未接真实 API、未新增页面、未新增硬件控制按钮、未装依赖。`npm test` 20 文件 / 114 项、`type-check` exit 0、`build:mp-weixin` DONE（均在 `code-guardian-hardening` worktree 实测；`code-guardian` worktree 基线为 3 文件 / 11 项，尚无六态代码）。真实硬件未接入，默认显示「未接入硬件」空态。分支 `feat-guardian-secondary-pages`，未推送未合并。**遗留待办：需将六态改动同步/合并到开发者工具使用的 `code-guardian` 目录并重新验收，才能视为交付完成。**

2026-11-03：监护人端新增 AI 建议详情页 `pages/advice-detail/index`（第四个二级页）。四张 AI 建议卡片共用同一详情页，通过 `id` 查询参数读取现有 `adviceList` 对应条目；仅展示标题、描述、图标与「演示数据」标识，无效 id 显示「未找到该建议」空状态，不伪造内容、无医疗/药物/风险/来源/时间等字段。AI 建议页四张卡片接入 `navigateTo`（复用 `secondaryNavigation` 并发锁与失败提示），`domain/routes.ts` 新增 `adviceDetail` 常量。本轮前已修复 custom-tab-bar 高亮不同步（四 tab 页 onShow 调 `getTabBar().syncSelected()`，新增 `domain/tabBarSync.ts` 及测试）。`npm test` 12 文件 / 64 项通过，`type-check` 与 `build:mp-weixin` 通过。未改后端、未改三个既有二级页、未新增依赖。分支 `feat-guardian-secondary-pages`，未推送未合并。

2026-11-02：监护人端新增三个二级页面（老人档案详情 / 健康趋势详情 / 今日提醒列表），均为普通页面、不进入 tabBar。首页原有三处「功能建设中」占位入口改为 `navigateTo`，路由集中在 `domain/routes.ts`；新增 `domain/secondaryNavigation.ts` 提供并发锁与失败提示（快速重复点击不叠加打开、失败弹「页面打开失败，请重试」），新增 `domain/trendSummary.ts` 由现有 7 点序列派生最高/最低/平均（空序列返回 null，不除零）。数据只取现有虚构演示数据：档案页仅展示 `elderProfile` 的姓名/年龄/关系/绑定状态四个字段，趋势页复用 `heartRateTrend` 与 `buildTrendPoints`，提醒页只读展示现有 2 条且无任何可操作控件；三页均带「演示数据」标识。未改后端、未改 AI 建议/消息/我的、未新增依赖、已提交。新增 5 个测试文件并改写 `App.spec.ts` 与 `healthTrend.spec.ts` 中的断言：`npm test` 10 文件 / 52 项通过，`npm run type-check` 与 `npm run build:mp-weixin` 通过；产物 `app.json` 含 7 个页面且 `tabBar.list` 仍为 4 项。微信开发者工具服务端口（19567/3799/9420）均未监听，真机与模拟器表现未验证。分支 `feat-guardian-secondary-pages`（因本机无法创建带斜杠的分支名，改用扁平命名），未合并未推送。

2026-11-01：监护人端首页与主导航加固（功能分支验证完成，微信开发者工具人工验收 blocked）。四个一级页面由逐页 `redirectTo` 改为正式 `tabBar + switchTab`，使用单一微信原生 `custom-tab-bar`，扩大触控区并增加按压、并发锁与失败提示；Tab 页面再次显示时复用实例，消息筛选状态可保留。首页近 7 天趋势明确为虚构的“每日平均静息心率”演示数据，补日期与单位，canvas 使用有界坐标和裁剪避免覆盖标题；移除无业务含义的黄色铃铛与提醒空心圆，规划入口只提示“功能建设中”。监护人后端、AI 建议卡片、“我的”菜单、硬件与真实健康数据均未修改。前端 `npm test` 为 5 文件 / 19 项通过，类型检查与 `build:mp-weixin` 通过。微信开发者工具 CLI 已成功启动服务，但导入构建产物返回 code 10「不存在此 AppID」，未修改 AppID 或源码绕过，故首次/重复切换与视觉布局仍需在有效测试号下人工确认。

2026-11-01：官方根验证脚本的后端工作目录问题已在 `b4f1411` 修复；脚本现在进入各组件根目录运行 pytest，完整入口已返回 exit 0。下文 `f5d073e` 收口记录中的 exit 1 是修复前历史证据。

2026-11-01：主仓库合并后交付收口（仅验证与文档，未新增业务能力）。当前 `main` 基线为 `f5d073e`，同一提交同时包含监护人端四页 UI 原型与社区端「社区服务任务」前后端闭环。本轮按官方根脚本与组件级命令重跑测试、类型检查与微信小程序构建，并核对两个 `dist/build/mp-weixin` 产物；根脚本在老人端后端 `pytest` 处因工作目录相对路径失败而中断，组件级复跑全部通过（详见「验证结果」）。微信开发者工具对当前产物的预览因本机服务端口关闭被阻断，属工具权限限制，未修改源码或提交本地测试配置绕过。监护人端四页仍为 mock 演示 UI，不是真实监护业务闭环。

2026-11-01：社区端「社区服务任务」完成交付收口（已实现）。① 前端本地校验不再退化为「操作失败，请重试」：`composable` 捕获 `ServiceTaskMappingError` 时保留 mapper 给出的具体原因（空字段、超长、非法日期），HTTP 错误仍走统一归一化。② 补两个真实竞争测试：同一 `tmp_path/community.db` 上两个独立 Repository/SQLite 连接用 `threading.Barrier` 同时执行 `transition_task()`，一次 accept 竞争与一次 complete 竞争，结果均为 `[False, True]`。③ 恢复官方入口：新增独立 `vitest.config.ts`（不加载 uni/Vue 插件、不引用生产配置），`npm test` 与 `npm run type-check` 改为直接调用已存在的 `node_modules` 包入口，不再依赖缺失的 `.bin` shim。④ 顺手修掉一处测试卫生缺陷：Repository 测试里 `with sqlite3.connect(...)` 只提交事务、不关闭连接，Windows 下会让 pytest 无法删除临时目录（`%TEMP%\pytest-of-Asus` 中累积 33 个 `garbage-*` 目录，并在 stderr 打印 `SystemExit: 1`）；改为 `contextlib.closing` 后连续 3 次运行无 stderr、无新增 garbage 目录。⑤ 初次 CLI 构建曾因不完整的 `node_modules` 缺少 `@ampproject/remapping` 而受阻；获得用户安装授权后执行 `npm ci` 重建锁定依赖，随后官方测试、类型检查和 `npm run build:mp-weixin` 均通过。微信开发者工具的当前构建产物预览已在同日收口轮实际尝试，结果为 blocked（本机服务端口关闭），见文末「验证结果」。

2026-11-01：社区端「社区服务任务」完成链路加固（已实现）。修复 5 处已确认缺陷：已完成详情的主按钮现在真的关闭详情；`COMMUNITY_DATABASE_PATH` 指向尚不存在的父目录时首次访问会为该文件创建父目录而非 503；`accept`/`complete` 改为 `BEGIN IMMEDIATE` 内条件更新，并发重复操作只有一个成功、另一个得到 409；文本字段增加明确上限（`title`/`elder_name`/`category` 100、`location` 200、`description`/`note` 2000）且创建/完成请求禁止未定义字段；已有列表时刷新失败改为保留旧列表 + 列表外非阻塞提示，只有首次加载失败才显示整页错误。前端 mapper 使用同一组上限提前报错。认证、授权、通知、求助、AI 与设备能力仍未实现。

2026-11-01：社区端「社区服务任务」完成第一条真实前后端闭环（已实现）。后端新增 `service_errors.py`、`services/service_tasks.py`、`repositories/sqlite_service_tasks.py`、`dependencies/database.py`，把 `POST /{id}/transitions` 替换为 `POST /{id}/accept` 与 `POST /{id}/complete`，并新增 `POST /api/v1/service-tasks` 创建；存储为本地开发用 SQLite 单表 `service_tasks`（`COMMUNITY_DATABASE_PATH`，仅 `CREATE TABLE IF NOT EXISTS`，无 seed）。前端服务页面移除 mock 依赖，改为 `composables/useServiceTasks` + `api/serviceTasks` + `mappers/serviceTaskMapper` + `domain/serviceFlow`，具备加载/空/错误/重试与新建表单。`AGENTS.md` 增加仅限本域的数据库例外。救援、知识、课程仍为 501 契约骨架；认证、通知、求助、AI 与设备能力未涉及（未实现）。

2026-10-26：老人端完成第一轮解耦整理，账户与服务页面已拆分，领域类型与组合函数已独立，旧桌面预览 CSS 已清除；未新增业务能力或后端接口。

2026-10-26：老人端后端新增课程与学习记录接口骨架、四条 `/api/v1` 契约路由、严格请求模型和统一 501 错误。没有数据库、仓储实现或后端模拟数据，不能视为业务功能完成。

2026-10-31：社区端后端建立 `/api/v1` 契约骨架，覆盖救援、服务、知识、课程 4 个域共 10 条路径 / 12 个操作，合法请求统一 501、非法请求 422，并补齐 `api / schemas / errors / services / repositories` 五层与 OpenAPI 说明。没有数据库、仓储实现或后端数据，不能视为业务功能完成。同日重建 git 仓库，首个提交 `2480823`，基线标签 `baseline-2026-10-31`。

## 老人端演示版增量

- 已将确认的预览落地为 Vue 页面、组件、独立演示数据模块和模式开关。
- 具备模拟求助、教学筛选、文字草稿、家人权限、设备展示、大字设置。
- 真实 AI、语音、视频、认证、数据库、通知、硬件均未接入。
- 下文为 2026-10-24 框架验收历史；无模拟数据结论不再适用于获批的老人端演示模式。
- 本次验收见 `elder-demo-acceptance.md`。

## 社区端小程序原型迁移

- 依据原型 `shequ-temp/index.html` 实现 5 个社区端页面，UI 使用独立 mock 数据。
- 不接后端：`code3-community` 后端仍只有 `GET /health`。
- 「当前阶段明确不做」中关于社区端业务页面的限制，自本小节起解除；数据库、真实数据、认证仍不涉及。

## 已完成

> 本节为历史里程碑记录。其中「微信开发者工具模拟器预览」为 **2026-10-31** 的状态；2026-11-01 社区端初次构建曾因依赖目录不完整受阻，后在用户授权下用 `npm ci` 恢复锁定依赖并重新构建成功。当前状态以文末「验证结果」为准。

- 老人端 Vue 3 + TypeScript + Vite + Capacitor Android 骨架和最小识别页面。
- 监护人端、社区端两个独立的 uni-app + Vue 3 + TypeScript 微信小程序骨架。
- 监护人端四页 UI 原型（老人画像/首页、AI 建议、消息中心、我的）已合入 `main`（2026-11-01）。页面直接读取 `src/mock/data.ts` 的虚构演示数据；`src/api/client.ts` 只是未接线的请求基础设施；`code2-guardian/backend` 仍只有 `GET /health`。该四页不是真实监护业务闭环。
- 三个独立 FastAPI 后端骨架及无数据库依赖的 `GET /health`。
- 三端前端 API 请求封装和安全的 `.env.example`。
- `code4-shared` 健康契约、公共模型预留位置及五类待实现接口。
- 前端测试、后端健康测试和共享契约测试文件。
- 根级启动、验证、架构和接口文档。
- 三个前端现有测试、类型检查和生产构建验证。
- 老人端 Web 开发服务器启动及 HTTP 入口验证；两个小程序端使用持续编译和微信开发者工具预览，不再提供浏览器端口。
- 三个后端现有健康测试、Uvicorn 启动及 `/health` HTTP 验证。
- 共享模块现有契约测试。
- 禁用数据库、数据脚本和模拟数据的最终文件扫描。
- 已在老人端加入 Capacitor 8.5.3，生成独立 Android 原生工程。
- 老人端最小页面可检查 `/health`，并具有连接成功和失败状态。
- 老人端 Web 测试更新为 2 个用例并通过；Capacitor Android 资源同步通过。
- 两个小程序端各 3 个测试通过，`dist/build/mp-weixin` 生产构建通过，并明确关闭 uni 使用统计。
- 老人端 Android Debug APK 已使用仓库外的 E 盘 JDK、Android SDK 和 Gradle 缓存完成构建，并在独立的 `SilverCompanion_API37` 虚拟机中安装启动。
- 监护人端和社区端的生产构建已分别导入微信开发者工具，使用测试号完成模拟器首页预览。
- Python 解析顺序已解耦为脚本参数、`SILVER_COMPANION_PYTHON`、当前 PATH，不再写死机器路径。
- Git 仓库已初始化；移动端迁移工作位于 `feat/mobile-client-platforms` 分支。

## 验证结果

### 本轮收口实测（2026-11-01，基线 `f5d073e`）

- 官方根脚本 `.\scripts\verify-framework.ps1 -Python "E:\workspace\silver-companion-env\python.exe"`（未加 `-IncludeAndroid`）→ **exit 1**。
  - 通过的前三段：老人端前端 `npm test` → 7 个测试文件 / 20 项通过，`npm run build`（`vue-tsc` + `tsc` 类型检查 + `vite build`）通过；监护人端前端 `npm test` → 3 个 spec / 11 项通过，`build:mp-weixin`（含类型检查）通过；社区端前端 `npm test` → 9 个 spec / 80 项通过，`build:mp-weixin`（含类型检查）通过。
  - 第一个失败点：`code1-elder/backend/tests/test_schemas.py::test_backend_declares_the_pydantic_v2_contract` → `FileNotFoundError: 'pyproject.toml'`。根因是脚本从仓库根目录调用 `pytest`，而该用例用 `Path("pyproject.toml")` 依赖当前工作目录；属执行方式问题，不是业务代码失败，未修改脚本或源码。
  - 脚本按 `exit $LASTEXITCODE` 在首个失败处中断，因此监护人端后端、社区端后端与共享层测试未由根脚本执行，改用组件级命令补齐。
- 组件级复跑（工作目录为该组件目录）：
  - 老人端后端 `pytest -q` → 13 passed，exit 0。
  - 监护人端后端 `pytest -q` → 1 passed（仅 `/health`），exit 0。
  - 社区端后端 `pytest -q` → 80 passed，exit 0，仅 1 个第三方 `httpx2` 弃用警告；未出现 `socket._fallback_socketpair` 卡死。
  - 共享层 `pytest -q` → 3 passed，exit 0。
- 本轮测试合计 208 项通过：前端 111 项（20 + 11 + 80）+ 后端 94 项（13 + 1 + 80）+ 共享 3 项；三处类型检查（老人端 Web、监护人端、社区端）均 exit 0。
- 微信小程序产物（仅主仓库路径）：`code2-guardian/frontend/dist/build/mp-weixin`（构建时间 21:32）与 `code3-community/frontend/dist/build/mp-weixin`（构建时间 21:34）第一层均含 `app.js`、`app.json`、`project.config.json`；`appid` 为 `touristappid`，产物内未出现 `.env`、数据库、Token 或测试凭据文件。
- 微信开发者工具预览：**blocked**。`cli islogin` 返回 `{"login":true}`，但 `cli open --project <产物>` 报 `wait IDE port timeout`；显式 `--port 19567` 后返回「工具的服务端口已关闭」，同时 `127.0.0.1:19567` 与 `127.0.0.1:3799` 均无监听。结论为「CLI 构建通过，开发者工具预览 blocked」，未修改源码、未写入 AppID 绕过。
- Git 状态：`main`、`HEAD`、`origin/main` 同为 `f5d073e`；`git diff --check` 无输出；`git fsck --full` exit 0；`git worktree list` 实际输出两条（`code` 在 `main`，`code-guardian-recovered` 在 `feat-guardian-frontend`），未做修复或清理。

### 历史记录（以下为本轮之前的结论，不构成 2026-11-01 收口轮的证据）

- 历史 · 社区服务任务交付收口（2026-11-01 早前轮次，官方命令）：
  - 后端分组：`tests/test_service_tasks_service.py` + `tests/test_sqlite_service_task_repository.py` → 23 passed；`tests/test_service_tasks_api.py` + `tests/test_error_contract.py` → 29 passed（1 个第三方 `httpx2` 弃用警告）；社区后端全量 `pytest -q` → 80 passed，exit 0。
  - 前端官方：`npm test` → 9 个 spec / 80 项通过，exit 0（覆盖 `src/**/*.spec.ts`，含 4 项新增本地校验用例）；`npm run type-check` → exit 0，无 TypeScript 错误。
  - 微信小程序：获得用户安装授权后执行 `npm ci`，随后 `npm run build:mp-weixin` → type-check 与 uni CLI 均通过，exit 0，并生成新的 `dist/build/mp-weixin`；微信开发者工具对该产物的预览在早前轮次未完成；2026-11-01 收口轮已实际尝试，结果为 blocked（本机服务端口关闭），见上文本轮实测。
- 历史旁路记录（非官方命令）：加固轮的 76 项前端测试通过仓库外临时 vitest 配置直接运行 `node_modules/vitest/vitest.mjs` 得出，当时官方 `npm test` 因缺少 `node_modules/.bin/vitest.cmd` 无法启动；该结果已被本轮官方命令取代，仅作历史。
- 历史 · 前端测试（2026-10-31 实测）：老人端 20 项（7 个测试文件）、监护人端 3 项、社区端 25 项（5 个测试文件）全部通过；其中监护人端与社区端数字已被本轮 11 项 / 80 项取代。
- 历史 · 前端生产构建（2026-10-31 至 2026-11-01 早前轮次）：老人端 Web、监护人端微信小程序、社区端微信小程序均通过；本轮已重新构建两个小程序产物。
- 历史 · 后端测试（2026-10-31 实测）：老人端 13 项、监护人端 1 项、社区端 12 项，共 26 项通过；存在依赖库的 `httpx2` 未来弃用警告，不影响通过结果。社区端已增至 80 项（本轮实测）。
- 共享契约测试：3 项通过（本轮与历史一致）。
- 历史 · 测试总数：77 项全部通过（2026-10-31 实测，前端 48 + 后端 26 + 共享 3）；本轮为 208 项。
- 历史基线启动：老人端 Web 5173 与后端 8001/8002/8003 均验证过 HTTP 200；两个小程序端通过 CLI 编译和微信开发者工具模拟器首页预览。
- 禁用产物：数据库、SQL、迁移、seed、业务数据文件和相关实现均为 0。
- Android 原生编译：通过。Gradle 8.14.3 分发包与官方 SHA-256 校验值一致，Debug APK 构建、模拟器安装和 `com.silvercompanion.elder/.MainActivity` 前台启动均已验证。
- Android 运行环境位于仓库外的 E 盘；银龄伴使用独立虚拟机 `SilverCompanion_API37`。原 `Pixel_7`、`com.example.test` 和原虚拟机设置均保留。
- 微信开发者工具位于 `E:\software\developers.weixin`；工具、登录状态、测试号私有配置和构建产物均不提交仓库。

## 当前阶段明确不做

- 数据库选型、建表、迁移、初始化、seed 和数据导入：**默认禁令仍然有效**。
  - 唯一明确授权的例外是社区端「社区服务任务」（2026-11-01 用户授权）：只允许 Python 标准库 `sqlite3`、只允许单表 `service_tasks`、只允许用户在小程序页面主动录入且不含真实个人信息的本地开发任务；禁止 seed、预置数据与迁移框架。
  - 救援、知识、课程三个社区领域，以及老人端、监护人端，仍受原禁令约束，该例外不外溢。
- 任何真实或模拟业务数据；社区服务任务页面允许用户主动录入的本地开发数据，同样不得包含真实个人信息。
- 登录、授权、通知、求助流程和完整 UI。
- RAG、向量库、老人记忆、数字画像、模型调用和设备接入实现。
- 监护人端和社区端其余业务页面、正式 AppID 配置及发布流程（社区服务任务页面除外）。

## 下一里程碑建议

移动端空白框架已完成实际运行验证。下一里程碑建议先冻结当前框架基线，再评审三端页面清单、导航和无数据 UI；正式 AppID、发布、数据设计与数据来源仍须单独确认后开展。

