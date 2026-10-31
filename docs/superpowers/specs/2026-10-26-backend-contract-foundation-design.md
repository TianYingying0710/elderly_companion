# 银龄伴后端接口骨架设计

日期：2026-10-26

## 1. 意图

在没有数据库、真实业务数据和外部服务的阶段，先建立三端正式业务接口的契约与分层骨架，使前端、后端和未来数据实现可以围绕稳定边界并行演进，同时绝不使用固定返回值或虚构数据冒充真实业务能力。

本阶段完成的是“可验证的接口骨架”，不是业务后端完成版。

## 2. 已选择方案

采用方案 A：正式接口骨架。

- 保留三个独立 FastAPI 后端。
- `GET /health` 继续作为唯一成功返回的运行状态接口。
- 规划中的业务端点存在时统一返回结构化 `501 Not Implemented`。
- 只定义请求、响应、错误和状态契约，不创建数据库实现。
- 老人端前端演示数据继续保留在前端，不通过后端返回。

未选择方案 B，因为当前授权不包含后端模拟业务数据；未选择方案 C，因为数据库、数据来源和身份体系尚未确定。

## 3. 目标

- 建立 `/api/v1` 版本边界。
- 建立统一错误响应契约。
- 本轮定义课程、学习记录和统一错误响应的稳定数据结构。
- 先为老人端后端建立 `api`、`schemas`、`services`、`repositories` 和 `dependencies` 分层边界；另外两端本轮只保留职责说明，后续沿用同一原则。
- 用统一方式表达“契约已定义，但能力尚未接入”。
- 保证 `/health` 不依赖任何业务服务、数据库或外部配置。
- 让 OpenAPI 清楚区分已实现健康接口与未实现业务接口。
- 通过契约测试防止三端状态枚举和错误格式漂移。

## 4. 非目标

- 不创建数据库、表、schema、迁移、初始化或 seed。
- 不返回模拟课程、模拟家人、模拟消息或模拟求助成功。
- 不实现登录、身份认证、授权判断或真实家人绑定。
- 不实现 AI、语音、通知、电话、定位、设备接入或求助送达。
- 不实现学习记录持久化。
- 不实现后端之间的直接调用、事件总线或共享数据库。
- 不生成 TypeScript 客户端、不新增代码生成依赖。
- 不改变三端现有技术栈、端口和目录名称。

## 5. 三端职责边界

### 老人端后端

面向老人 App 的读取和操作入口：

- 课程列表与详情读取。
- 老人自己的学习记录读取与更新。
- 老人可见的家人共享状态读取。
- 消息读取。
- 设备状态读取。
- 求助发起、取消和进度读取。
- 社区服务事项读取。

本阶段以上接口均为未实现状态。

### 监护人端后端

- 家人关系与共享权限管理。
- 被授权的学习、设备和求助信息读取。
- 求助确认与关注状态。

### 社区端后端

- 课程与社区服务内容管理。
- 获授权求助的受理和进度更新。
- 社区通知管理。

职责描述不代表本阶段实现对应业务端点；本阶段只落地老人端课程、学习记录和统一错误契约。其他跨端状态在对应流程确认后另行冻结。

## 6. 解耦规则

- 三个应用不能导入彼此的内部源码。
- 每个前端只调用自己的后端。
- 三个后端不共享运行时服务实现。
- `code4-shared` 只保存稳定、业务中立的 Python 契约和枚举，不保存路由、数据库模型或服务实现。
- 未来跨端协作必须通过明确 HTTP 契约或另行批准的事件契约，不直接访问其他后端数据库。
- Pydantic API schema 与未来 ORM 模型分离；API 类型不能依赖尚未选定的数据库框架。

## 7. 统一错误契约

共享模块本轮新增：

```python
class ErrorDetail(TypedDict):
    code: str
    message: str

class ErrorPayload(TypedDict):
    error: ErrorDetail
```

未实现业务接口返回：

```http
HTTP/1.1 501 Not Implemented
Content-Type: application/json
```

```json
{
  "error": {
    "code": "capability_not_implemented",
    "message": "该业务能力尚未接入"
  }
}
```

错误响应不包含虚构业务对象，不声称请求已经处理。当前不加入请求 ID、链路追踪或内部错误细节。

## 8. 第一批老人端契约

统一前缀：`/api/v1`。

本轮唯一新增的业务路由是课程与学习记录。家人、消息、设备、求助和社区服务只保留职责边界，待对应流程、数据来源和跨端规则确认后另行设计。

### 课程

```text
GET /api/v1/courses
GET /api/v1/courses/{course_id}
```

`CourseSummary`：`id`、`title`、`category`、`description`、`duration_seconds`。

`id` 使用非空字符串；`duration_seconds` 使用非负整数。

`CourseDetail` 在摘要字段外增加 `outline`。课程媒体地址、播放鉴权和推荐算法不在本阶段契约中。

### 学习记录

```text
GET /api/v1/learning-records
PUT /api/v1/learning-records/{course_id}
```

`LearningRecord`：`course_id`、`progress_percent`、`updated_at`。

更新请求只包含 `progress_percent: int`，范围为 0–100。`updated_at` 使用带时区的 ISO 8601 `datetime`。接口本阶段返回 501，不在内存中保存进度。

### 后续候选 家人权限

```text
GET /api/v1/family-members
PUT /api/v1/family-members/{member_id}/permissions
```

权限契约使用稳定键：`device_summary`、`learning_records`、`help_records`、`community_services`。私人聊天内容没有共享权限键。

权限更新请求由以上四个布尔字段组成，不接受任意字符串权限键。

### 后续候选 消息

```text
GET /api/v1/messages
GET /api/v1/messages/{message_id}
```

只定义读取契约；已读状态、推送和通知渠道暂不定义。

### 后续候选 设备

```text
GET /api/v1/devices
GET /api/v1/devices/{device_id}
```

只描述非空字符串设备标识、类型、连接状态和可选电量；电量为 0–100 整数。不包含健康指标，不接入真实设备。

### 后续候选 求助

```text
POST /api/v1/help-requests
GET /api/v1/help-requests
GET /api/v1/help-requests/{request_id}
POST /api/v1/help-requests/{request_id}/cancel
```

共享状态枚举：`sending`、`delivered`、`responded`、`failed`、`cancelled`。本阶段所有操作返回 501，绝不生成求助编号或伪造送达状态。

发起求助请求不要求填写原因，本阶段请求体不包含业务字段。

### 后续候选 社区服务

```text
GET /api/v1/community-services
GET /api/v1/community-services/{service_id}
```

只定义标题、摘要、条件、材料、步骤、地点、联系方式和更新时间。没有真实来源前不返回任何事项。

## 9. 分层结构

老人端后端目标结构：

```text
src/silver_companion_elder/
├── main.py
├── errors.py
├── api/
│   ├── router.py
│   ├── courses.py
│   └── learning_records.py
├── schemas/
│   ├── courses.py
│   └── learning.py
├── services/
│   └── protocols.py
├── repositories/
│   └── protocols.py
└── dependencies/
    └── capabilities.py
```

路由层只处理 HTTP 输入输出。服务和仓储当前只定义 Protocol，不提供内存假实现。`dependencies/capabilities.py` 提供统一的“未接入能力”依赖或处理函数。

## 10. 前端边界

老人端当前演示模式继续读取 `src/demo/data.ts`。正式模式只通过 `src/api/client.ts` 调用后端。

本阶段不把演示页面切换到 501 业务接口，以免每次打开页面产生无意义失败请求。后续真实数据源就绪后，为每类数据增加明确 API 方法和加载、空状态、错误状态。

## 11. 验证策略

- 共享契约测试验证统一错误结构。
- 每条课程与学习记录路由测试状态码为 501、错误码为 `capability_not_implemented`，且响应中不存在业务数据字段。
- 请求体仍由 FastAPI/Pydantic校验；明显非法请求可在进入未实现能力前返回 422。
- `/health` 测试继续验证数据库和业务依赖完全缺失时仍返回 200。
- OpenAPI 测试验证本轮四条 `/api/v1` 路径存在并声明 501 响应。
- 文件扫描验证不存在数据库、迁移、seed、内存仓储或模拟业务数据。

## 12. 实施顺序

1. 冻结共享错误契约。
2. 建立老人端 Pydantic schema。
3. 建立统一 501 处理方式和 `/api/v1` 路由。
4. 建立服务与仓储 Protocol，不写实现类。
5. 增加契约、路由、OpenAPI和边界扫描测试。
6. 更新 API、架构、进度和验收文档。
7. 运行三端后端测试、共享契约测试和完整框架验证。

## 13. 验收标准

- `/health` 继续返回 200，且不依赖业务层。
- 本轮规划的课程与学习记录路径出现在 OpenAPI 中。
- 课程与学习记录的所有有效业务请求统一返回结构化 501。
- 非法路径参数或请求体按 FastAPI校验返回 422。
- 501 响应不包含固定课程、家人、消息、设备、服务或求助数据。
- 没有数据库文件、ORM模型、迁移、seed、内存仓储或业务数据文件。
- 三端无跨应用内部源码引用。
- 前端演示数据位置和行为保持不变。
- 所有现有测试及新增后端契约测试通过。

## 14. 后续决策点

真正实现业务前必须另行确认：身份体系、数据所有权、数据库选择、真实课程与社区服务来源、家人绑定规则、权限判定位置、求助送达渠道和审计要求。
