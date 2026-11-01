# 社区服务任务真实闭环设计

- 日期：2026-11-01
- 状态：待用户批准；不得据此直接实施
- 范围：仅 `code3-community` 的社区服务任务
- 目标：交付一条可持久化、可刷新恢复、可独立测试的真实前后端链路

## 1. 决策摘要

本阶段只完成以下纵向链路：

```text
社区端服务页面
→ 前端编排层
→ API 客户端与 DTO mapper
→ 社区端 FastAPI 路由
→ Service 业务层
→ Repository 接口
→ SQLite Repository
```

选择 SQLite 的理由：Python 标准库已包含 `sqlite3`，无需安装依赖；适合当前单机开发和第一条真实闭环。Repository 接口隔离具体存储，未来更换数据库时不改页面、HTTP 契约和 Service 规则。

不采用以下方案：

- 继续让业务端点返回 `501`：只能证明分层代码存在，不能形成真实闭环。
- 内存 Repository：刷新或重启后丢失，不满足持久化目标。
- 固定成功响应或预置 seed：会伪造业务能力，并违反当前项目规则。
- 同时开发救援、课程或监护人端：扩大耦合面，无法证明第一条链路稳定。

## 2. 实施前硬门槛

当前 `AGENTS.md` 禁止数据库、表、schema、迁移、初始化脚本和真实业务实现。因此 DS 在得到用户明确批准前，只能阅读本设计，不能修改产品代码。

批准实施时，必须先把 `AGENTS.md` 改为一条例外，且例外只能覆盖：

- `code3-community/backend` 的社区服务任务；
- 本地开发用 SQLite；
- 一张 `service_tasks` 表；
- 自动化测试数据只能存在于测试临时数据库；运行数据库只接受用户从页面主动录入且不含真实个人信息的本地开发任务，禁止 seed 和预置数据；
- 不因此解除认证、通知、求助、老人端、监护人端及其他社区领域的禁令。

如果用户不批准该例外，本设计停在“待批准”，不得实现所谓空闭环。

## 3. 目标与非目标

### 3.1 目标

- 页面从真实 API 加载社区服务任务。
- 支持手动新建任务、查看列表、查看详情、接收任务、填写记录并完成任务。
- 成功修改在页面刷新和后端重启后仍保留。
- 失败不污染前端状态，不出现虚假成功提示。
- 页面、传输、业务规则和存储彼此隔离，任何一层可单独测试。
- `/health` 不依赖数据库，数据库异常不得阻止健康检查。

### 3.2 非目标

- 不提供任务编辑、删除或批量操作；仅增加形成真实闭环所必需的手动新建。
- 不实现登录、身份认证、角色授权、通知和审计系统。
- 不接老人端或监护人端。
- 不修改救援、知识、课程领域。
- 不向运行数据库写入 seed 或预置演示任务；任务只能由用户在页面主动填写并提交。
- 不修改 `code4-shared`，除非实施中证明存在至少两个应用都需要的稳定中立契约；本阶段预期不需要。

## 4. 依赖方向与职责

```text
pages/service/index.vue
        ↓
composables/useServiceTasks.ts
        ↓                 ↘ domain/serviceFlow.ts
api/serviceTasks.ts → mappers/serviceTaskMapper.ts
        ↓ HTTP
backend/api/service_tasks.py
        ↓
backend/services/service_tasks.py
        ↓
ServiceTaskRepository Protocol
        ↓
SqliteServiceTaskRepository
```

禁止任何反向依赖。

| 层 | 负责 | 禁止 |
|---|---|---|
| 页面 | 渲染、输入、调用编排动作 | 拼 URL、解析错误、写状态转换、导入 mock |
| composable | loading/empty/error、操作互斥、刷新 | SQL、HTTP 细节、复制后端状态机 |
| API | HTTP 方法、路径、DTO | 页面文案、业务状态判断 |
| mapper | DTO 与 ViewModel 显式转换、时间展示 | 请求、全局状态、副作用 |
| domain | 按状态决定按钮文案和可用动作 | Vue、uni、HTTP、持久化、修改入参 |
| 后端 API | 参数绑定、响应模型、异常映射 | SQL、业务状态转换 |
| Service | 权威状态机、服务记录规则 | FastAPI、HTTP 状态码、SQL、中文页面文案 |
| Repository | 数据读写和行映射 | HTTP、页面文案、状态转换 |

Service 是业务规则唯一真源。前端 domain 只控制交互展示；后端拒绝操作时，前端重新获取服务端状态。

## 5. HTTP 契约

保留既有查询接口，将通用 `transitions` 替换为明确命令端点：

| 方法 | 路径 | 请求 | 成功响应 |
|---|---|---|---|
| POST | `/api/v1/service-tasks` | `ServiceTaskCreate` | `201 ServiceTask` |
| GET | `/api/v1/service-tasks` | `status?`、`limit=20` | `200 ServiceTask[]` |
| GET | `/api/v1/service-tasks/{task_id}` | 非空 ID | `200 ServiceTask` |
| POST | `/api/v1/service-tasks/{task_id}/accept` | 无请求体 | `200 ServiceTask` |
| POST | `/api/v1/service-tasks/{task_id}/complete` | `{ "note": "非空记录" }` | `200 ServiceTask` |

替换 `transitions` 是有意的契约变更，必须同步更新后端路由与 schema、相关测试、`docs/api.md`，并在 2026-10-31 社区后端契约文档中标明服务任务部分已被本设计取代。

`ServiceTaskCreate` 只包含 `title`、`elder_name`、`category`、`scheduled_at`、`location`、`description`。`id` 由后端使用 UUID 生成，`status` 固定为 `pending`，`note` 固定为 `null`；客户端不得提交或覆盖这三个字段。

不得为了对称补充编辑、删除或批量 CRUD。

## 6. 数据与状态模型

传输层继续使用稳定英文 code：

```text
pending → in_service → completed
```

| 当前状态 | 命令 | 结果 |
|---|---|---|
| pending | accept | in_service |
| pending | complete | 409 |
| in_service | accept | 409 |
| in_service | complete + 非空 note | completed |
| in_service | complete + 空 note | 422 |
| completed | accept/complete | 409 |

前后端字段边界：

| API DTO | 页面 ViewModel | 处理位置 |
|---|---|---|
| `elder_name` | `elderName` | mapper |
| `category` | `category` | mapper |
| `scheduled_at` | `scheduledText` | mapper 按 Asia/Shanghai 格式化 |
| `status` 英文 code | `status` 英文 code | 不翻译存储值 |
| `note` | `record` | mapper |

中文状态和按钮文字只存在于前端展示函数中。

## 7. 持久化设计

### 7.1 配置

- 新增社区后端环境变量 `COMMUNITY_DATABASE_PATH`。
- `.env.example` 只能给安全的本地占位路径，不提交真实 `.env`。
- 测试必须使用 pytest 临时目录中的独立数据库。
- 运行时数据库文件必须被 Git 忽略。

### 7.2 表

仅允许一张表：`service_tasks`。

| 列 | 约束 |
|---|---|
| `id` | TEXT PRIMARY KEY，非空 |
| `title` | TEXT NOT NULL |
| `elder_name` | TEXT NOT NULL |
| `category` | TEXT NOT NULL |
| `scheduled_at` | TEXT NOT NULL，ISO 8601 带时区 |
| `location` | TEXT NOT NULL |
| `description` | TEXT NOT NULL |
| `status` | TEXT NOT NULL，限定三种 code |
| `note` | TEXT NULL |
| `updated_at` | TEXT NOT NULL，ISO 8601 UTC |
| `created_at` | TEXT NOT NULL，ISO 8601 UTC |

数据库不得自动生成演示任务。空数据库返回 `200 []` 是真实空状态，不是伪造成功。运行数据只能来自用户在新建表单中的主动输入；表单不得预填姓名、地址、任务描述或其他业务内容，并应明确提示仅用于本地开发、不得录入真实个人信息。

### 7.3 初始化与事务

- 不建立通用迁移框架，不安装 ORM。
- 建表逻辑只负责 `CREATE TABLE IF NOT EXISTS`，不得插入数据。
- Repository 的每个写操作使用显式事务。
- Service 在保存前重新读取任务并校验状态；状态不符返回 409。
- 若未来出现并发写入需求，再单独设计版本号或条件更新；本阶段不得假装已经解决多用户并发。

## 8. 错误契约

统一响应：`{"error":{"code","message","fields"?}}`。

| 场景 | HTTP | code |
|---|---:|---|
| 未找到任务 | 404 | `task_not_found` |
| 非法状态转换 | 409 | `invalid_state_transition` |
| 参数或 note 非法 | 422 | `validation_failed` |
| 数据库不可用 | 503 | `service_unavailable` |
| 未知服务端异常 | 500 | `internal_error` |

- 500/503 不暴露路径、SQL、堆栈或连接信息。
- 前端不得把失败转换成空数组。
- 任何失败不得显示“已接收”或“已完成”。
- 409 后必须重新拉取任务详情。
- 501 只保留给仍未接入的其他业务领域；本链路实现后不得继续返回 501。

## 9. 前端真实模式与演示数据隔离

- `pages/service/index.vue` 不得直接导入 `mock/community.ts`。
- 本阶段社区服务页面默认使用真实 API。
- 现有 mock 可供其他尚未迁移的社区页面继续使用，但不得通过请求失败自动回退到 mock。
- 如果未来需要显式演示模式，应另行设计模式入口；不得在本任务中顺手增加。
- 页面必须包含 loading、真实空状态、错误状态、重试和操作中禁用状态。
- 空状态提供“新建服务任务”入口；新建成功后重新拉取列表，不直接向本地数组伪造插入。
- 新建表单字段必须与 `ServiceTaskCreate` 对应，不允许填写状态、服务记录或任务 ID。

## 10. 测试策略

必须先写失败测试，再写实现。不得安装依赖；只使用仓库已有工具与 Python 标准库。

### 10.1 后端

- Service 单元测试：使用手写 fake repository，覆盖全部合法/非法转换。
- SQLite Repository 集成测试：使用临时数据库，覆盖建表、空列表、读取、保存和重启后保留。
- API 测试：通过依赖注入使用临时 Repository，覆盖创建的 201，以及 200/404/409/422/503。
- 健康测试：数据库路径无效时 `/health` 仍返回 200。
- 其他社区领域的 501 契约必须保持不变。

### 10.2 前端

- domain：状态对应的动作与按钮，不复制后端持久化规则。
- mapper：字段映射、三种状态、带时区时间、非法 DTO。
- API：五个操作的路径、方法、请求体和错误解析。
- composable：加载、空、创建、重试、成功刷新、失败不污染状态、重复点击互斥。
- 新建表单：必填校验、带时区时间提交、成功后关闭并刷新、失败时保留用户输入。
- 页面边界：不导入 mock、不拼 URL、不判断 HTTP 状态码。

当前社区端官方前端测试因本机缺失 `@babel/core` 无法完整启动。用户已禁止安装任何内容，因此：

- DS 不得补装依赖；
- 可运行的纯 TypeScript 测试必须执行；
- 无法运行的页面测试必须保留并明确报告为“未验证”，不得声称通过；
- 不得用删除测试、降低断言或永久修改 Vite 配置绕过问题。

## 11. 实施顺序

DS 必须逐步执行，前一步验证失败时停止，不得并行铺开：

1. 获得用户明确授权后，先收窄修改 `AGENTS.md`，只增加本设计所述例外。
2. 固化后端 Service 测试和错误契约，不接数据库。
3. 实现纯 Service，使用 Repository Protocol。
4. 编写 SQLite Repository 集成测试，再实现 Repository 和无 seed 建表。
5. 接入 FastAPI 依赖注入与五个端点，其他领域保持 501。
6. 编写前端 DTO、ViewModel 和 mapper。
7. 编写前端 API 模块与错误归一化。
8. 编写 composable，再让页面移除 service mock 依赖。
9. 更新 API、架构、进度文档。
10. 执行可运行的相关测试，检查 Git diff 和禁用产物。

每一步只允许修改该步所需文件。禁止顺手格式化、重命名或重构其他领域。

## 12. DS 强制执行约束

- 不安装、升级或删除任何依赖。
- 不修改老人端、监护人端、救援、知识或课程业务代码。
- 不提交、不推送、不创建分支。
- 不创建 seed，不写入虚构运行数据。
- 不预填或自动生成业务内容；只有后端技术字段 `id`、`status`、`created_at`、`updated_at` 可由系统生成。
- 不把测试 fake 引入产品组合根。
- 不捕获异常后返回空列表或固定成功响应。
- 不让页面直接依赖后端 DTO。
- 不让 Service 导入 FastAPI、sqlite3 或具体 Repository。
- 不让 Repository 包含状态机判断。
- 不修改 `/health` 的无依赖语义。
- 发现设计与现有代码冲突时先报告，不自行扩大范围。

## 13. 验收标准

只有同时满足以下条件才可称为完成：

1. 空数据库时列表真实返回 `200 []`，页面显示可操作的空状态和新建入口。
2. 用户可从空库手动创建任务；创建接口返回 201，任务初始状态必须是 pending。
3. 新建任务可以被查询、接收和完成。
4. 完成后的任务在新建 Repository/重启应用后仍保持 completed 和服务记录。
5. 所有非法转换均返回 409，空服务记录返回 422。
6. 页面刷新后从 API 恢复真实状态，不读取 service mock。
7. 网络、数据库和业务失败均不产生成功提示或本地假状态。
8. `/health` 在数据库不可用时仍返回 200。
9. 其他社区业务端点继续保持原有 501 行为。
10. Git 中不存在数据库文件、`.env`、缓存、构建产物或测试临时文件。
11. DS 报告实际通过的测试、无法运行的测试及原因，不夸大结果。

## 14. 批准语句

实施前需要用户明确回复类似以下内容：

> 批准社区服务任务按本设计实施；仅对此领域解除数据库与真实业务实现禁令，允许使用 Python 标准库 SQLite、一张 `service_tasks` 表，以及由用户通过页面主动录入且不含真实个人信息的本地开发任务；仍禁止安装依赖、seed、预置业务数据、真实个人数据及跨领域开发。

没有这项批准，DS 必须停止在设计阶段。
