# 老人端演示版 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 将确认的预览落地为可安装的老人端 Android 演示版。
**Architecture:** 页面调用独立的演示状态与数据模块。真实模式只保留未接入提示及原有健康检查，不回退模拟数据。
**Tech Stack:** Vue 3 + TypeScript + Vite + Capacitor 8 + 既有 FastAPI。
**Spec:** ../specs/2026-10-25-elder-demo-design.md

## Global Constraints

- 不创建数据库或真实业务接口。模拟仅在老人端演示模式允许。
- 三端独立，沿用目录和外部工具链。
- 不自动提交、合并或发布；在用户指定分支保留可审阅改动。

## Review Focus

- 关闭演示模式后资料、权限、求助记录和聊天全部清空，不显示假成功。
- 求助失败重试、重复触发、取消后重新发起的状态一致。
- 用户输入通过 Vue 文本插值显示，不能执行 HTML。
- 大字模式、窄屏和 Android 返回键可用。
- 后端离线不阻塞演示 UI。

## Tasks

### Task 1: 数据与状态边界
- [ ] 新建 src/demo/data.ts（独立虚构数据）和 src/composables/useElderApp.ts（导航、模式、求助状态）。
- [ ] 先写 src/Demo.spec.ts：关闭模式隐藏数据且无业务请求；求助重试和取消后记录一致。
- [ ] npm test 验证 RED，再实现并验证 GREEN。

### Task 2: Vue 页面
- [ ] App.vue 为容器；components/AppIcon.vue、CourseList.vue；pages/HomePage.vue、ChatPage.vue、LearningPage.vue、AccountPage.vue、SosPage.vue。
- [ ] Props 统一使用 useElderApp 返回状态对象；状态通过该对象的方法改变。API 客户端保持独立。
- [ ] src/style.css 实现已确认手机布局、安全区域、大字、分类。
- [ ] 测试课程筛选/详情、字体、文字转义及离线健康提示。npm test、npm run build。

### Task 3: Android 与交付
- [ ] 更新 AGENTS、README、API、架构和进度，明确演示与业务区别。
- [ ] 外部工具环境运行 npm run android:verify，已有银龄伴模拟器安装验证。
- [ ] 独立审阅关键差异并修复发现；记录最终测试与实际运行结果。
