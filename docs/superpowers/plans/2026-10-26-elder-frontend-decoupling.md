# Elder Frontend Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变老人端现有界面和演示行为的前提下，清理重复 CSS，拆分页面、状态与业务类型，并增加独立的 Android 环境及签名验收。

**Architecture:** 保留 `App.vue` 和 `useElderApp` 作为稳定组装边界，把页面、领域类型和状态职责逐步移到更小的模块。真实请求仍只经过 `api/client.ts`，模拟数据仍只来自 `demo/data.ts`；普通 Android 构建与设备验收保持分离。

**Tech Stack:** Vue 3、TypeScript、Vite、Vitest、Capacitor 8、Android Gradle、PowerShell

**Spec:** `docs/superpowers/specs/2026-10-26-elder-frontend-decoupling-design.md`

## Global Constraints

- 不新增 Pinia、Vue Router 或其他依赖。
- 不改变现有 UI、演示数据、导航、一键求助演示和 Android 返回行为。
- 不创建数据库、迁移、初始化、seed 或真实业务数据。
- 不接入真实 AI、语音、通知、定位、电话、认证、硬件或业务接口。
- 三个应用保持独立，不跨端引用内部源码；`code4-shared` 只保存稳定契约。
- SDK、JDK、Gradle、调试密钥和机器专用路径不得进入仓库。
- 普通 `android:verify` 不依赖模拟器；设备签名和覆盖安装是独立验收。
- 当前工作区已有用户批准的未提交改动；执行过程不自动创建 Git 提交。

## Review Focus

- 关闭演示模式后，聊天、求助、选中项和模拟记录必须全部清除；Task 4 增加跨模块重置测试。
- 从详情页返回时必须恢复来源页及原选中项；Task 1 固化导航回退测试。
- 求助状态不得越级或在非演示模式推进；Task 4 覆盖非法状态跳转。
- 页面拆分后 Android 原生返回和模态框返回优先级必须不变；Task 3 覆盖浏览器事件测试。
- 没有连接模拟器时普通 Android 构建仍可完成；Task 6 将设备验收放入独立脚本并验证缺少设备时给出明确结果。

---

### Task 1: 固化现有行为基线

**Files:**
- Modify: `code1-elder/frontend/src/Demo.spec.ts`
- Modify: `code1-elder/frontend/src/App.spec.ts`
- Modify: `code1-elder/frontend/src/composables/useElderApp.spec.ts`

**Interfaces:**
- Consumes: 当前 `App.vue`、`useElderApp()` 和 `elder-back` 事件。
- Produces: 页面拆分与状态拆分必须持续满足的行为测试。

- [ ] **Step 1: 增加页面可达性和返回行为测试**

覆盖我的、设置、家人详情、设备、服务详情、消息详情、求助记录、聊天记录；断言从详情返回后恢复来源页和选中项。

- [ ] **Step 2: 增加跨状态行为测试**

断言模态框打开时 `elder-back` 先关闭模态框，内页时返回上一页，首页时不拦截系统返回。

- [ ] **Step 3: 运行测试确认基线通过**

Run: `npm run test -- --run`

Expected: 现有实现下全部 PASS；若测试暴露当前缺陷，记录为重构前缺陷并先征求处理范围，不夹带修复。

- [ ] **Step 4: 记录检查点**

Run: `git diff -- code1-elder/frontend/src/*.spec.ts code1-elder/frontend/src/composables/*.spec.ts`

Expected: 只有行为保护测试变化，不自动提交。

### Task 2: 分离领域类型和模拟数据

**Files:**
- Create: `code1-elder/frontend/src/types/domain.ts`
- Create: `code1-elder/frontend/src/types/navigation.ts`
- Modify: `code1-elder/frontend/src/demo/data.ts`
- Modify: `code1-elder/frontend/src/components/CourseList.vue`
- Create: `code1-elder/frontend/src/types/domain.spec.ts`

**Interfaces:**
- Consumes: 当前 `demoData` 字段结构。
- Produces: `Course`、`FamilyMember`、`Device`、`MessageItem`、`ServiceItem`、`RequestRecord`、`ChatMessage`、`DemoData` 和 `Page` 类型；`demoData satisfies DemoData`。

- [ ] **Step 1: 写类型边界测试**

测试导入 `demoData` 和领域类型，断言课程、家人权限、设备、消息、服务、求助记录的关键字段可按稳定类型读取；同时扫描 `components`，断言不存在 `../demo/data` 导入。

- [ ] **Step 2: 运行目标测试并确认失败**

Run: `npm run test -- --run src/types/domain.spec.ts`

Expected: FAIL，因为领域类型文件尚不存在或组件仍引用模拟模块。

- [ ] **Step 3: 建立领域和导航类型**

在 `types/domain.ts` 定义上述接口，在 `types/navigation.ts` 定义当前 `Page` 联合类型；让 `demo/data.ts` 导入类型并使用 `satisfies DemoData`，不改变数据值。

- [ ] **Step 4: 解除公共组件对模拟模块的依赖**

`CourseList.vue` 改为只导入 `Course`，prop 签名为 `courses: Course[]`。

- [ ] **Step 5: 验证**

Run: `npm run test -- --run && npm run type-check`

Expected: 全部 PASS。

### Task 3: 拆分账户与服务页面

**Files:**
- Create: `code1-elder/frontend/src/pages/account/AccountHomePage.vue`
- Create: `code1-elder/frontend/src/pages/account/SettingsPage.vue`
- Create: `code1-elder/frontend/src/pages/account/ProfilePage.vue`
- Create: `code1-elder/frontend/src/pages/account/DevicesPage.vue`
- Create: `code1-elder/frontend/src/pages/account/FamilyPage.vue`
- Create: `code1-elder/frontend/src/pages/account/FamilyDetailPage.vue`
- Create: `code1-elder/frontend/src/pages/account/RequestsPage.vue`
- Create: `code1-elder/frontend/src/pages/account/MessagesPage.vue`
- Create: `code1-elder/frontend/src/pages/account/MessageDetailPage.vue`
- Create: `code1-elder/frontend/src/pages/account/ChatHistoryPage.vue`
- Create: `code1-elder/frontend/src/pages/service/ServicePage.vue`
- Create: `code1-elder/frontend/src/pages/service/ServiceDetailPage.vue`
- Modify: `code1-elder/frontend/src/App.vue`
- Delete: `code1-elder/frontend/src/pages/AccountPage.vue`
- Create: `code1-elder/frontend/src/pages/page-boundaries.spec.ts`

**Interfaces:**
- Consumes: Task 2 的领域类型和现有 `ElderApp` 兼容接口。
- Produces: 每个页面只渲染一个职责；`App.vue` 负责页面映射和顶层外壳。

- [ ] **Step 1: 写页面边界测试**

断言各新页面文件存在、`AccountPage.vue` 不再作为聚合业务页、每个页面可由当前状态渲染；保留 Task 1 的所有导航断言。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm run test -- --run src/pages/page-boundaries.spec.ts`

Expected: FAIL，因为拆分页面尚不存在。

- [ ] **Step 3: 拆分纯展示页面**

逐一迁移当前模板，不改文案、类名、按钮测试标识和导航目标；家人权限切换、历史会话载入等操作暂时继续调用兼容接口。

- [ ] **Step 4: 更新顶层页面映射并移除旧聚合页**

`App.vue` 根据 `Page` 渲染对应组件，继续独占底部导航、反馈条、模态框、焦点管理和 `elder-back` 监听。

- [ ] **Step 5: 验证页面行为**

Run: `npm run test -- --run && npm run type-check`

Expected: 全部 PASS，Task 1 行为保持不变。

### Task 4: 拆分状态组合函数

**Files:**
- Create: `code1-elder/frontend/src/composables/useNavigation.ts`
- Create: `code1-elder/frontend/src/composables/useDemoMode.ts`
- Create: `code1-elder/frontend/src/composables/useChat.ts`
- Create: `code1-elder/frontend/src/composables/useSos.ts`
- Create: `code1-elder/frontend/src/composables/useHealth.ts`
- Modify: `code1-elder/frontend/src/composables/useElderApp.ts`
- Create: `code1-elder/frontend/src/composables/modules.spec.ts`
- Modify: `code1-elder/frontend/src/composables/useElderApp.spec.ts`

**Interfaces:**
- Consumes: Task 2 类型、`checkHealth()`、`demoData` 和 Task 3 页面调用。
- Produces: `useNavigation()`、`useDemoMode()`、`useChat()`、`useSos()`、`useHealth()`；`useElderApp()` 继续输出页面所需的稳定组合接口。

- [ ] **Step 1: 写独立模块失败测试**

覆盖导航恢复选中项、空聊天不发送、非演示模式不发送、求助非法跃迁被拒绝、健康检查防重复调用。

- [ ] **Step 2: 写跨模块重置失败测试**

先产生聊天草稿、求助状态、导航历史和选中项，再关闭演示模式；断言这些状态全部清除且回到首页。

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test -- --run src/composables/modules.spec.ts`

Expected: FAIL，因为模块尚未建立。

- [ ] **Step 4: 提取五个组合函数**

每个函数只维护本领域状态和操作；`useElderApp` 负责组装与跨模块重置，不复制演示数据或求助状态机逻辑。

- [ ] **Step 5: 缩窄页面写权限**

求助推进、权限切换、会话载入、演示切换和健康检查必须调用方法；保留搜索词、字体大小等纯界面绑定。

- [ ] **Step 6: 验证**

Run: `npm run test -- --run && npm run type-check`

Expected: 全部 PASS。

### Task 5: 清理并拆分样式

**Files:**
- Create: `code1-elder/frontend/src/styles/base.css`
- Create: `code1-elder/frontend/src/styles/layout.css`
- Create: `code1-elder/frontend/src/styles/components.css`
- Create: `code1-elder/frontend/src/styles/pages.css`
- Modify: `code1-elder/frontend/src/main.ts`
- Delete: `code1-elder/frontend/src/style.css`
- Create: `code1-elder/frontend/src/styles/styles.spec.ts`

**Interfaces:**
- Consumes: Task 3 最终模板类名。
- Produces: 固定导入顺序 `base.css` → `layout.css` → `components.css` → `pages.css`；无旧预览选择器和重复顶级选择器。

- [ ] **Step 1: 写样式结构失败测试**

扫描样式文件，断言 `.layout`、`.aside`、`.steps`、`.chatblank`、`.toast`、`.toggle` 不存在；断言 `.categories`、`.app` 和 `.hero` 的基础定义没有跨文件重复。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test -- --run src/styles/styles.spec.ts`

Expected: FAIL，因为新样式结构尚不存在。

- [ ] **Step 3: 按职责迁移实际使用样式**

保持现有视觉值，移除旧预览框架和重复覆盖；将媒体查询放入拥有对应选择器的文件。

- [ ] **Step 4: 更新入口并删除旧文件**

`main.ts` 按固定顺序导入四个样式文件，删除 `style.css`。

- [ ] **Step 5: 自动验证**

Run: `npm run test -- --run && npm run type-check && npm run build`

Expected: 全部 PASS。

- [ ] **Step 6: Android 视觉回归**

在 `SilverCompanion_API37` 对照首页、教学、聊天、我的、家人详情、服务详情和求助页面；确认大字模式、底部安全区和滚动正常。若视觉不同，仅调整样式归属或缺失规则，不改变设计。

### Task 6: 增加 Android 环境和设备验收边界

**Files:**
- Create: `scripts/test-elder-android-environment.ps1`
- Create: `scripts/verify-elder-device.ps1`
- Create: `scripts/tests/test-elder-android-scripts.ps1`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/progress.md`
- Create: `docs/elder-demo-acceptance.md`

**Interfaces:**
- Consumes: `JAVA_HOME`、`ANDROID_HOME`、`ANDROID_SDK_ROOT`、`ANDROID_USER_HOME`、`GRADLE_USER_HOME` 和现有 APK 路径。
- Produces: 无设备依赖的环境预检脚本，以及显式设备签名比较、覆盖安装、启动和前台检查脚本。

- [ ] **Step 1: 写 PowerShell 脚本测试**

用临时假目录和假可执行文件验证：缺少必需环境时给出明确错误；普通环境检查不调用 ADB；设备脚本无设备时停止；签名不同不执行安装；签名相同才允许 `adb install -r`。

- [ ] **Step 2: 运行脚本测试确认失败**

Run: `pwsh -File .\scripts\tests\test-elder-android-scripts.ps1`

Expected: FAIL，因为脚本尚不存在。

- [ ] **Step 3: 实现环境预检脚本**

`test-elder-android-environment.ps1` 只验证路径、工具和 APK签名工具，不访问设备；不含任何本机绝对路径默认值。

- [ ] **Step 4: 实现显式设备验收脚本**

`verify-elder-device.ps1` 接收设备序列号和 APK 路径，比较新 APK 与已安装包的 SHA-256 签名；不同则退出且不卸载，相同则覆盖安装、启动 `com.silvercompanion.elder/.MainActivity` 并确认前台。

- [ ] **Step 5: 更新文档和验收记录**

明确 Web 构建、Android 构建、设备验收三层边界，记录模拟器、测试、签名和未接入能力，不声称真实业务已实现。

- [ ] **Step 6: 完整验证**

Run:

```powershell
npm run test -- --run
npm run type-check
npm run build
npm run android:verify
pwsh -File .\scripts\tests\test-elder-android-scripts.ps1
```

Expected: 全部 PASS；随后在已启动模拟器上显式运行设备验收脚本并检查关键页面。

- [ ] **Step 7: 最终边界扫描**

Run: 使用 `rg` 检查跨端内部导入、仓库内密钥、机器路径、数据库文件、迁移、seed 和新增业务数据。

Expected: 无违规产物；只保留获批老人端模拟数据。

