# 银龄伴框架接口说明

更新：2026-11-14。模拟数据只存在于各端前端（Provider 工厂默认 mock），不作为 API 返回。

已实现的业务链路（截至 2026-11-14）：

- **code1 老人端后端**：SOS 事件、课程、视频、学习记录四个域全部真实实现，且支持 SQLite 持久化（`SOS_DATABASE_PATH` / `ELDER_DATABASE_PATH`，未设置时进程内存存储、重启即清）。
- **code3 社区端后端**：社区服务任务 5 个端点真实实现（SQLite，`COMMUNITY_DATABASE_PATH`）。
- **code2 监护人端后端**：健康总览 1 个端点（未接硬件，恒 503）。
- 三端前端均默认 mock；通过 `VITE_SOS_DATA_MODE` / `VITE_COURSE_DATA_MODE` / `VITE_HEALTH_DATA_MODE` 切换 api 模式。监护人端与社区端的 SOS、课程能力**跨直连 code1**（`VITE_ELDER_API_BASE_URL`，默认 127.0.0.1:8001），不经过各自后端。

三个后端均实现：

```http
GET /health
```

响应状态：`200 OK`

老人端响应：

```json
{"status":"ok","service":"elder-backend"}
```

监护人端响应：

```json
{"status":"ok","service":"guardian-backend"}
```

社区端响应：

```json
{"status":"ok","service":"community-backend"}
```

健康检查不依赖数据库、业务数据、API Key 或外部服务。FastAPI 自动文档分别位于各后端的 `/docs` 和 `/openapi.json`。

## 前端 API 封装

老人端的 `src/api/client.ts` 使用浏览器 `fetch`。监护人端和社区端分别实现独立的 uni-app 请求封装，使用 `uni.request`，不跨应用导入源码。三端均暴露：

```ts
apiRequest<T>(path: string, options?): Promise<T>
```

基础地址来自 `VITE_API_BASE_URL`（各端默认本机端口 8001/8002/8003）。非 2xx 响应会抛出带状态码的错误。小程序开发者工具可使用本机地址；真机调试必须使用手机可访问的局域网地址，发布时必须换成微信后台允许的 HTTPS 域名。

## 老人端已实现的接口：SOS / 课程 / 视频 / 学习记录

全部位于 code1-elder/backend（2026-11 起分批实现，2026-11-14 完成持久化收尾）。默认进程内存存储；设置环境变量后改用本地开发 SQLite（仅 `CREATE TABLE IF NOT EXISTS`，无 seed，与社区端服务任务同模式）：SOS 单表 `sos_events`（`SOS_DATABASE_PATH`），课程三表 `courses` / `course_videos` / `learning_records`（`ELDER_DATABASE_PATH`）。预置演示课程始终由代码提供、不落库，读取时与库内动态课程合并（预置在前）。SQLite 错误统一 `503`：`sos_storage_unavailable` / `course_storage_unavailable`。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/sos-events` | 发起求助，`201`；`id`/`created_at` 服务端生成 |
| GET | `/api/v1/sos-events` | 事件列表，支持 `status` |
| PATCH | `/api/v1/sos-events/{event_id}` | 状态推进，体 `{to, note?}`；`pending → processing → resolved` |
| POST | `/api/v1/course-videos` | 上传 mp4（≤200MB）分块落盘 `data/uploads/videos/`（不入 git），返回 `{video_id, video_url}` |
| GET | `/api/v1/course-videos/{video_id}` | 视频流式播放（支持 Range 拖动进度条） |
| GET | `/api/v1/courses` | 课程目录 = 预置演示课程 + 动态课程 |
| GET | `/api/v1/courses/{course_id}` | 课程详情（含大纲） |
| POST | `/api/v1/courses` | 创建课程，可带 `video_id` 关联已上传视频 |
| GET | `/api/v1/learning-records` | 学习记录列表 |
| PUT | `/api/v1/learning-records/{course_id}` | upsert 进度，体 `{progress_percent}`（0–100 整数） |

错误信封：`{"error":{"code","message","fields"?}}`

| 场景 | HTTP | code |
|---|---:|---|
| 资源不存在 | 404 | `course_not_found` / `sos_event_not_found` / `video_not_found` |
| SOS 非法状态推进 | 409 | `invalid_state_transition` |
| 参数非法（空白 ID、进度越界、非 mp4、超 200MB 等） | 422 | `validation_failed` |
| SQLite 未配置路径不可用或读写失败 | 503 | `sos_storage_unavailable` / `course_storage_unavailable` |

状态机唯一真源在后端 Service；SOS 状态推进与学习记录 upsert 均以 `BEGIN IMMEDIATE` 条件更新执行，并发下只有一个请求成功。

## 监护人端与社区端的跨直连（不经过各自后端）

SOS 与课程能力的内容源都在 code1，消费端前端直连：

- **监护人端消息中心**：`data/sosEventsProvider.ts`（`VITE_SOS_DATA_MODE=api`）经 `api/sosEvents.ts` 调 code1 `GET /api/v1/sos-events`，把求助事件合并进消息列表；页面可见期间 30 秒轮询（`domain/sosAutoRefresh.ts`），发现新事件显示页内提示条（2026-11-14）。
- **社区端教学**：上传视频/建课/目录/学习进度直连 code1（`VITE_COURSE_DATA_MODE=api`），学习进度合并展示「学员进度」。
- **社区端救援**：直连 code1 SOS 事件列表（`VITE_SOS_DATA_MODE=api`）。

以上均使用 `VITE_ELDER_API_BASE_URL`（默认 `http://127.0.0.1:8001`）。

## 监护人端后端已实现的接口：健康总览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/health-overview/{elder_id}` | 健康总览；未接硬件，`HealthDataProvider` 如实返回 `503 {"error":{"code":"health_data_source_unavailable"}}`，前端六态映射为「未接入硬件」空态 |

## 社区端已实现的接口：社区服务任务

2026-11-01 实现，链路为页面 → 编排层 → API 模块 → FastAPI → Service → Repository → SQLite。存储为本地开发用 SQLite，单表 `service_tasks`，路径由 `COMMUNITY_DATABASE_PATH` 指定；无 seed、无预置数据。首次访问时若数据库文件的父目录不存在，会为已配置的这一个文件创建父目录；创建失败返回 `503`，不会越界创建其他目录。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/service-tasks` | 新建任务，返回 `201`；`id`/`status`/`note` 由服务端生成 |
| GET | `/api/v1/service-tasks` | 列表，支持 `status`、`limit`（1–100，默认 20）；空库返回 `200 []` |
| GET | `/api/v1/service-tasks/{task_id}` | 详情 |
| POST | `/api/v1/service-tasks/{task_id}/accept` | 接收：`pending → in_service` |
| POST | `/api/v1/service-tasks/{task_id}/complete` | 完成：`in_service → completed`，请求体 `{"note":"非空服务记录"}` |

任务字段：

```json
{
  "id": "8f1c…",
  "title": "代缴水电费",
  "elder_name": "示例老人 B",
  "category": "代办服务",
  "scheduled_at": "2026-11-01T14:30:00+08:00",
  "location": "XX 社区服务中心窗口",
  "description": "按老人委托到窗口代缴本月水电费",
  "status": "pending",
  "note": null
}
```

状态机（唯一真源在后端 Service）：

| 当前状态 | 命令 | 结果 |
|---|---|---|
| `pending` | accept | `in_service` |
| `pending` | complete | `409` |
| `in_service` | accept | `409` |
| `in_service` | complete + 非空 `note` | `completed` |
| `in_service` | complete + 空 `note` | `422` |
| `completed` | accept / complete | `409` |

状态推进在 Repository 中以条件更新执行（`UPDATE … WHERE id=? AND status=<期望旧状态>`，单个 `BEGIN IMMEDIATE` 事务）。两个请求同时接收或完成同一任务时，只有一个更新到一行并成功，另一个得到 `409`，不会出现“都读到旧状态、都写入成功”的丢失更新。

输入边界（后端独立校验，前端 mapper 使用同一组上限提前报错）：

| 字段 | 最小 | 最大 |
|---|---:|---:|
| `title` / `elder_name` / `category` | 1 | 100 |
| `location` | 1 | 200 |
| `description` / `note` | 1 | 2000 |

长度按去掉首尾空白后的字符数计算。`POST /service-tasks` 与 `POST /{task_id}/complete` 均拒绝未定义字段（如客户端提交 `status`、`id`），返回 `422`。

错误信封：`{"error":{"code","message","fields"?}}`

| 场景 | HTTP | code |
|---|---:|---|
| 任务不存在 | 404 | `task_not_found` |
| 非法状态转换 | 409 | `invalid_state_transition` |
| 参数 / `note` 非法 | 422 | `validation_failed`（含 `fields[]`） |
| 数据库未配置或不可用 | 503 | `service_unavailable` |
| 未知服务端异常 | 500 | `internal_error` |

`500` 与 `503` 不返回 SQL、文件路径、堆栈或连接信息。`/health` 不依赖数据库：即使 `COMMUNITY_DATABASE_PATH` 无效，`GET /health` 仍返回 `200`。

## 社区端已定义但未实现的接口（截至 2026-11-14 仍为 501）

救援、知识、课程三个领域仍是契约骨架，合法请求统一返回 `501`：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/rescue-incidents` | 紧急求助列表，支持 `status`、`limit` |
| GET | `/api/v1/rescue-incidents/{incident_id}` | 详情，含家庭协同与 4 步时间轴 |
| POST | `/api/v1/rescue-incidents/{incident_id}/transitions` | 推进一步，体 `{to, result?}` |
| GET | `/api/v1/knowledge-docs` | 知识资料列表，支持 `status`、`limit` |
| GET | `/api/v1/knowledge-docs/{doc_id}` | 知识资料详情 |
| PATCH | `/api/v1/knowledge-docs/{doc_id}` | 审核内容 / 启停，体 `{content?, status?}` |
| GET | `/api/v1/courses` | 课程列表，支持 `category`、`status`、`limit` |
| GET | `/api/v1/courses/{course_id}` | 课程详情 |
| PATCH | `/api/v1/courses/{course_id}` | 发布 / 下架，体 `{status}` |

约定：

- 传输值使用英文 code（`pending` / `en_route` / `arrived` / `completed`、`hardware_button` / `app_request` 等），中文文案由前端映射，改文案不影响契约。
- 时间字段一律 ISO 8601 且必须带时区；前端展示用的 `MM-DD HH:mm` 由前端格式化。
- 请求非法返回 `422`（未知枚举、空白 ID、`limit` 越界、进入终态未填 `result`）。
- `409`（不允许的状态推进）与 `404`（资源不存在）已写入 OpenAPI，本阶段不实现判定。
- 服务任务的通用 `POST /{task_id}/transitions` 已被 `accept` / `complete` 取代，见 `docs/superpowers/specs/2026-11-01-community-service-tasks-loop-design.md`。

字段定义与前端 `mock/` 的逐条映射见 `docs/superpowers/specs/2026-10-31-community-backend-contract-design.md`。

## 待实现契约

以下内容目前只有 `code4-shared` 中的 Python Protocol，没有 HTTP 路由、数据库实现或固定返回值：

- 数据访问。
- 社区知识检索。
- 老人记忆读写。
- 大模型生成。
- 设备数据接入。

业务接口需在后续需求和数据来源明确后另行设计。

