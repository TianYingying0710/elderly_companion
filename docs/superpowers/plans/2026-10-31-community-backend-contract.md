# 社区端后端契约骨架实施计划

> **For agentic workers:** 每个任务按顺序执行，任务结束后立即提交。TDD 顺序不可颠倒：先写测试（RED），再写实现（GREEN）。

**Goal:** 在 `code3-community/backend` 建立 4 个资源域、10 条路径 / 12 个操作的 `/api/v1` 契约骨架，合法请求统一 501，非法请求 422，不引入数据库与业务数据。

**Architecture:** 复用老人端后端已验证的分层 —— `api/` 只做路由与模型绑定，`schemas/` 只放 Pydantic 模型，`errors.py` + `dependencies/capabilities.py` 统一抛 `CapabilityNotImplementedError` 并映射 501，`services/` 与 `repositories/` 仅保留 Protocol。

**Tech Stack:** Python 3.11+ / FastAPI 0.143 / Pydantic v2 / pytest 8 / httpx TestClient

**Spec:** `docs/superpowers/specs/2026-10-31-community-backend-contract-design.md`

---

## 任务 1：写测试（RED）

**文件：** `code3-community/backend/tests/test_contract_routes.py`、`tests/test_schemas.py`

覆盖点：

1. 12 个操作的合法请求全部返回 `501`，响应体严格等于共享包的 `CAPABILITY_NOT_IMPLEMENTED`，且键集合为 `{"error"}`。
2. 非法输入返回 `422`：
   - 路径 ID 为空白（`%20`）
   - 救援推进 `to` 为未知枚举值
   - 救援推进 `completed` 但缺 `result`
   - 课程 PATCH `status` 为未知值
   - 查询参数 `limit` 超出 1–100
3. `create_app().openapi()` 的 `/api/v1` 路径集合等于 12 条预期路径，且每个操作都声明 `501`。
4. `GET /health` 仍返回 200，且响应体未变。

**验证（RED）：** `pytest -q` 失败，错误为 `ModuleNotFoundError: No module named 'silver_companion_community.api'` 一类，证明测试确实在驱动实现。

## 任务 2：错误与能力边界

**文件：**

- `src/silver_companion_community/errors.py`：`CapabilityNotImplementedError` + `capability_not_implemented_handler`，返回 501 与共享错误体。
- `src/silver_companion_community/dependencies/__init__.py` + `capabilities.py`：`capability_not_implemented() -> NoReturn`。

**验证：** 单独导入不报错；此任务不改变测试结果。

## 任务 3：schema 层

**文件：** `schemas/__init__.py`、`schemas/rescue.py`、`schemas/service.py`、`schemas/knowledge.py`、`schemas/courses.py`

要点：

- 枚举用 `str, Enum`，值为英文 code；中文只出现在 `description`。
- 时间统一 `AwareDatetime`。
- 文本统一 `Annotated[str, Field(min_length=1)]`，配合 `ConfigDict(str_strip_whitespace=True)`。
- 救援推进请求用 `model_validator`：`to == 'completed'` 时 `result` 必填且非空；`hardware_button` 来源不得携带 `reason`。
- 列表查询参数 `limit` 限制 `1..100`，默认 20。

**验证：** `pytest tests/test_schemas.py -q` 中模型级用例转绿（路由用例仍红）。

## 任务 4：路由层

**文件：** `api/__init__.py`、`api/router.py`、`api/rescue_incidents.py`、`api/service_tasks.py`、`api/knowledge_docs.py`、`api/courses.py`

要点：

- `api_router = APIRouter(prefix="/api/v1")`，逐域 `include_router`。
- 每个路由函数体只有一行 `capability_not_implemented()`。
- 每个路由声明 `response_model` 与 `responses={501: ..., 409: ..., 404: ...}`，让 OpenAPI 反映完整契约。
- 路径参数统一 `Annotated[str, Path(min_length=1, pattern=r".*\S.*")]`，空白 ID 由 FastAPI 判 422。

**验证：** `pytest -q` 全绿（GREEN）。

## 任务 5：能力与持久化 Protocol

**文件：** `services/__init__.py`、`services/protocols.py`、`repositories/__init__.py`、`repositories/protocols.py`

要点：

- `RescueIncidentService` / `RescueIncidentRepository`：`list`、`get`、`transition`
- `ServiceTaskService` / `ServiceTaskRepository`：`list`、`get`、`transition`
- `KnowledgeDocService` / `KnowledgeDocRepository`：`list`、`get`、`update`
- `CourseService` / `CourseRepository`：`list`、`get`、`update_status`
- 全部只有方法签名，无实现，不导入任何数据库驱动。

**验证：** `pytest -q` 仍全绿；`grep -r "sqlalchemy\|sqlite3\|psycopg" src/` 无命中。

## 任务 6：接线与文档

**文件：** `src/silver_companion_community/main.py`、`docs/api.md`、`docs/progress.md`、`docs/architecture.md`

要点：

- `create_app()` 注册异常处理器并 `include_router(api_router)`，`/health` 保持在路由之外、不依赖业务模块。
- `docs/api.md` 增加社区端 `501` 契约章节，列 17 个操作与错误体。
- `docs/progress.md` 增加本次增量并说明「不能视为业务功能完成」。
- `docs/architecture.md` 增加社区端后端分层小节。

**验证：**

```powershell
.\scripts\verify-framework.ps1 -Python "E:\workspace\silver-companion-env\python.exe"
```

四端后端 pytest + 三端前端测试与构建全绿。

---

## 风险与约束

| 风险 | 应对 |
|---|---|
| 把虚构数据当接口成功响应，违反 `AGENTS.md` | 本阶段所有业务端点只返回 501，不引入任何数据 |
| 契约设计脱离前端实际需求 | 以 `src/types/community.ts` 与 5 页 mock 为唯一字段来源，差异逐条写进 spec 第八节 |
| 中文枚举直接进传输层，改文案即破契约 | 传输值用英文 code，前端映射展示文案 |
| `MM-DD HH:mm` 入库导致跨年/时区问题 | 传输层强制 `AwareDatetime` |
| 后续加实现时改动路由签名 | `api` 只依赖 Protocol 类型，实现放到 `services/impl`、`repositories/impl` |

## 不做的事（YAGNI）

- 不建库、不写迁移、不造 seed。
- 不实现认证、推送、真实上传、RAG。
- 不改前端任何文件。
- 不为 4 个域提前抽公共 CRUD 基类：等第二个域出现完全相同的处理再加。
