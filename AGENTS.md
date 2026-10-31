# AGENTS.md

## 项目边界

- `code1-elder`、`code2-guardian`、`code3-community` 是三个独立应用；禁止跨应用导入内部代码。
- `code4-shared` 只保存稳定、业务中立的公共契约和接口预留，不依赖三个应用。
- 前端只调用对应后端，不直接访问数据库、云数据库、模型服务或设备。
- 后端健康检查不得依赖数据库、API Key、网络模型或业务数据。

## 当前阶段禁令

- 不创建数据库文件、表、schema、迁移、初始化或 seed 脚本。
- 不生成、下载、爬取或编造真实业务数据及数据集。2026-10-25 用户明确授权例外：老人端独立 demo 模块可保存带显著演示标记的虚构数据，仅供演示模式；不得作为真实 API 成功响应或数据库 seed。
- 不用固定成功响应冒充需要数据库或外部服务的业务能力。
- 不实现真实认证、授权、通知、求助流程、RAG、老人记忆、数字画像或设备业务。允许老人端前端纯内存模拟求助和权限交互，关闭演示模式时必须清除并隔离模拟状态。
- 不提交 `.env`、密钥、`node_modules`、`dist`、缓存或虚拟环境。

## 开发约定

- 前端使用 Vue 3、TypeScript、Vite；老人端通过 Capacitor 8 提供 Android 容器，监护人端和社区端使用独立的 uni-app 微信小程序骨架；后端使用 Python、FastAPI。
- 每个应用维护独立依赖、环境示例、入口和启动命令。
- 微信开发者工具只导入各端生成的 `dist/dev/mp-weixin` 或 `dist/build/mp-weixin`，源码仍保留在仓库中。
- Python、Android SDK、Gradle 和 npm 缓存保存在仓库外，脚本不得写死个人机器路径。
- 新功能先补测试；文档必须区分“已实现”和“待实现”。
- 环境变量示例只能使用安全的本地地址或占位符。

## 验证命令

从仓库根目录执行：

```powershell
.\scripts\verify-framework.ps1 -Python "<银龄伴 Python 可执行文件>"
```

需要同时验证 Android 原生构建时额外传入 `-IncludeAndroid`；该操作要求外部 Android SDK、JDK 和 Gradle 下载源可用。

