# 社区端后端契约设计（v0.1）

- 日期：2026-10-31
- 范围：`code3-community/backend`
- 状态：**仅契约骨架**。所有业务端点对合法请求返回 `501 Not Implemented`，不含任何业务数据、仓储实现或数据库。

## 一、目标与非目标

### 目标

1. 把社区端 5 个页面用到的数据结构固化为可评审的 HTTP 契约，供前端后续从 `mock/` 切到 `api/`。
2. 复用老人端后端已验证的分层（`api / schemas / errors / services / repositories`），保持三端后端结构一致。
3. 让「缺能力」与「请求非法」可区分：缺能力 `501`，请求非法 `422`。

### 非目标（本阶段明令不做）

- 数据库、表、迁移、初始化、seed（`AGENTS.md` 禁令）。
- 任何虚构业务数据作为接口成功响应（`AGENTS.md`：2026-10-25 授权仅限老人端 demo 模块）。
- 认证、授权、消息推送、文件真实上传与存储。
- 真实知识检索（RAG）、向量库、模型调用。
- 前端改造：本轮不动 `code3-community/frontend`。

## 二、资源域划分

按领域而非按页面切分，避免页面改版导致接口作废：

| 域 | 对应页面 | 说明 |
|---|---|---|
| `rescue-incidents` | `pages/rescue` | 紧急求助事件与 4 态处置 |
| `service-tasks` | `pages/service` | 社区服务任务与 3 态推进 |
| `knowledge-docs` | `pages/knowledge` | 知识资料审核与启停 |
| `courses` | `pages/teaching` | 助老课程发布与下架 |

`pages/content` 只是两个入口卡的导航页，**不需要接口**。

## 三、端点清单（10 条路径 / 12 个操作）

所有路径统一前缀 `/api/v1`。

### 3.1 救援事件

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/rescue-incidents` | 列表，支持 `status` 过滤与 `limit` 分页 |
| GET | `/rescue-incidents/{incident_id}` | 详情，含家庭协同与时间轴 |
| POST | `/rescue-incidents/{incident_id}/transitions` | 推进一步，请求体 `{to, result?}` |

### 3.2 服务任务

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/service-tasks` | 列表，支持 `status` 过滤 |
| GET | `/service-tasks/{task_id}` | 详情 |
| POST | `/service-tasks/{task_id}/transitions` | 推进一步，请求体 `{to, note?}` |

> **2026-11-01 已被取代**：服务任务域改为已实现，`transitions` 由 `POST /{task_id}/accept` 与 `POST /{task_id}/complete` 取代，并新增 `POST /service-tasks`（201，`id`/`status`/`note` 由服务端生成）。存储为本地开发用 SQLite 单表 `service_tasks`。以 `2026-11-01-community-service-tasks-loop-design.md` 与 `docs/api.md` 为准；其余 3 个域仍按本文档保持 501。

### 3.3 知识资料

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/knowledge-docs` | 列表 |
| GET | `/knowledge-docs/{doc_id}` | 详情 |
| PATCH | `/knowledge-docs/{doc_id}` | 审核内容 / 启停，请求体 `{content?, status?}` |

### 3.4 助老课程

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/courses` | 列表，支持 `category`、`status` 过滤 |
| GET | `/courses/{course_id}` | 详情 |
| PATCH | `/courses/{course_id}` | 发布 / 下架，请求体 `{status}` |

## 四、枚举与传输值

**决策：传输层使用稳定英文 code，中文文案由前端映射。** 理由：中文状态一旦改文案就破坏契约；mock 里的中文字符串只作展示层值。

### 4.1 救援状态

| code | 前端展示 | 允许的下一态 |
|---|---|---|
| `pending` | 待响应 | `en_route` |
| `en_route` | 已赶往现场 | `arrived` |
| `arrived` | 已到达 | `completed`，且必须带 `result` |
| `completed` | 已完成处理 | 无（终态） |

### 4.2 求助来源

| code | 前端展示 | 是否允许 `reason` |
|---|---|---|
| `hardware_button` | 硬件求助 · 实体 SOS 按钮 | **不允许**，`reason` 必须为空 |
| `app_request` | 软件求助 · 老人端一键求助 | 允许 |

### 4.3 服务状态

| code | 前端展示 | 允许的下一态 |
|---|---|---|
| `pending` | 待接收 | `in_service` |
| `in_service` | 服务中 | `completed` |
| `completed` | 已完成 | 无 |

### 4.4 知识文档状态

| code | 前端展示 |
|---|---|
| `pending_review` | 待确认 |
| `enabled` | 已启用 |
| `disabled` | 已停用 |

### 4.5 课程状态

| code | 前端展示 |
|---|---|
| `published` | 已发布 |
| `draft` | 草稿 |
| `offline` | 已下架 |

## 五、字段定义

### 5.1 救援事件

```text
RescueIncidentSummary
  id              str       事件编号，同时作为列表 key
  elder_name      str       老人姓名
  source          enum      hardware_button / app_request
  reason          str       空串表示未携带原因
  location        str
  status          enum
  reported_at     datetime  ISO 8601 带时区

RescueIncidentDetail = Summary 基础上追加
  guardian        GuardianProgress
  steps           list[RescueStep]   按流程顺序，4 项
  result          str | null         仅 completed 后存在

GuardianProgress
  name            str
  stage           int       0 已通知 / 1 已查看 / 2 已联系老人
  times           list[datetime]
  feedback        str
  other_count     int

RescueStep
  status          enum
  name            str       步骤名（展示用，来自前端 RESCUE_STEPS）
  happened_at     datetime | null
```

### 5.2 服务任务

```text
ServiceTask
  id              str
  title           str
  elder_name      str
  category        str       数字助老 / 代办服务 / 社区事务
  scheduled_at    datetime
  location        str
  description     str
  status          enum
  note            str | null   服务记录，推进到 completed 时写入
```

### 5.3 知识文档

```text
KnowledgeDoc
  id              str
  name            str       文件名，形如 社区办事指南.docx
  content         str
  status          enum
  updated_at      datetime
```

### 5.4 课程

```text
Course
  id              str
  title           str
  category        str
  format          str       图文教程 / 视频教程
  duration_label  str       形如 约 3 分钟
  note            str
  status          enum
  updated_at      datetime
```

## 六、时间与时区

- 传输层一律 ISO 8601 且**必须带时区**（Pydantic `AwareDatetime`）。
- 前端展示格式 `MM-DD HH:mm` 由前端格式化，不经后端。
- 理由：mock 里 `stepTimes` 是 `MM-DD HH:mm` 字符串数组，按下标与状态耦合；直接搬进接口会丢失年份与时区，跨年排序与补录都会错。

## 七、行为约定（实现阶段才生效）

| 场景 | 状态码 | 说明 |
|---|---|---|
| 契约已定、能力未接 | `501` | 响应体固定为共享包的 `capability_not_implemented` |
| 请求体/路径参数非法 | `422` | 枚举非法、ID 空白、`result` 缺失等 |
| 非法状态跳转 | `409` | 例：`pending` 直接跳到 `arrived`；实现阶段生效 |
| 资源不存在 | `404` | 实现阶段生效 |

本阶段只有 `501` 与 `422` 两条会真实触发；`409` / `404` 只写入契约与 OpenAPI 文档，不实现判定。

## 八、前端 mock 到契约的映射

| 前端现状（`src/types/community.ts`） | 契约字段 | 差异处理 |
|---|---|---|
| `status: '待响应'` | `status: 'pending'` | 前端加枚举映射表 |
| `time` / `stepTimes`（`MM-DD HH:mm`） | `reported_at` / `steps[].happened_at`（ISO 8601） | 前端格式化 |
| `stepTimes: string[]`（下标隐含状态） | `steps: list[RescueStep]` | 状态显式化，不再靠下标 |
| `source: '硬件求助 · 实体 SOS 按钮'` | `source: 'hardware_button'` | 前端映射文案 |
| `name`（老人姓名） | `elder_name` | 重命名，避免与监护人 `name` 混淆 |
| `GuardianProgress.times: string[]` | `times: list[datetime]` | 同上 |
| `ServiceTask.note` | 新增字段 | 修复「弹层填写的服务记录无处落地」 |
| `Course.duration: '约 3 分钟'` | `duration_label` | 明确是展示文案，不是数值 |

## 九、分层与依赖方向

```text
api/            路由与请求/响应模型绑定，只调用能力边界
schemas/        Pydantic 模型，无业务逻辑
errors.py       能力未实现异常 + 501 处理器
dependencies/   capability_not_implemented 调用点
services/       业务能力 Protocol（无实现）
repositories/   持久化 Protocol（无实现）
```

依赖方向单向：`api → schemas / dependencies / errors`。`services` 与 `repositories` 只被 `api` 引用为类型，不含实现；接真实实现时新增 `services/impl` 与 `repositories/impl`，不改动 `api` 的签名。

## 十、验收标准

1. `pytest` 全绿，且新增测试覆盖：17 个操作的 501、非法输入 422、OpenAPI 业务路径集合、`/health` 不受影响。
2. `create_app().openapi()` 中所有 `/api/v1` 操作都声明了 `501` 响应。
3. `GET /health` 仍不依赖任何业务模块、数据库或网络。
4. 未新增数据库、表、迁移、seed 或任何业务数据文件。

## 十一、后续阶段（需另行确认）

1. **内存仓储实现**：真实推进与校验（409/404），数据仅存进程内存。需要用户确认是否属于 `AGENTS.md` 允许范围——**当前禁止**把虚构数据作为接口成功响应。
2. **持久化**：需先解除「不建库」禁令并确定数据来源。
3. **前端联调**：救援域先接 `api/`，替换 `mock/`。
