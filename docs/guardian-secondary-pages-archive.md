# 监护人端二级页面 · 小程序项目档案

更新日期：2026-11-02

## 项目概况

- 项目：银龄伴·监护人端（微信小程序，uni-app 3 + Vue 3 + TypeScript）
- 主体：课程/毕设演示用途；AppID 未在本文件记录（测试环境使用游客 AppID，正式环境尚未配置）
- 本轮范围：首页三个已存在的详情入口，跳转到三个新增二级页面

## 技术栈

- 客户端：uni-app 3.0.0-5020620260917001（mp-weixin）+ Vue 3.4.21 + TypeScript 5.8
- 测试：vitest 3.2.7；类型检查：vue-tsc 2.2
- 后端：本轮不涉及（`code2-guardian/backend` 未改动）
- 基础库：未在 manifest 中声明特殊版本要求，未使用需要高版本基础库的能力

## 页面清单与进度

| 页面路径 | 功能 | 状态 | 备注 |
|---|---|---|---|
| pages/index/index | 首页（一级 Tab） | 已完成（改造 3 个入口 + 曲线溢出修复） | 三个入口改为 `navigateTo`；趋势画布改为位图/触摸区分离 |
| pages/advice/index | AI 关怀建议（一级 Tab） | 未改动 | — |
| pages/messages/index | 消息中心（一级 Tab） | 未改动 | — |
| pages/profile/index | 我的（一级 Tab） | 未改动 | — |
| pages/elder-detail/index | 老人档案详情 | 已完成（待提交） | 仅展示现有 4 个字段 |
| pages/health-trend/index | 健康趋势详情 | 已完成（待提交 + 曲线溢出修复） | 7 天静息心率曲线 + 逐日数值 + 最高/最低/平均 |
| pages/reminders/index | 今日提醒列表 | 已完成（待提交） | 只读，2 条现有提醒 |

## 已用组件与接口

- 导航：`uni.navigateTo`（普通页面语义）；`uni.showToast`（导航失败提示）
- 数据：`src/mock/data.ts`（`elderProfile`、`reminders`、`healthUpdatedAt`）、`src/domain/healthTrend.ts`（`heartRateTrend`、`buildTrendPoints`）
- 新增模块：`domain/routes.ts`（路由常量）、`domain/secondaryNavigation.ts`（并发锁 + 失败提示）、`domain/trendSummary.ts`（最高/最低/平均）
- 新增模块：`domain/trendCanvas.ts`（`isCanvasMeasurable` / `resolveCanvasBitmap` / `resolveTouchRegion` / `resolveBaseline` / `buildTrendAreaPath` / `DEFAULT_PIXEL_RATIO`）
- 画布：`uni.createSelectorQuery().fields({ node: true, size: true })` → 位图尺寸 = CSS 尺寸 × dpr → `ctx.setTransform` 缩放坐标系（不再用 `ctx.scale` 直接缩放）
- 未新增任何服务端接口、数据库、云开发能力

## 曲线溢出修复记录（2026-11-02）

**现象**：首页趋势曲线在滚动时上下漂移、部分超出卡片范围。

**根因（两段叠加）**：

1. `<canvas>` 是原生组件，父级 `overflow: hidden` 对它无效——官方 native-component 文档明确说明原生组件不受 Web 层裁剪。
2. 旧代码 `node.height = height * dpr` 只改位图分辨率、不改布局框，位图变成显示框的 2 倍后多出部分直接裸露在卡片外。

**修法**：

- 模板：canvas 外包一层 `.trend-canvas-box`（首页 180rpx、趋势页 320rpx，`position: relative; overflow: hidden`），把原生组件约束在一个明确的布局窗口里。
- 脚本：位图按 dpr 放大，但绘制坐标系用 `ctx.setTransform(位图宽/触摸区宽, 0, 0, 位图高/触摸区高, 0, 0)` 映射回 CSS 像素；`clearRect` 与坐标计算全部使用触摸区（CSS）尺寸。
- 守卫：`buildTrendPoints` 在宽/高非有限或 ≤0 时返回空数组，`isCanvasMeasurable` 在渲染前再拦一次，避免画布未完成布局时画出一条贴边假曲线。

**验证**：

- vitest：10 文件 52 项全过（新增 `trendCanvas.spec.ts` 9 项，`healthTrend.spec.ts` 由 3 项扩到 5 项）
- 变异测试：临时删除 `isCanvasMeasurable` 的 `height > 0` 判断，2 项用例转红（`rejects unmeasured or collapsed nodes`、`returns a zero region for an unusable node`），还原后复绿——证明测试不是空转
- 类型检查：`vue-tsc --noEmit` exit 0
- 构建：`uni build -p mp-weixin` DONE，产物含 `domain/trendCanvas.js`（644B）
- 开发者工具：WeappLog 15:38:40 出现 `compile onFileChange add domain/trendCanvas.js` 与两个页面的 js/wxml/wxss 变更，编译链无语法错误（同期 3 条 ERROR 均为工具自身 `fetchAppExptInfo` 系统错误码 1 与 `markDevLaunchEnv timingData not found`，与本次改动无关）

**仍未验证**：真机/模拟器的实际观感未人工确认；浏览器等价预览页 `guardian-ui-preview.html` 仍是旧画法（`scale(dpr,dpr)`），未同步本次修复。

## 待办与已知问题

- 提审前需确认类目与隐私配置（本页不采集任何用户信息，仍以官方最新审核规范为准）
- 二级页面的真机返回手势与长列表滚动表现尚未人工确认（模拟器侧已加载新产物，见下节）
- 老人档案页字段偏少是当前演示数据的客观限制，补字段需先确定数据口径
- **死链状态（2026-11-07 收尾）**：原 10 处死入口中，advice 4 卡片已接 `advice-detail`、消息列表已接 `message-detail`、profile 的使用帮助/关于已接静态页；剩余 profile 菜单 4 项（老人管理/家庭成员/提醒设置/消息通知设置）无目标页，点击统一提示「功能建设中」，不再静默无响应。未来若放开，仍需先定目标页（属新功能范围）
- 浏览器等价预览页 `guardian-ui-preview.html` 未同步 `setTransform` 修法，复核视觉前需重新生成

## 查看与预览通道

本机微信开发者工具已打开项目，窗口标题「银龄伴监护人端」，IDE server 监听 `127.0.0.1:27624`，其加载的产物目录为 `E:\c2--\code-guardian\code2-guardian\frontend\dist\build\mp-weixin`。

- **通道一（工具内模拟器）**：该目录已同步为本次 7 页产物（54 个文件，含 `elder-detail` / `health-trend` / `reminders` 三个页面目录），工具文件监听会触发重新编译；若模拟器仍显示旧界面，点工具顶部「编译」即可。
- **通道二（浏览器等价预览）**：`E:\c2--\code\.workbuddy\tmp\guardian-ui-preview.html`（由同目录 `preview-template.html` + `build-preview.mjs` 生成），按 `1rpx = 0.5px` 换算全部样式、注入 `assets/icons.ts` 同款图标、用 `buildTrendPoints` 同算法画曲线，可脱离 AppID 直接查看四页视觉。
- **不可用通道**：`cli open --project` 受 `touristappid` 限制恒返回 `code 10 不存在此 AppID`（appid 置空同样失败），游客/测试号只能由 GUI 导入时选择；`uni build -p h5` 因缺 `@dcloudio/uni-h5` 仅产空壳，未安装该依赖。

## 提审节点记录

暂无（本轮未提审、未提交、未推送）
