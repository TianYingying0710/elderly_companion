# 银龄伴框架接口说明

## 已实现接口

模拟数据只存在于老人端前端，不作为 API 返回。2026-10-26 老人端后端新增课程与学习记录契约骨架；这些业务能力尚未接入，前端演示模式不会调用它们。

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

基础地址来自 `VITE_API_BASE_URL`。非 2xx 响应会抛出带状态码的错误。小程序开发者工具可使用本机地址；真机调试必须使用手机可访问的局域网地址，发布时必须换成微信后台允许的 HTTPS 域名。当前只有 `/health` 是成功提供能力的接口。

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

## 社区端已定义但未实现的接口

2026-10-31 建立，共 10 条路径 / 12 个操作，合法请求统一返回 `501`：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/rescue-incidents` | 紧急求助列表，支持 `status`、`limit` |
| GET | `/api/v1/rescue-incidents/{incident_id}` | 详情，含家庭协同与 4 步时间轴 |
| POST | `/api/v1/rescue-incidents/{incident_id}/transitions` | 推进一步，体 `{to, result?}` |
| GET | `/api/v1/service-tasks` | 服务任务列表，支持 `status`、`limit` |
| GET | `/api/v1/service-tasks/{task_id}` | 服务任务详情 |
| POST | `/api/v1/service-tasks/{task_id}/transitions` | 推进一步，体 `{to, note?}` |
| GET | `/api/v1/knowledge-docs` | 知识资料列表，支持 `status`、`limit` |
| GET | `/api/v1/knowledge-docs/{doc_id}` | 知识资料详情 |
| PATCH | `/api/v1/knowledge-docs/{doc_id}` | 审核内容 / 启停，体 `{content?, status?}` |
| GET | `/api/v1/courses` | 课程列表，支持 `category`、`status`、`limit` |
| GET | `/api/v1/courses/{course_id}` | 课程详情 |
| PATCH | `/api/v1/courses/{course_id}` | 发布 / 下架，体 `{status}` |

约定：

- 传输值使用英文 code（`pending` / `en_route` / `arrived` / `completed`、`hardware_button` / `app_request` 等），中文文案由前端映射，改文案不影响契约。
- 时间字段一律 ISO 8601 且必须带时区；前端展示用的 `MM-DD HH:mm` 由前端格式化。
- 请求非法返回 `422`（未知枚举、空白 ID、`limit` 越界、进入终态未填 `result` / `note`）。
- `409`（不允许的状态推进）与 `404`（资源不存在）已写入 OpenAPI，本阶段不实现判定。

字段定义与前端 `mock/` 的逐条映射见 `docs/superpowers/specs/2026-10-31-community-backend-contract-design.md`。

## 待实现契约

以下内容目前只有 `code4-shared` 中的 Python Protocol，没有 HTTP 路由、数据库实现或固定返回值：

- 数据访问。
- 社区知识检索。
- 老人记忆读写。
- 大模型生成。
- 设备数据接入。

业务接口需在后续需求和数据来源明确后另行设计。

