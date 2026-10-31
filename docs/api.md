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

## 待实现契约

以下内容目前只有 `code4-shared` 中的 Python Protocol，没有 HTTP 路由、数据库实现或固定返回值：

- 数据访问。
- 社区知识检索。
- 老人记忆读写。
- 大模型生成。
- 设备数据接入。

业务接口需在后续需求和数据来源明确后另行设计。

