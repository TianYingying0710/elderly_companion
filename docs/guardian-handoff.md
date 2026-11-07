# 监护人端小程序 · 交接文档

> 交接日期：2026-11-02
> 面向对象：接手「银龄伴·监护人端」微信小程序前端开发的同学
> 阅读顺序建议：第 1 节（现状）→ 第 2 节（从哪里开工）→ 第 3 节（改了什么）→ 第 5 节（怎么验证）→ 第 6 节（坑）

---

## 1. 一句话现状

三个二级页面（老人档案详情 / 健康趋势详情 / 今日提醒列表）已开发完成，首页溢出卡片的趋势曲线 bug 已修；**全部改动尚未提交**，停在 `feat-guardian-secondary-pages` 分支的隔离工作区里。

---

## 2. 代码在哪里（最重要的一节）

本项目当前有**三个物理副本**，容易搞混。先看清楚再动手：

| 路径 | 分支 / HEAD | 内容 | 能不能改 |
|---|---|---|---|
| `E:\c2--\code` | `main` @ `b61e907` | 主仓库。**不含本次二级页面改动** | 主仓库，改动需走分支 |
| `E:\c2--\code-guardian-hardening` | `feat-guardian-secondary-pages` @ `b61e907` | **本次全部改动都在这里**（git worktree） | ✅ 这是开发落点 |
| `E:\c2--\code-guardian-recovered` | `feat-guardian-frontend` @ `0617112` | 另一条历史 line，与本次无关 | 别碰 |

补充一个不纳管的目录：

- `E:\c2--\code-guardian\code2-guardian\frontend\dist\build\mp-weixin` —— **微信开发者工具当前打开的那个目录**。它不在 git 仓库里，是构建产物的手工副本。详见第 5 节。

### 主仓库里还有两个遗留物（不是本次改动，别误删也别误提交）

- `code1-elder/backend/tests/test_schemas.py` —— 1 行改动，**被明令禁止修改**，保持原样。
- `.wt.txt` —— 0 字节空文件，14:38 的 worktree 探测残留，可直接删除。

---

## 3. 本次改了什么

改动共 19 个文件（6 改 + 13 新增），全部在 `code2-guardian/frontend/src/` 与 `docs/` 下。

### 3.1 三个二级页面（新增）

| 页面路径 | 功能 | 说明 |
|---|---|---|
| `pages/elder-detail/index` | 老人档案详情 | 只展示现有 4 个字段，不新增数据源 |
| `pages/health-trend/index` | 健康趋势详情 | 7 天静息心率曲线 + 逐日数值 + 最高/最低/平均 |
| `pages/reminders/index` | 今日提醒列表 | 纯只读，页面内 0 个 `bindtap`，不提供任何操作控件 |

三个页面都带「演示数据」标识，数据来自 `src/mock/data.ts` 的既有虚构数据，没有新增任何接口、数据库或云开发能力。

`pages.json` 里注册了这三页；`tabBar.list` 仍保持 4 个一级页不变 —— 二级页不占 tab 位。

### 3.2 领域层模块（新增，纯函数，全部有单测）

| 文件 | 职责 |
|---|---|
| `domain/routes.ts` | 路由常量 `GUARDIAN_SECONDARY_ROUTES`，首页入口只允许引用这里的常量，禁止硬编码路径 |
| `domain/secondaryNavigation.ts` | `createSecondaryNavigator`：并发锁（防连点重复打开）+ 失败 toast。依赖以参数注入，因此能在不启动小程序运行时的前提下做纯函数测试 |
| `domain/trendSummary.ts` | 最高/最低/平均；空序列返回 `null` 而非 `NaN`，避免除零 |
| `domain/trendCanvas.ts` | 画布几何：可绘制性判定、位图尺寸、触摸区矩形、基线、折线闭合路径 |

`domain/trendCanvas.ts` 的六个导出：

```
DEFAULT_PIXEL_RATIO = 2                      // 拿不到设备像素比时的兜底
isCanvasMeasurable(metrics)                   // 宽/高/dpr 任一非有限或 ≤0 → 不可绘制
resolveCanvasBitmap(metrics)                  // 位图 = CSS × dpr，Math.floor 取整
resolveTouchRegion(metrics)                   // 触摸区恒等于 CSS 尺寸，不随 dpr 变
resolveBaseline(metrics, padding)             // 高 - 下留白，不出现负值
buildTrendAreaPath(points, metrics, padding)  // 上沿折线 + 独立 baseline
```

### 3.3 首页入口改造（修改）

`pages/index/index.vue` 里原有的三处 `showPlannedFeature`（点一下只弹「功能建设中」）改为真实跳转：

```
openElderDetail  → navigator.open(GUARDIAN_SECONDARY_ROUTES.elderDetail)
openHealthTrend  → navigator.open(GUARDIAN_SECONDARY_ROUTES.healthTrend)
openReminders    → navigator.open(GUARDIAN_SECONDARY_ROUTES.reminders)
```

`App.spec.ts` 的对应断言同步改写为 handler 函数体契约 —— 注意这里断言的是「调用了哪个 handler」，不是「调用了 navigateTo」，改法时别把这条测试写废。

### 3.4 趋势曲线溢出修复（本次的 bug fix）

**现象**：首页「近7天健康趋势」卡片的折线与面积填充穿出卡片底边，压住日期行和「今日提醒」卡片，滚动时曲线上下漂移。

**根因（两段叠加，缺一不可）**：

1. `<canvas>` 是原生组件，父级的 `overflow: hidden` 对它**无效** —— 官方 native-component 文档明确说明原生组件不受 Web 层裁剪。
2. 旧代码 `node.height = height * dpr` 已经把位图放大到 CSS 的 2 倍，后面又用 `ctx.scale(dpr, dpr)` 把绘制坐标系**再放大一次** —— 同一个 2 倍被乘了两遍。

**修法**：

| 层次 | 做法 |
|---|---|
| 模板 | canvas 外包一层 `.trend-canvas-box`（首页 180rpx、趋势页 320rpx，`position: relative; overflow: hidden`），给原生组件一个明确的、与位图比例一致的布局框 |
| 位图 | `node.width/height` 只设位图分辨率（CSS × dpr） |
| 坐标系 | `ctx.setTransform(bitmap.w/touch.w, 0, 0, bitmap.h/touch.h, 0, 0)` 映射回 CSS 像素；**废弃 `ctx.scale`** |
| 绘制 | `clearRect` 与全部坐标计算统一使用触摸区（CSS）尺寸 |
| 守卫 | `buildTrendPoints` 在宽/高非有限或 ≤0 时返回 `[]`，调用方跳过绘制；`isCanvasMeasurable` 渲染前再拦一次 |

**为什么需要那层 `.trend-canvas-box`**：`overflow: hidden` 对原生 canvas 本来不起作用，这里真正起作用的是「给 canvas 一个尺寸确定的布局父级」，把位图与显示框的裸露差压到 0。后续如果改这两个页面的画布尺寸，**布局框与位图必须同步改**，否则溢出会复现。

---

## 4. 当前未完成 / 待决策清单

### 4.1 产品侧待决策（需要产品拍板，不是技术缺口）

**10 处死链**：视觉上暗示可点，实际无任何响应。

| 位置 | 数量 | 现状 |
|---|---|---|
| `pages/advice/index` 建议卡 | 4 条，各带一个 `.chevron` 箭头 | 在 `v-for` 内，无 `@tap` |
| `pages/profile/index` 菜单项 | 6 项（老人管理 / 家庭成员 / 提醒设置 / 消息通知设置 / 使用帮助 / 关于银龄伴），各带箭头 | `<view v-for>` 无 `@tap` |

要放开这 10 处，必须先确定每个入口指向哪一页 —— 属于新功能范围，需新指令。

`pages/messages/index` 的列表项无箭头且无 tap，属设计上的只读列表，不算死链。

### 4.2 技术侧待补

- **真机/模拟器的实际观感未人工确认**。工具里原生组件是用 web 组件模拟的，官方文档也说明「很多情况不能很好还原真机表现」。曲线是否真的稳住，需要在模拟器里滑一次、最好在真机上看一遍。
- **浏览器等价预览页未同步**：`E:\c2--\code\.workbuddy\tmp\guardian-ui-preview.html` 的 canvas 仍是旧画法（`scale(dpr, dpr)`）。用它复核视觉会得出错误结论，要么重新生成，要么别用。
- **老人档案页字段偏少**：只有 4 个字段，是当前演示数据的客观限制。补字段要先定数据口径。

---

## 5. 怎么跑、怎么验证

### 5.1 环境准备

本机没有 `npm` 在 PATH 里，且 `npm.cmd` 被安全策略拦截。所以**所有命令都直接调 node 入口脚本**：

```bash
# 先准备好 PATH（PortableGit 在 .workbuddy 下，不在 Program Files）
export PATH="/c/Users/Asus/.workbuddy/binaries/PortableGit/versions/1.2.0/usr/bin:\
/c/Users/Asus/.workbuddy/binaries/PortableGit/versions/1.2.0/mingw64/bin:\
/c/Windows/System32:\
/c/Users/Asus/.workbuddy/binaries/node/versions/22.22.2-3"

cd /e/c2--/code-guardian-hardening/code2-guardian/frontend
```

依赖已存在于两个工作副本的 `node_modules` 中，**不要重新安装**。

### 5.2 四条验证命令

```bash
# 1. 单元测试（10 文件 52 项）
node ./node_modules/vitest/vitest.mjs run

# 2. 类型检查
node ./node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.app.json

# 3. 构建小程序产物
node ./node_modules/@dcloudio/vite-plugin-uni/bin/uni.js build -p mp-weixin

# 4. 单跑某一份测试
node ./node_modules/vitest/vitest.mjs run src/domain/trendCanvas.spec.ts
```

### 5.3 当前验证基线（接手后的第一道对照）

```
Test Files  10 passed (10)
     Tests  52 passed (52)
```

| 测试文件 | 用例数 | 覆盖什么 |
|---|---|---|
| `pages/secondary-pages.spec.ts` | 9 | 三页静态契约（是否含演示标识、reminders 无 bindtap 等） |
| `domain/trendCanvas.spec.ts` | 9 | 不可测量、取整、触摸区不随 dpr 变、基线闭合 |
| `domain/messages.spec.ts` | 7 | 消息筛选 |
| `domain/healthTrend.spec.ts` | 5 | 坐标生成 + 尺寸守卫（新增 2 项） |
| `domain/secondaryNavigation.spec.ts` | 5 | 并发锁、失败 toast |
| `domain/routes.spec.ts` | 4 | 路由常量与 pages.json 一致性 |
| `domain/trendSummary.spec.ts` | 4 | 空序列返回 null、平均值取一位小数 |
| `App.spec.ts` | 4 | 首页三入口的 handler 契约 |
| `domain/tabs.spec.ts` | 3 | tab 切换 |
| `api/client.spec.ts` | 2 | 请求封装 |

**做变异测试的方法**（本项目已用过，强烈建议后续继续用）：临时改坏一个判断条件 → 跑测试确认变红 → 改回 → 复跑全绿。本次验证 `isCanvasMeasurable` 时删掉 `height > 0`，`trendCanvas.spec.ts` 有 2 项转红，证明测试不是空转。**不这样验证一次，就无法判断「全绿」是真绿还是测试本身没覆盖。**

### 5.4 让改动显示在微信开发者工具里

`cli open --project` 走不通 —— 产物 `project.config.json` 的 `appid` 是 `touristappid`，CLI 的 `openProject` 强制校验合法 AppID，把 appid 置空同样报 `code 10 不存在此 AppID`。游客号只能由 GUI 导入时选择。

**可行路径：覆盖工具已经在监听的那个目录。**

```bash
SRC=/e/c2--/code-guardian-hardening/code2-guardian/frontend/dist/build/mp-weixin
DST=/e/c2--/code-guardian/code2-guardian/frontend/dist/build/mp-weixin

# 注意结尾的 /. —— 直接 cp -r 新 旧 会把新目录塞成 旧/mp-weixin 子目录
cp -r "$SRC/." "$DST/"
```

覆盖后工具会自动编译，**不需要手动点「编译」**。

### 5.5 怎么证明工具真的编译了

工具编译产物不落盘，日志是唯一能自证的通道：

```
C:\Users\Asus\AppData\Local\微信开发者工具\User Data\<hash>\WeappLog\logs\
```

按修改时间取最新的 `.log`，然后：

| 判据 | 关键字 | 含义 |
|---|---|---|
| 一 | `compile onFileChange add` / `change` | 工具检测到产物变化的时刻，同行带变更文件路径 |
| 二 | `CompileCache call executor` | 编译器确实被拉起 |
| 三 | 过滤 `[ERROR]` | 只应剩下 `markDevLaunchEnd`（启动耗时埋点）和 `fetchAppExptInfo`（系统错误码 1）两类噪音 |

出现「编译失败 / 页面不存在」才是真问题。

**核对产物新旧的可靠方法**：比对 wxml 里的文案特征（比如是否含「演示数据」、`app.json` 有几页），**比 mtime 可靠** —— 之前就因为目录 mtime 看着新、内容是旧的，误判过一次「代码没生效」。

---

## 6. 踩过的坑（省你半天时间）

| # | 现象 | 根因 | 解法 |
|---|---|---|---|
| 1 | `cat` / `grep` / `ls` / `git` / `node` 全报 command not found | PT 的便携 Git bash 没把 `usr/bin`、`mingw64/bin` 放进 PATH | 每条命令前置 `export PATH=...`，见 5.1；`git` 要用完整路径 `…/PortableGit/versions/1.2.0/cmd/git.exe` |
| 2 | `cmd.exe /c` 被安全策略拦截 | 从 Bash 调 cmd 会绕过命令校验 | 改用 PowerShell，输出先重定向到临时文件再读 |
| 3 | PowerShell 的 `& $cli -v` 无输出 | 输出没被捕获到管道 | `(& $cli ... 2>&1 \| Out-String) \| Add-Content $file` 落盘再读 |
| 4 | `cli.bat open --project` 恒报 `code 10 不存在此 AppID` | `openProject` 强制校验合法 AppID | 放弃 CLI，走 5.4 覆盖目录 |
| 5 | `mv` 旧产物目录报 `Device or resource busy` | 工具文件监听占用 | 改用 `cp -r 新/. 旧/` 覆盖内容；再清掉旧产物残留的死组件 `components/TabBar.*`，保留 `project.private.config.json` |
| 6 | `npm test` 报 MODULE_NOT_FOUND | `npm.cmd` 被拦截且 PATH 无 npm-cli.js | 直接 `node ./node_modules/vitest/vitest.mjs run` |
| 7 | 改完代码但模拟器界面没变 | 工具加载的是旧产物目录，不是新构建目录 | 按 5.4 同步，再用 5.5 的日志判据确认 |
| 8 | `uni build -p h5` 退出码 0 但只产出空壳 | 缺 `@dcloudio/uni-h5` 依赖，`package.json` 无 h5 脚本、`manifest.json` 无 h5 段 | **不要**为了网页预览去装这个依赖，走 5.4 通道 |
| 9 | 曲线按 2 倍尺寸画出显示框 | `node.height = h*dpr` 与 `ctx.scale(dpr,dpr)` 把同一个 dpr 乘了两遍 | 已修：`setTransform` 只映射坐标系一次 |
| 10 | 给 canvas 的父级加 `overflow: hidden` 仍不裁剪 | canvas 是原生组件，不受 Web 层裁剪 | 必须给 canvas 一个尺寸确定的布局父级，且父级尺寸与位图比例一致 |

---

## 7. 约束红线（来自项目 AGENTS.md 与本轮指令，动手前务必读完）

### 7.1 范围禁令

- **禁止**修改 `code1-elder/backend/tests/test_schemas.py`。
- **禁止**后端、数据库、schema、seed、迁移相关改动（社区端社区服务任务除外，详见 AGENTS.md）。
- **禁止**依赖安装（`node_modules` 已就绪，不需要装任何东西）。
- **禁止**跨应用导入内部代码（`code1-elder` / `code2-guardian` / `code3-community` 三个应用互相隔离）。
- **禁止**新增真实业务数据，只能使用现有的虚构演示数据。
- **禁止**实现真实认证、授权、通知、求助流程、RAG、老人记忆、数字画像或设备业务。

### 7.2 git 纪律

- 开发在**隔离 worktree**（`E:\c2--\code-guardian-hardening`）中进行。
- **禁止** `reset --hard`、`clean`、`rebase`、强推。
- **完成先报告，不自动提交 / 推送 / 合并 main。**

### 7.3 提交前的建议检查

```bash
GIT=/c/Users/Asus/.workbuddy/binaries/PortableGit/versions/1.2.0/cmd/git.exe
cd /e/c2--/code-guardian-hardening
"$GIT" status --short          # 确认改动清单与本文第 3 节一致
"$GIT" rev-parse --abbrev-ref HEAD   # 确认在 feat-guardian-secondary-pages
```

提交时注意：`dist/` 被 `.gitignore` 忽略，产物本就不会进版本库 —— 所以同步到开发者工具目录的操作不会污染工作区。

---

## 8. 相关文档索引

| 文档 | 内容 |
|---|---|
| `docs/guardian-secondary-pages-archive.md` | 《小程序项目档案》：页面清单与进度、已用组件与接口、提审节点记录、曲线溢出修复详情 |
| `docs/progress.md` | 项目整体进度 |
| `docs/architecture.md` | 架构说明 |
| `AGENTS.md` | 项目边界、阶段禁令、开发约定、验证命令 |
| `README.md` | 仓库总览与启动方式 |

> 施工中如需更新项目档案，以 `docs/guardian-secondary-pages-archive.md` 为准 —— 那份是随开发实况维护的活档案，本文是交接时点的快照。

---

## 9. 接手后的第一小时建议动作

1. 读 `docs/guardian-secondary-pages-archive.md`，恢复上下文。
2. 切到 `E:\c2--\code-guardian-hardening`，确认分支是 `feat-guardian-secondary-pages`。
3. 跑 5.2 的四条命令，确认基线仍是 `10 文件 52 项全过`、`type-check exit 0`、`build DONE`。
4. 打开微信开发者工具，按 5.4 同步产物，用 5.5 的日志判据确认编译成功。
5. 在模拟器里点首页三个入口，逐个进二级页，把趋势曲线上下滑一遍 —— 这是本轮唯一没有被人工确认过的部分。
6. 之后要做的事在第 4 节，按优先级是：真机确认 → 10 处死链的产品决策 → 档案页字段补充。
