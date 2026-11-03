# Guardian Health Data Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为监护人端建立不伪造健康结果的健康数据契约和前后端边界；本计划完成的是契约边界，不是接入真实硬件后的健康业务闭环。

**Architecture:** FastAPI route 只负责 HTTP 契约；Service 负责业务编排；`HealthDataProvider` Protocol 隔离未来硬件/外部数据源；当前未接入数据源时返回结构化 503。前端通过保留错误信息的 API Client、mapper 和 ViewModel 预留切换边界，现有 mock 演示页不直接改成假 API 成功。

**Tech Stack:** Python、FastAPI、Pydantic、Vue 3、TypeScript、uni-app、Vitest；只使用现有依赖。

**Spec:** `docs/superpowers/specs/2026-11-03-guardian-health-data-contract-design.md`

## Global Constraints

- 不安装、升级或删除依赖。
- 不接入硬件 SDK、蓝牙、数据库、外部服务、认证或授权。
- 不生成固定健康数值冒充真实成功响应。
- `/health` 继续独立于业务数据。
- 不修改老人端、社区端或共享层。
- 不提交 `.env`、`dist`、node_modules、Token、AppID 或真实数据。
- 无数据源时必须保留结构化 503，不降级为 `200 []` 或虚构指标。

## Review Focus

- 未配置 Provider 时业务接口返回 503，`/health` 仍为 200。
- Provider 返回 `updated_at=null` 时不能拼接伪造更新时间。
- `elder_id` 只允许 1–64 位字母、数字、`_`、`-`；无效值返回 422，不能与数据源不可用混淆。
- 前端 mapper 必须保留错误 code，不把 503 转成空健康卡片。
- 现有演示页面继续使用 mock，并明确标识“演示数据”。

### Task 1: Backend health contract and errors

**Files:**
- Create: `code2-guardian/backend/src/silver_companion_guardian/service_errors.py`
- Create: `code2-guardian/backend/src/silver_companion_guardian/schemas/__init__.py`
- Create: `code2-guardian/backend/src/silver_companion_guardian/schemas/health_data.py`
- Create: `code2-guardian/backend/src/silver_companion_guardian/errors.py`
- Test: `code2-guardian/backend/tests/test_health_data_contract.py`

**Interfaces:**
- Produce `HealthMetricDto`, `HealthOverviewDto`, `HealthDataErrorEnvelope`, and error code `health_data_source_unavailable`.
- `HealthMetricDto.key` uses `heart_rate | blood_pressure | sleep`; `updated_at` is timezone-aware ISO 8601 or null.
- Do not add a database or success seed.

- [ ] Write failing schema and error-handler tests.
- [ ] Run the focused pytest and verify the expected RED failure.
- [ ] Implement Pydantic models and the structured 503 handler.
- [ ] Run focused tests and verify GREEN.
- [ ] Commit `feat(guardian-backend): define health data contract`.

### Task 2: Provider Protocol and unavailable implementation

**Files:**
- Create: `code2-guardian/backend/src/silver_companion_guardian/providers/__init__.py`
- Create: `code2-guardian/backend/src/silver_companion_guardian/providers/health_data.py`
- Create: `code2-guardian/backend/src/silver_companion_guardian/services/__init__.py`
- Create: `code2-guardian/backend/src/silver_companion_guardian/services/health_data.py`
- Create: `code2-guardian/backend/src/silver_companion_guardian/dependencies/__init__.py`
- Create: `code2-guardian/backend/src/silver_companion_guardian/dependencies/health.py`
- Test: `code2-guardian/backend/tests/test_health_data_service.py`

**Interfaces:**
- `HealthDataProvider.get_overview(elder_id: str) -> HealthOverviewDto`
- `elder_id` is already validated as 1–64 characters matching `[A-Za-z0-9_-]+`.
- The default provider raises `HealthDataSourceUnavailableError` and never returns metrics.

- [ ] Write failing service tests for unavailable source and provider injection.
- [ ] Run focused pytest and verify RED.
- [ ] Implement Protocol, unavailable provider, and Service.
- [ ] Run focused tests and verify GREEN.
- [ ] Commit `feat(guardian-backend): isolate health data provider`.

### Task 3: Read-only API route

**Files:**
- Create: `code2-guardian/backend/src/silver_companion_guardian/api/__init__.py`
- Create: `code2-guardian/backend/src/silver_companion_guardian/api/health_data.py`
- Modify: `code2-guardian/backend/src/silver_companion_guardian/main.py`
- Test: `code2-guardian/backend/tests/test_health_data_api.py`

**Interfaces:**
- Add `GET /api/v1/health-overview/{elder_id}`.
- Invalid path IDs return 422; the default unavailable Provider returns 503 with the exact `error.code` and `error.fields` envelope.
- Valid route with the default provider returns the structured 503.
- `/health` remains 200 and unchanged.

- [ ] Write failing route tests for 503 envelope, invalid ID 422, and health independence.
- [ ] Run focused pytest and verify RED.
- [ ] Implement route wiring through dependency injection.
- [ ] Run backend tests and verify GREEN.
- [ ] Commit `feat(guardian-backend): expose health overview contract`.

### Task 4: Frontend API error preservation

**Files:**
- Modify: `code2-guardian/frontend/src/api/client.ts`
- Modify: `code2-guardian/frontend/src/api/client.spec.ts`
- Create: `code2-guardian/frontend/src/types/healthData.ts`
- Create: `code2-guardian/frontend/src/mappers/healthDataMapper.ts`
- Create: `code2-guardian/frontend/src/api/healthData.ts`
- Test: `code2-guardian/frontend/src/api/healthData.spec.ts`
- Test: `code2-guardian/frontend/src/mappers/healthDataMapper.spec.ts`

**Interfaces:**
- Extend the existing API error type to preserve HTTP status, `error.code`, `error.message`, and `error.fields` from the backend envelope.
- API module calls `/api/v1/health-overview/{elderId}`.
- Mapper converts backend `heart_rate` to frontend `heartRate` and preserves `health_data_source_unavailable` as a typed error state.
- Do not replace current mock pages in this task.

- [ ] Write failing API-client tests for parsing the structured 503 envelope, plus mapper tests for DTO field mapping and error-code preservation.
- [ ] Run focused Vitest and verify RED.
- [ ] Implement the boundary with existing `api/client.ts`.
- [ ] Run full guardian frontend tests, type-check, and build.
- [ ] Commit `feat(guardian-frontend): add health data api boundary`.

### Task 5: Verification and handoff

- [ ] Run guardian backend tests from its backend directory.
- [ ] Run guardian frontend `npm test`, `npm run type-check`, and `npm run build:mp-weixin`.
- [ ] Confirm no database, hardware SDK, seed, fake metrics, or cross-app imports.
- [ ] Confirm `/health` 200 and health overview 503 with exact error code.
- [ ] Run `git diff --check`, `git status --short --branch`, and `git fsck --full`.
- [ ] Update `docs/progress.md` to distinguish “contract boundary implemented” from “real health source not connected”.
