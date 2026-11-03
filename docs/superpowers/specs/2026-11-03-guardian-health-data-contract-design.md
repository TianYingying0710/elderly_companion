# 监护人端健康数据契约设计

日期：2026-11-03

## 意图

为监护人端建立第一条健康数据契约边界：页面能够识别“健康数据源已接入”和“数据源尚未接入”两种状态，同时不把当前 mock 演示数据伪装成硬件或后端真实数据。本阶段不宣称真实健康业务闭环完成。

## 当前事实

- `code2-guardian/frontend` 的页面仍直接读取 `mock/data.ts`。
- 前端已有 `api/client.ts`，但业务页面尚未调用它。
- `code2-guardian/backend` 当前只有不依赖业务数据的 `GET /health`。
- 当前没有获批的硬件 SDK、数据库、认证或外部健康数据源。

## 目标

- 定义稳定的健康概况 DTO、领域模型和 ViewModel 边界。
- 定义健康数据源不可用时的结构化错误契约。
- 让前端可以在不改页面路由的情况下，从 mock 切换到 API/硬件适配器。
- 保留当前演示页面，明确标识演示数据。

## 非目标

- 不接入蓝牙、设备 SDK、真实硬件或外部服务。
- 不创建数据库、表、迁移、seed 或真实个人数据。
- 不实现认证、授权、绑定关系或通知流程。
- 不返回固定健康数值作为“成功”响应。
- 不把 503/数据源未接入转换成空数组或正常健康结果。

## 推荐边界

```text
页面
  → guardian health ViewModel
  → mapper
  → api client
  → Guardian FastAPI
  → service
  → HealthDataProvider Protocol
  → 未接入数据源（503）/未来硬件适配器
```

### 健康概况字段

第一阶段只定义契约，不承诺真实值。字段与现有前端展示模型对齐：

- `elder_id: string`：路径参数，去除首尾空白后长度为 1–64，只允许字母、数字、`_`、`-`。
- `metrics: HealthMetricDto[]`：数据源可用时才出现真实值；不可用响应不返回成功 DTO。
- `updated_at: string | null`：仅接受带时区的 ISO 8601 时间；没有数据源时为 `null`，不得由前端拼接。
- `source_status: "unavailable" | "available"`：契约枚举；当前默认 Provider 永远走错误响应，不返回 `available`。

`HealthMetricDto` 字段固定为：

- `key: "heart_rate" | "blood_pressure" | "sleep"`
- `label: string`
- `value: string`
- `unit: string`
- `badge: string | null`

后端使用 snake_case；前端 Mapper 将 `heart_rate` 转换为现有前端模型的 `heartRate`。后端不能在数据源不可用时填充演示值。

### 不可用响应

当没有获批数据源时，业务接口返回结构化 `503`：

```json
{
  "error": {
    "code": "health_data_source_unavailable",
    "message": "健康数据源尚未接入",
    "fields": []
  }
}
```

`/health` 仍只表示进程健康，不代表健康业务数据可用。

## 前端表现

- 现有 mock 演示页继续显示“演示数据”。
- API 接入层必须保留 HTTP 状态码、`error.code`、`error.message` 与 `error.fields`，不得把 503 转换为成功空状态。
- 页面后续可根据 `source_status` 展示“设备未接入/暂无真实数据”，但本阶段不新增硬件控制入口。

## 约束

- 监护人后端只能依赖自己的内部模块，不导入老人端或社区端内部代码。
- Repository/Provider 通过 Protocol 注入，Service 不导入 FastAPI、具体设备 SDK 或数据库实现。
- 当前后端仅新增契约边界和不可用 Provider；没有获批数据源时，不新增 `available` 成功实现。
- 新功能先写失败测试；不安装任何依赖。
- 所有演示数据和真实数据必须在类型和 mapper 边界上可区分。
