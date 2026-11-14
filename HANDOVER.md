# 交接文档（2026-11-14）

> 位置：仓库根目录 `HANDOVER.md`。接手前请完整阅读本文件与 `docs/progress.md` 最新章节。

## 一、项目一句话现状

银龄伴三端（老人 Vue3/Capacitor、监护人 uni-app 小程序、社区端 uni-app 小程序）+ 三后端（code1 :8001 单一内容源 / code2 :8002 / code3 :8003）。SOS、课程、视频、学习记录四域已实现并支持 SQLite 持久化；SOS 处置闭环（`ba188ae`：监护人端处置 + 老人端进度反馈）与老人端学习记录页接真实 GET 接口（`a81da60` 功能切片 + `e249927` 加载/失败状态与回归测试，零契约变更）均已完成并提交。老人端「我的求助」页已接真实 SOS 列表（零契约变更）。课程上下架已真实化：code1 新增 `status`/`editable` 与 `POST /api/v1/courses/{course_id}/publication`，SQLite 增第四张表 `course_publications`，社区端教学页可下架/重新发布，老人端前端零改动；code3 的课程域仍保持 501。跨端验收基座已落地，33 项真实链路检查与 `verify-framework.ps1` 组成双门禁；本切片课程上下架的重启持久化（原 Task 6）已由这 33 项验收覆盖。

## 二、SOS 处置闭环（已提交，`ba188ae`）

- **监护人端**：消息详情页对真实 SOS 事件显示状态徽章（待处理/处理中/已解决）与下一步动作按钮（开始处理 → 标记已解决），标记已解决可附处理备注（≤200 字）。
- **老人端**：求助进度页新增「真实处理进度」卡片与刷新按钮，按事件 id 从列表接口回查状态（后端无单条 GET 路由）。
- **后端**：新增 `POST /api/v1/sos-events/{event_id}/transitions` 作为 PATCH 的微信兼容别名（`uni.request` 不支持 PATCH）；`SosEventStatusUpdate` 增加可选 `note`，三个仓库实现透传，SQLite 用 `COALESCE(?, note)` 保持缺省不覆盖。
- **验证（2026-11-14 实测）**：elder backend 53 项全过；监护人端 160 项全过、type-check 0 错、`build:mp-weixin` DONE；老人端 70 项全过（SOS 切片当时；学习记录切片后为 78→80 项，以最终实测为准）、type-check 0 错；code4-shared 契约 3 项全过。
- **回归修复**：消息详情页处置区插入后，空态 `v-else` 会误绑定处置区，导致 mock 消息/已解决 SOS 多出「未找到该消息」；已改为 `v-if="!message"` 并补源码级回归断言。

## 三、必须遵守的约定

- **禁止安装任何依赖**（用户明令；Python 用既有 `E:\workspace\silver-companion-env` 跑 pytest）。
- 测试在**主仓库 `E:\c2--\code`** 跑，不是 hardening worktree（worktree 是给微信开发者工具看产物的）。
- 合并一律 rebase + `--ff-only`，**禁止 force push**；不碰 `test_schemas.py`。
- 微信平台 `uni.request` 不支持 PATCH → 消费端状态推进走 `POST /transitions`；请求体字段是 `data` + `header`（不是 fetch 的 body/headers）。
- 后端契约新增字段/路由必须显式报备用户。
- 后端无单条 SOS GET 路由，老人端查状态用列表接口 + elder_id 过滤。

## 四、下一步开发候选（按优先级）

1. **api 模式双端人工联调**：监护人端处置 → 老人端「求助进度」刷新与「我的求助」列表核对；社区端教学页上下架 → 老人端目录过滤与重新发布恢复。
2. AI/知识库（需用户先决策模型选型，勿自行启动）
3. 人工联调欠账：趋势曲线、功能建设中 toast、课程视频播放/上传联调

注：跨端验收基座已完成并移出候选——入口为 `scripts/verify-acceptance.ps1`，基座代码在 `scripts/acceptance/`（含 `support.py`、`scenarios.py`、`run_acceptance.py` 与 `tests/`），33 项真实链路检查与 `verify-framework.ps1` 互不调用、共同构成发布门禁。

注：code3 后端的救援/知识/课程三个域仍为 501 契约骨架；社区端前端已绕开它们直连 code1，不需要改 code3 路由。

## 五、关键路径速查

- 事实源：`e:\c2--\code`（main）；开发者工具产物目录：`E:\c2--\code-guardian-hardening\code2-guardian\frontend\dist\build\mp-weixin`
- 文档：`docs/api.md`、`docs/architecture.md`（2026-11-14 已与代码同步）、`docs/progress.md`
- 验证入口：`scripts/verify-framework.ps1`（三端测试与构建）、`scripts/verify-acceptance.ps1`（真实三后端 + 临时库 + 重启持久化）
- 验收基座：`scripts/acceptance/`（`support.py` 支撑层、`scenarios.py` 场景层、`run_acceptance.py` 编排器、`tests/` 支撑层单测）
- 环境变量：`VITE_SOS_DATA_MODE` / `VITE_COURSE_DATA_MODE` / `VITE_HEALTH_DATA_MODE`（默认 mock）、`VITE_ELDER_API_BASE_URL`（跨直连 :8001）、`SOS_DATABASE_PATH` / `ELDER_DATABASE_PATH` / `COMMUNITY_DATABASE_PATH`（持久化开关）
