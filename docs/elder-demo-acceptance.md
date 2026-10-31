# 老人端演示版验收记录

更新日期：2026-10-26

## 已实现

- Vue 3 + TypeScript + Vite + Capacitor Android 演示界面。
- 首页、陪伴、教学、个人中心、设置、家人、设备、服务、消息和模拟求助页面。
- 模拟数据集中于 `src/demo/data.ts`，关闭演示模式时清理内存状态。
- 页面、领域类型、状态组合函数和样式已按职责拆分。
- Android 普通构建与显式设备签名验收分离。

## 明确未实现

数据库、真实认证、AI、语音、通知、定位、电话、硬件、真实家人绑定和真实求助均未接入。

课程与学习记录后端路由仅用于冻结接口契约，合法请求返回 501；老人端演示页面仍读取本地模拟数据，没有把未实现接口包装成成功业务功能。

## 验收命令

在 `code1-elder/frontend` 执行 `npm run test -- --run`、`npm run build` 和 `npm run android:verify`。设备覆盖安装使用根目录 `scripts/verify-elder-device.ps1`，该脚本必须先确认新旧 APK 签名一致。
