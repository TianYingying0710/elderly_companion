# Backend Contract Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为老人端后端建立课程与学习记录的正式 `/api/v1` 契约骨架，合法业务请求统一返回结构化 501，同时保持三个 FastAPI 后端独立且不引入数据库或模拟数据。

**Architecture:** `code4-shared` 只提供业务中立的错误契约；老人端后端在独立的 schema、API、service Protocol 和 repository Protocol 中表达课程与学习记录边界。`/health` 不接触任何业务依赖，前端演示数据和行为保持不变。

**Tech Stack:** Python 3.11+、FastAPI、Pydantic、pytest

**Spec:** `docs/superpowers/specs/2026-10-26-backend-contract-foundation-design.md`

## Global Constraints

- `code1-elder`、`code2-guardian`、`code3-community` 保持三个独立应用，不跨端导入内部源码。
- 本轮只新增老人端课程与学习记录四条业务路由。
- 不新增数据库、ORM、迁移、初始化、seed、内存仓储或业务数据文件。
- 不返回固定课程、学习记录、业务编号或成功状态。
- 所有合法业务请求统一返回结构化 501；非法请求体由 Pydantic 返回 422。
- `/health` 继续独立返回 200，不依赖业务层。
- 不新增第三方依赖，不修改前端演示模式。
- 当前工作区存在已批准但未提交的老人端前端改动；执行过程不自动创建 Git 提交。

## Review Focus

- `progress_percent` 的布尔值、浮点数、负数和大于 100 的值必须被拒绝为 422；Task 2 覆盖。
- 空白课程 ID 不得被当作有效资源后再返回 501；Task 3 覆盖路径校验。
- 501 响应不得包含 `data`、课程或学习记录对象；Task 3 覆盖完整响应键。
- `/health` 在业务依赖不存在时仍须返回 200；Task 3 保留并扩展现有测试。
- OpenAPI 只能新增本轮四条业务路径，不得意外出现家人、消息、设备、求助或社区服务路由；Task 3 覆盖精确路径集合。

---

### Task 1: 共享统一错误契约

**Files:**
- Create: `code4-shared/src/silver_companion_shared/contracts/errors.py`
- Modify: `code4-shared/src/silver_companion_shared/contracts/__init__.py`
- Modify: `code4-shared/tests/test_contracts.py`

**Interfaces:**
- Consumes: 现有共享契约包结构。
- Produces: `ErrorDetail`、`ErrorPayload` 和常量 `CAPABILITY_NOT_IMPLEMENTED`；老人端 501 路由使用这些名称。

- [ ] **Step 1: 写失败契约测试**

测试导入三个公开名称，并断言错误载荷精确为 `{"error":{"code":"capability_not_implemented","message":"该业务能力尚未接入"}}`。

- [ ] **Step 2: 运行测试确认失败**

Run: `E:\workspace\silver-companion-env\python.exe -m pytest tests/test_contracts.py -q`

Workdir: `code4-shared`

Expected: FAIL，错误契约尚不存在。

- [ ] **Step 3: 实现最小共享契约**

使用 `TypedDict` 定义只包含 `code`、`message` 和外层 `error` 的结构；常量只保存统一未实现错误，不包含业务数据。

- [ ] **Step 4: 运行共享测试**

Expected: PASS。

### Task 2: 课程与学习记录 Schema

**Files:**
- Create: `code1-elder/backend/src/silver_companion_elder/schemas/__init__.py`
- Create: `code1-elder/backend/src/silver_companion_elder/schemas/courses.py`
- Create: `code1-elder/backend/src/silver_companion_elder/schemas/learning.py`
- Create: `code1-elder/backend/tests/test_schemas.py`

**Interfaces:**
- Consumes: Pydantic 现有依赖。
- Produces: `CourseSummary`、`CourseDetail`、`LearningRecord`、`LearningProgressUpdate`。

- [ ] **Step 1: 写 Schema 失败测试**

断言非空 ID、非负课程时长、带时区 `updated_at`、整数进度 0–100；分别拒绝布尔值、浮点数、负数和 101。

- [ ] **Step 2: 运行目标测试确认失败**

Run: `E:\workspace\silver-companion-env\python.exe -m pytest tests/test_schemas.py -q`

Workdir: `code1-elder/backend`

Expected: FAIL，schema 模块尚不存在。

- [ ] **Step 3: 实现严格 Pydantic 模型**

字符串字段使用去空白后的最小长度 1；`duration_seconds >= 0`；`progress_percent` 使用 strict integer 且范围 0–100；学习记录校验时区信息存在。

- [ ] **Step 4: 运行后端 Schema 和现有健康测试**

Run: `E:\workspace\silver-companion-env\python.exe -m pytest tests -q`

Expected: 全部 PASS。

### Task 3: 统一 501 路由和分层 Protocol

**Files:**
- Create: `code1-elder/backend/src/silver_companion_elder/errors.py`
- Create: `code1-elder/backend/src/silver_companion_elder/api/__init__.py`
- Create: `code1-elder/backend/src/silver_companion_elder/api/router.py`
- Create: `code1-elder/backend/src/silver_companion_elder/api/courses.py`
- Create: `code1-elder/backend/src/silver_companion_elder/api/learning_records.py`
- Create: `code1-elder/backend/src/silver_companion_elder/services/__init__.py`
- Create: `code1-elder/backend/src/silver_companion_elder/services/protocols.py`
- Create: `code1-elder/backend/src/silver_companion_elder/repositories/__init__.py`
- Create: `code1-elder/backend/src/silver_companion_elder/repositories/protocols.py`
- Create: `code1-elder/backend/src/silver_companion_elder/dependencies/__init__.py`
- Create: `code1-elder/backend/src/silver_companion_elder/dependencies/capabilities.py`
- Modify: `code1-elder/backend/src/silver_companion_elder/main.py`
- Create: `code1-elder/backend/tests/test_contract_routes.py`

**Interfaces:**
- Consumes: Task 1 错误契约和 Task 2 Pydantic 模型。
- Produces: 四条 `/api/v1` 路由；`capability_not_implemented()`；只定义签名、不提供实现的课程和学习记录 Protocol。

- [ ] **Step 1: 写业务路由失败测试**

覆盖课程列表、课程详情、学习记录列表和进度更新；合法请求断言 501 与精确错误载荷，响应中只有 `error` 键。

- [ ] **Step 2: 写校验和健康隔离失败测试**

空白或纯空格课程 ID 返回 422；进度非法返回 422；`/health` 仍返回 200，且创建应用不需要 repository 或 service 实例。

- [ ] **Step 3: 写 OpenAPI 失败测试**

断言业务路径精确包含四条，并明确声明 501；断言不存在 family、messages、devices、help-requests 和 community-services 路径。

- [ ] **Step 4: 运行路由测试确认失败**

Run: `E:\workspace\silver-companion-env\python.exe -m pytest tests/test_contract_routes.py -q`

Expected: FAIL，路由尚不存在。

- [ ] **Step 5: 实现统一未接入异常和 API router**

使用一个异常类型和处理器生成共享错误载荷；路由先完成 Pydantic/路径校验，再触发 501，不构造业务对象。

- [ ] **Step 6: 定义 service 和 repository Protocol**

只定义课程读取、学习记录读取和学习进度更新方法签名；不创建实现类、集合或固定数据。

- [ ] **Step 7: 接入主应用并验证**

Run: `E:\workspace\silver-companion-env\python.exe -m pytest tests -q`

Expected: 全部 PASS。

### Task 4: 文档和完整边界验证

**Files:**
- Modify: `docs/api.md`
- Modify: `docs/architecture.md`
- Modify: `docs/progress.md`
- Modify: `docs/elder-demo-acceptance.md`

**Interfaces:**
- Consumes: Task 1–3 的最终路由和测试结果。
- Produces: 清楚区分 200 健康接口、501 契约骨架和待实现业务的数据流说明。

- [ ] **Step 1: 更新文档**

记录四条已定义但未实现的业务路由、统一错误格式、422规则、三端独立边界和无数据库限制；不得将 501 接口写成“业务已完成”。

- [ ] **Step 2: 运行共享与三端后端测试**

从各自目录运行共享、老人端、监护人端和社区端 pytest。

Expected: 全部 PASS。

- [ ] **Step 3: 运行根级框架验证**

Run: `.\scripts\verify-framework.ps1 -Python "E:\workspace\silver-companion-env\python.exe"`

Expected: 前端、三个后端、共享契约和禁用产物扫描全部 PASS。

- [ ] **Step 4: 最终边界扫描**

使用 `rg` 和 `git status` 检查数据库、ORM、迁移、seed、内存仓储、业务数据、跨应用内部导入和环境文件。

Expected: 无新增违规产物；老人端前端演示数据仍是唯一获批例外。
