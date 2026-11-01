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

2026-10-25 老人端新增前端演示模式：`App.vue → pages/components → useElderApp → demo/data.ts`。关闭模式后清空模拟状态，不回退演示数据。Android 返回由 MainActivity 分发可取消事件给 Vue；根首页返回将应用置于后台。

模式开关不是认证或发布安全隔离；虚构数据随演示 APK 打包，未来真实产品发布需单独评审是否排除演示模块。

当前成功提供业务能力的后端接口有两类：无状态的 `GET /health`（三个后端）与社区端 `/api/v1/service-tasks` 下的 5 个社区服务任务端点。健康检查只返回服务标识和运行状态，不读取或写入数据。三个前端的 `src/api/client.ts` 提供统一 HTTP 封装，并从 `VITE_API_BASE_URL` 读取对应后端地址。老人端 Android 真机使用电脑的局域网地址，通过独立的 Capacitor 配置与原生工程封装，不影响另外两端。

老人端后端已建立课程与学习记录的 `/api/v1` 契约骨架。路由、Pydantic schema、service Protocol 和 repository Protocol 相互分离，但没有 repository 实现；合法业务请求明确返回结构化 501。监护人端后端仍只有 `GET /health`；社区端已在服务任务域接入真实持久化（见「社区端后端分层」）；三个 FastAPI 后端仍完全独立，互不导入内部代码。

老人端内部现按页面、领域类型和组合函数分层：公共组件依赖 `types` 中的稳定类型，不依赖 `demo/data.ts`；`useElderApp` 只作为导航、演示、聊天、求助和健康检查模块的组装边界。Android 普通构建与设备签名/覆盖安装验收相互独立。

## 监护人端前端分层

`code2-guardian/frontend` 自 2026-11-01 起是四页 UI 原型（`main` 的 `f5d073e` 基线），目录组织如下：

```text
pages/          四个页面，互不引用：index（老人画像/首页）、advice（AI 建议）、messages（消息中心）、profile（我的）
components/     TabBar：四页共用的底部导航
domain/         messages.ts：消息筛选等纯函数，由 vitest 覆盖
mock/           data.ts：全部虚构演示数据的唯一来源
types/          index.ts：领域类型
api/client.ts   uni.request 封装（基址取 VITE_API_BASE_URL，默认 127.0.0.1:8002），当前无页面调用
assets/         icons.ts 图标常量
```

依赖方向单向：`pages → components / domain / mock / types / assets`。页面直接读取 `mock/data.ts`，`messages` 页额外用 `domain/messages.ts` 做筛选；**没有** `mapper` / `composable` / `service` 层，也没有 DTO 与 ViewModel 的映射链路，因此四页展示的是静态虚构数据加本地纯函数筛选，不构成真实监护业务。`api/client.ts` 仅为后续接入准备的基础设施，没有任何页面 import 它。

`code2-guardian/backend` 只有无状态的 `GET /health`（`status` / `service`），不引用业务模块、不访问数据库。前端与后端之间当前没有任何业务请求。

接后端时需要新增的层次（本阶段未实现，仅作为边界说明）：`api/*` 按域收口路径、`mappers/` 做 DTO ↔ ViewModel、`composables/` 承担加载与错误态，并把页面对 `mock/` 的直接依赖替换为组合函数。

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

社区端唯有「社区服务任务」接入后端（2026-11-01）：页面 → `composables/useServiceTasks` → `api/serviceTasks` + `mappers/serviceTaskMapper` + `domain/serviceFlow` → HTTP → FastAPI `api/service_tasks` → `services/service_tasks` → `ServiceTaskRepository` Protocol → `SqliteServiceTaskRepository`。其余四个页面（救援、内容、知识、课程）仍全部来自 `mock/community.ts` 的工厂函数，两者状态互不共享，请求失败也不会回退到 mock。

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

