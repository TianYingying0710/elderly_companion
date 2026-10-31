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

当前唯一成功提供能力的后端接口是无状态的 `GET /health`。它只返回服务标识和运行状态，不读取或写入数据。三个前端的 `src/api/client.ts` 提供统一 HTTP 封装，并从 `VITE_API_BASE_URL` 读取对应后端地址。老人端 Android 真机使用电脑的局域网地址，通过独立的 Capacitor 配置与原生工程封装，不影响另外两端。

老人端后端已建立课程与学习记录的 `/api/v1` 契约骨架。路由、Pydantic schema、service Protocol 和 repository Protocol 相互分离，但没有 repository 实现；合法业务请求明确返回结构化 501。监护人端和社区端本轮没有新增业务路由，三个 FastAPI 后端仍完全独立。

老人端内部现按页面、领域类型和组合函数分层：公共组件依赖 `types` 中的稳定类型，不依赖 `demo/data.ts`；`useElderApp` 只作为导航、演示、聊天、求助和健康检查模块的组装边界。Android 普通构建与设备签名/覆盖安装验收相互独立。

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

社区端当前不调用后端：`code3-community` 后端只有 `GET /health`，页面数据全部来自 `mock/community.ts` 的工厂函数。`docs/progress.md` 记录了这次解除「不做社区端业务页面」限制的边界——解除的只是 UI 与交互，数据库、真实数据、认证仍不涉及。

## 社区端后端分层

`code3-community/backend` 自 2026-10-31 起与老人端后端同构，但业务能力仍只有契约：

```text
api/            路由与请求/响应绑定，每个端点当前只抛「能力未接入」
schemas/        Pydantic 模型：枚举、必填约束、时间必须带时区
errors.py       CapabilityNotImplementedError → 501 + 共享错误体
dependencies/   capability_not_implemented() 调用点
services/       业务能力 Protocol，无实现
repositories/   持久化 Protocol，无实现
```

依赖方向单向：`api → schemas / dependencies / errors`；`services` 与 `repositories` 只作为类型边界被引用。路由层不导入任何数据库驱动，`/health` 不依赖业务模块，因此业务能力缺失不影响启动与健康检查。

4 个域共 10 条路径 / 12 个操作全部返回 `501`；非法输入在进入能力边界前由 `422` 拦截。传输值使用英文枚举（`pending` / `en_route` / `arrived` / `completed`），中文文案归前端映射，避免改文案破坏契约。

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

运行配置由环境变量提供。`.env.example` 只包含本地安全配置；真实 `.env` 和密钥不进入版本控制。缺少任何未来 AI 凭据都不得影响后端启动或健康检查。

源码与工具环境分离：仓库不包含 Python 虚拟环境、Android SDK、Gradle 分发包、模拟器或工具缓存。老人端 Android 构建从外部环境变量和被忽略的 `android/local.properties` 获取 SDK 位置，生成物保留在被忽略的构建目录中。监护人端和社区端的微信开发者工具只打开 uni-app 生成的 `dist/.../mp-weixin`，不承载源码。

