# 银龄伴框架架构

## 组件边界

三个产品均由独立前端和 FastAPI 后端组成；老人端使用 Vue 3 与 Capacitor Android 容器，监护人端和社区端将使用各自独立的 uni-app 微信小程序工程：

```text
老人端 Android App（Capacitor）──HTTP──> 老人端后端
监护人端微信小程序 ─HTTP──> 监护人端后端
社区端微信小程序 ──HTTP──> 社区端后端
                         │
                         └── code4-shared 公共契约
```

应用之间不直接导入代码，也不互相调用内部模块。公共依赖只能指向 `code4-shared`，共享模块不能反向依赖任何应用。

## 当前数据流

更新：2026-11-14。核心原则是**单一内容源**：SOS 事件、课程/视频、学习记录的唯一事实源在 code1 老人端后端；code2/code3 后端不实现这些域，服务之间互不调用，消费端前端直连 code1（`VITE_ELDER_API_BASE_URL`）。三端前端均默认 mock，由 Provider 工厂按环境变量切换 api 模式（`VITE_SOS_DATA_MODE` / `VITE_COURSE_DATA_MODE` / `VITE_HEALTH_DATA_MODE`），前端分层统一为 页面 → composables → data/provider 工厂 → mappers（DTO ↔ ViewModel）→ api（路径与 DTO 校验唯一出处）→ HTTP。

2026-10-25 老人端新增前端演示模式：`App.vue → pages/components → useElderApp → demo/data.ts`。关闭模式后清空模拟状态，不回退演示数据。Android 返回由 MainActivity 分发可取消事件给 Vue；根首页返回将应用置于后台。模式开关不是认证或发布安全隔离；虚构数据随演示 APK 打包，未来真实产品发布需单独评审是否排除演示模块。

已真实接通的链路（截至 2026-11-14）：

- **code1 后端四域**：SOS（POST/GET/PATCH + `POST /{event_id}/transitions` 微信兼容别名，状态机 `pending → processing → resolved`）、课程（目录/详情/创建）、视频（mp4 分块上传落盘、Range 流式播放）、学习记录（GET/PUT upsert）。持久化：`SOS_DATABASE_PATH`（单表）与 `ELDER_DATABASE_PATH`（三表）启用本地 SQLite（仅 `CREATE TABLE IF NOT EXISTS`、无 seed，与社区端服务任务同模式）；未设置时进程内存存储、重启即清。预置演示课程由代码提供、不落库，读取时与动态课程合并。
- **SOS 跨端闭环**：老人端发起求助（api 模式）→ code1 落库 → 监护人端消息中心合并展示 + 可见期 30 秒轮询与页内提示条（`domain/sosAutoRefresh.ts`，无实时推送前提下的兜底）。
- **课程跨端闭环**：社区端上传视频/建课（直连 code1）→ 老人端目录与视频播放 → 播放进度节流写回（每 ≥10% 且 ≥4s、播完写 100）→ 社区端教学页读取展示「学员进度」。
- **社区服务任务**：code3 后端 SQLite（`COMMUNITY_DATABASE_PATH`）前后端闭环，accept/complete 条件更新并发安全。
- **监护人健康**：code2 后端 `/api/v1/health-overview/{elder_id}` + 前端六态状态化；未接硬件，Provider 恒 503（`health_data_source_unavailable`），前端映射「未接入硬件」空态。

code2/code3 后端其余域均为契约骨架：code3 的救援/知识/课程 9 个操作返回结构化 501（社区端前端的救援与教学已绕开它们直连 code1）；code2 后端仅健康总览一个业务端点。三个 FastAPI 后端仍完全独立，互不导入内部代码。

老人端内部现按页面、领域类型和组合函数分层：公共组件依赖 `types` 中的稳定类型，不依赖 `demo/data.ts`；`useElderApp` 只作为导航、演示、聊天、求助和健康检查模块的组装边界。Android 普通构建与设备签名/覆盖安装验收相互独立。

## 监护人端前端分层

`code2-guardian/frontend` 的四页 UI（index 首页 / advice AI 建议 / messages 消息中心 / profile 我的）自 2026-11 起逐步从纯 mock 原型演进为 Provider 驱动，目录组织如下：

```text
pages/          四个 tab 页 + 二级页（advice-detail / message-detail 等），互不引用
components/     TabBar：四页共用的底部导航（custom-tab-bar）
composables/    useHealthData：健康六态编排（loading / 错误映射）
data/           healthDataProvider（Mock + Api 工厂，VITE_HEALTH_DATA_MODE）、sosEventsProvider（VITE_SOS_DATA_MODE）
domain/         纯函数：messages.ts 筛选、healthDataState.ts 六态派生、sosAutoRefresh.ts 轮询、routes / secondaryNavigation / tabBarSync
mappers/        sosEventMapper：SOS DTO → 消息条目
api/            client.ts（本端基址）+ sosEvents.ts（跨直连 code1，VITE_ELDER_API_BASE_URL）
mock/           data.ts：虚构演示数据唯一来源（无真实数据的页面仍读取）
types/          领域类型
```

依赖方向单向：`pages → components / composables / data / domain / mock / types`。健康模块走 Provider 工厂（默认 mock 演示六态，api 模式连 code2 后端，后端未接硬件恒 503 → 前端「未接入硬件」空态）；消息中心在 mock 模式下与原演示行为完全一致（Provider 返回空列表），api 模式下把 code1 的求助事件合并进列表并 30 秒轮询。无真实数据支撑的 AI 建议、我的页仍为静态演示并带「演示数据」标识。

`code2-guardian/backend` 有无状态的 `GET /health` 与 `/api/v1/health-overview/{elder_id}`（`UnavailableHealthDataProvider` 如实返回 503），不访问数据库。

## 社区端前端分层

`code3-community/frontend` 自 2026-10-31 起按六层组织，五个页面之间互不引用：

```text
pages/*         业务页面，只做状态编排与渲染
components/     跨页面展示组件：ScreenIdentity / PageHeader / SubPageHeader / BottomSheet / AppToast
composables/    与视图生命周期绑定的组合函数：useToast
domain/         纯函数与规则：救援 4 态机、服务分组与推进、知识启停、课程上下架
mock/           内存态工厂函数，接后端时整体替换为 api/ 调用
types/          领域类型
```

依赖方向单向：`pages → components / composables / domain / mock / types`，反向依赖一律禁止；页面之间也不互相 import。`domain/` 不引用任何 Vue API，可直接由 vitest 覆盖，因此运行状态的推进规则（`nextStatus`、`nextServiceStatus`、`knowledgeAfterToggle`、`courseAfterAction`）都有单元测试。

社区端已接入后端的页面（更新至 2026-11-14）：

- **服务任务**（2026-11-01）：页面 → `composables/useServiceTasks` → `api/serviceTasks` + `mappers/serviceTaskMapper` + `domain/serviceFlow` → HTTP → FastAPI `api/service_tasks` → `services/service_tasks` → `ServiceTaskRepository` Protocol → `SqliteServiceTaskRepository`。
- **教学课程**（2026-11）：页面 → `composables/useCoursePublish` → `api/elderCourses` + `mappers/courseMapper` → **跨直连 code1**（上传视频/建课/目录/学习进度，`VITE_COURSE_DATA_MODE=api`，`VITE_ELDER_API_BASE_URL`）；目录并行拉取学习记录合并展示「学员进度」，记录拉取失败不阻塞目录。
- **救援上报**（2026-11）：经 `data/sosProvider` + `api/sosEvents` 跨直连 code1 SOS 事件（`VITE_SOS_DATA_MODE=api`）。

其余页面（内容、知识）仍来自 `mock/community.ts` 的工厂函数；mock 与真实数据互不共享，请求失败也不会回退到 mock。

服务任务链路的前端分层补充：

```text
pages/service     只做加载/空/错误三态渲染与用户输入；刷新失败走列表外的固定提示通道
composables/      加载、操作互斥、成功后刷新、失败不改本地列表；依赖注入 ServiceTasksApi
api/serviceTasks  唯一出现路径与方法的地方；api/errors 把失败归一为 10 类
mappers/          DTO ↔ ViewModel 显式映射，ISO 8601 → 固定 +08:00 的 MM-DD HH:mm；文本上限与后端一致
domain/           纯函数：状态 → 文案、按钮可用性、分组
types/serviceTask DTO 与 ViewModel 两套类型不混用
```

刷新语义：列表已有真实数据时，加载失败不再把 `state` 改为 `error`，而是保持 `ready`、保留旧列表，并只在固定提示通道写入「刷新失败」；只有首次加载（没有任何数据可保留）才渲染整页错误与重试入口。

## 社区端后端分层

`code3-community/backend` 自 2026-10-31 起与老人端后端同构，但业务能力仍只有契约：

```text
api/                 路由与请求/响应绑定；服务任务走 Service，其余领域仍抛「能力未接入」
schemas/             Pydantic 模型：枚举、必填约束、时间必须带时区、创建体禁止服务端字段
service_errors.py    纯业务异常（无 FastAPI 依赖）：404 / 409 / 503
errors.py            异常 → 统一错误信封的处理器（含 500 兜底）
dependencies/        capability_not_implemented() 调用点 + 服务任务组合根（读环境变量注入仓储）
services/            能力 Protocol；service_tasks.py 是状态机唯一真源
repositories/        持久化 Protocol；sqlite_service_tasks.py 只做读写与行映射
```

依赖方向单向：`api → services / schemas / dependencies / errors`；Service 只依赖 Repository Protocol，不导入 FastAPI、`sqlite3` 或具体实现；Repository 不含状态机判断。`/health` 不引用任何业务模块，数据库未配置或损坏都不影响它。

状态推进的并发一致性：Service 决定允许哪些转换并给出「期望旧状态」，Repository 以单个 `BEGIN IMMEDIATE` 事务执行条件更新 `UPDATE … WHERE id=? AND status=<期望旧状态>`；更新行数为 0 表示状态已被别的请求改过，Service 重新读取当前任务后抛 `409`。判定落在一次原子写入上，不用「先查后写」。

服务任务的存储是本地开发用 SQLite，单表 `service_tasks`，路径由 `COMMUNITY_DATABASE_PATH` 指定，建表只用 `CREATE TABLE IF NOT EXISTS`，不写 seed。组合根在首次使用前为已配置的这一个数据库文件创建父目录（`parent.mkdir`），任何 `OSError` 都转换为 `503`；Repository 不隐式创建任意路径。数据库文件被 `.gitignore` 的 `*.db` 规则排除。

其余 3 个域（救援、知识、课程）共 9 个操作仍全部返回 `501`；非法输入在进入能力边界前由 `422` 拦截。传输值使用英文枚举（`pending` / `in_service` / `completed`），中文文案归前端映射，避免改文案破坏契约。

## 公共模块

`code4-shared` 当前包含：

- 健康响应契约。
- 数据访问层 Protocol（待实现）。
- 社区知识检索 Protocol（待实现）。
- 老人记忆读写 Protocol（待实现）。
- 大模型服务 Protocol（待实现）。
- 设备接入 Protocol（待实现）。
- 公共数据模型预留包；当前没有业务模型。

这些接口没有实现类，不会返回固定业务结果，也不会访问数据库、网络模型或设备。

## 后续数据架构

数据库选型、表结构、数据来源、数据清洗和导入均不属于本阶段。在用户确认数据来源和设计后，后续实现应通过 `DataAccess` 边界接入，不改变已有健康接口。

## 配置与安全

运行配置由环境变量或项目根目录的 `.env` 文件提供（后端通过 `python-dotenv` 加载）。`.env.example` 只包含本地安全配置；真实 `.env` 和密钥不进入版本控制。缺少任何未来 AI 凭据都不得影响后端启动或健康检查。

源码与工具环境分离：仓库不包含 Python 虚拟环境、Android SDK、Gradle 分发包、模拟器或工具缓存。老人端 Android 构建从外部环境变量和被忽略的 `android/local.properties` 获取 SDK 位置，生成物保留在被忽略的构建目录中。监护人端和社区端的微信开发者工具只打开 uni-app 生成的 `dist/.../mp-weixin`，不承载源码。

