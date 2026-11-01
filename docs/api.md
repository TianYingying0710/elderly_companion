# 银龄伴框架接口说明

## 已实现接口

模拟数据只存在于老人端前端，不作为 API 返回。2026-10-26 老人端后端新增课程与学习记录契约骨架；这些业务能力尚未接入，前端演示模式不会调用它们。

2026-11-01 社区端「社区服务任务」成为第一条真实业务链路：数据存于本地开发用 SQLite（单表 `service_tasks`），内容只能由用户在小程序页面主动录入，无 seed、无预置演示数据。

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

基础地址来自 `VITE_API_BASE_URL`。非 2xx 响应会抛出带状态码的错误。小程序开发者工具可使用本机地址；真机调试必须使用手机可访问的局域网地址，发布时必须换成微信后台允许的 HTTPS 域名。成功提供业务能力的接口目前只有 `GET /health` 与社区端 5 个社区服务任务端点。

## 老人端已定义但未实现的接口

```text
GET /api/v1/courses
GET /api/v1/courses/{course_id}
GET /api/v1/learning-records
PUT /api/v1/learning-records/{course_id}
```

合法请求统一返回 `501 Not Implemented`：

```json
{"error":{"code":"capability_not_implemented","message":"该业务能力尚未接入"}}
```

非法或空白课程 ID，以及非整数或超出 0–100 的学习进度返回 422。501 响应不包含课程、学习记录或固定业务数据。

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

## 社区端已定义但未实现的接口

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

