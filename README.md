# 银龄伴（Silver Companion）框架

老人端现已在 Vue 3 + Vite + Capacitor 基线上开发 Android 演示界面；监护人端和社区端仍是独立 uni-app 微信小程序骨架。三个 FastAPI 后端仍只提供健康检查，没有数据库或真实业务实现。

## 老人端演示版（2026-10-25）

- 默认开启演示模式，顶部始终标注模拟数据。可点击“关闭演示”查看未接入状态；构建环境 `VITE_DEMO_MODE=false` 可默认关闭。
- 虚构内容集中于 `code1-elder/frontend/src/demo/data.ts`，仅在演示模式提供给页面。聊天草稿、权限修改和求助进度在内存中模拟，刷新或关闭演示后清除。
- 支持首页、文字聊天展示、教学分类/筛选/详情/记录、办事流程、资料、多家人权限、设备、消息、模拟求助和字体设置。
- 未连接真实 AI、视频、蓝牙、通知或电话。仅“我的 → 使用设置 → 检查连接”访问真实 `/health`。
- Android 构建需沿用原外部 `ANDROID_USER_HOME`（含调试签名），避免覆盖安装时签名不一致。不要为此卸载已有应用。

## 目录

```text
code/
├── code1-elder/{frontend,backend}/
├── code2-guardian/{frontend,backend}/
├── code3-community/{frontend,backend}/
├── code4-shared/
├── docs/
└── scripts/
```

## 技术栈与端口

| 应用 | 前端 | 前端端口 | 后端 | 后端端口 |
|---|---|---:|---|---:|
| 老人端 | Vue 3 + TypeScript + Vite + Capacitor Android | 5173（Web 调试） | Python + FastAPI | 8001 |
| 监护人端 | uni-app + Vue 3 + TypeScript（微信小程序） | 不提供 Web 端口 | Python + FastAPI | 8002 |
| 社区端 | uni-app + Vue 3 + TypeScript（微信小程序） | 不提供 Web 端口 | Python + FastAPI | 8003 |

## 环境准备

- Node.js 22 或更高版本（Capacitor 8 要求）。
- Python 3.11 或更高版本。Python 环境与源码分离保存；脚本不绑定固定磁盘路径。
- Android Studio、Android SDK Platform 36 和一台已开启 USB 调试的安卓设备。
- 各前端复制 `.env.example` 为本地 `.env` 后可覆盖后端地址；不要提交 `.env`。真机小程序不能使用 `127.0.0.1` 访问电脑后端，应配置局域网或已备案的 HTTPS 地址。

安装前端依赖：

```powershell
npm install --prefix .\code1-elder\frontend
npm install --prefix .\code2-guardian\frontend
npm install --prefix .\code3-community\frontend
```

安装后端依赖：

```powershell
# 方式一：仅对当前终端指定银龄伴的 Python（推荐）
$env:SILVER_COMPANION_PYTHON = "E:\workspace\silver-companion-env\python.exe"
.\scripts\install-backend-dependencies.ps1

# 方式二：单次显式指定
.\scripts\install-backend-dependencies.ps1 -Python "E:\workspace\silver-companion-env\python.exe"
```

后端脚本按以下顺序选择 Python：命令参数 `-Python`、环境变量
`SILVER_COMPANION_PYTHON`、当前终端 `PATH` 中的 `python`。如需把下载缓存和临时文件放到
指定磁盘，可额外传入 `-CacheDirectory` 和 `-TempDirectory`；脚本不会自行写死这些目录。

## 启动

分别在独立终端运行：

```powershell
.\scripts\start-elder-frontend.ps1
.\scripts\start-guardian-frontend.ps1   # 持续生成 dist/dev/mp-weixin
.\scripts\start-community-frontend.ps1  # 持续生成 dist/dev/mp-weixin
.\scripts\start-elder-backend.ps1 -Python "E:\workspace\silver-companion-env\python.exe"
.\scripts\start-guardian-backend.ps1 -Python "E:\workspace\silver-companion-env\python.exe"
.\scripts\start-community-backend.ps1 -Python "E:\workspace\silver-companion-env\python.exe"
```

后端健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
Invoke-RestMethod http://127.0.0.1:8002/health
Invoke-RestMethod http://127.0.0.1:8003/health
```

监护人端和社区端开发时，在微信开发者工具中分别导入：

```text
E:\c2--\code\code2-guardian\frontend\dist\dev\mp-weixin
E:\c2--\code\code3-community\frontend\dist\dev\mp-weixin
```

生产构建使用 `npm run build:mp-weixin`，并导入对应的 `dist\build\mp-weixin`。源码无需移动到微信开发者工具目录，私有 AppID 也不得提交到仓库。

老人端 Android 工程同步与打开：

```powershell
cd .\code1-elder\frontend
npm run android:verify
npm run android:open
```

Android 构建只读取外部工具配置（`ANDROID_HOME`、`ANDROID_SDK_ROOT`、
`GRADLE_USER_HOME` 和 Android 工程本地的 `local.properties`），仓库内不保存 SDK、
Gradle 缓存或机器专用路径。`android:verify` 会依次完成 Web 构建、Capacitor 同步和
Android Debug 构建。

构建前可运行 `scripts/test-elder-android-environment.ps1` 检查外部工具。需要覆盖安装到已启动设备时，显式运行 `scripts/verify-elder-device.ps1 -Apk <APK路径> -Device <设备序列号>`；该脚本先比较 SHA-256 签名，不一致时停止且不会卸载已有应用。普通 `android:verify` 不依赖模拟器。

真机访问后端时，先将老人端 `.env.local` 的 `VITE_API_BASE_URL` 改为电脑当前局域网 IPv4 地址，再从根目录运行 `scripts\start-elder-backend.ps1`。该脚本默认监听局域网地址；仅应在可信开发网络中使用。

## 验证

```powershell
.\scripts\verify-framework.ps1 -Python "E:\workspace\silver-companion-env\python.exe"
# 外部 Android 工具和 Gradle 分发包可用时：
.\scripts\verify-framework.ps1 -Python "E:\workspace\silver-companion-env\python.exe" -IncludeAndroid
```

接口说明见 `docs/api.md`，架构边界见 `docs/architecture.md`，实际验收结果见 `docs/framework-acceptance-report.md`。

## 严格限制

不创建数据库、表、迁移、初始化或 seed 脚本，不实现知识库、向量、老人记忆或数字画像。2026-10-25 用户仅授权老人端演示模式使用独立虚构数据；真实业务接口仍标记为“待实现”。

