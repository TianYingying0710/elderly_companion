# 课程上下架真实化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 code1 课程具备可持久化的 `published`/`unpublished` 生命周期，社区端 api 模式可上下架，老人端只看到已发布课程，并由跨端验收覆盖重启持久化。

**Architecture:** 发布状态存放在 code1 的新单表 `course_publications`（缺行即 `published`），通过 `POST /api/v1/courses/{id}/publication` 变更；列表默认过滤已下架，社区端用 `include_unpublished=true` 管理；老人端生产代码零改动。合同沿既有分层：社区端 page → composable → api → code1 HTTP，后端 route → repository（内存/SQLite 同语义）。

**Tech Stack:** Python 3.12 / FastAPI / Pydantic v2 / 标准库 `sqlite3`；Vue 3 / TypeScript / Vitest / uni-app（微信小程序，`uni.request`）；PowerShell 验证入口。

**Spec:** `docs/superpowers/specs/2026-11-14-course-publication-design.md`

**Prerequisite:** 跨端验收基座（`docs/superpowers/specs/2026-11-14-cross-end-acceptance-design.md`）必须先实现并通过。若 `scripts/acceptance/` 尚不存在，先按该规格完成基座，再执行本计划的 Task 6。

## Global Constraints

- 禁止安装任何依赖；Python 使用 `E:\workspace\silver-companion-env\python.exe`。
- 禁止 force push；合并一律 rebase + `--ff-only`；不碰 `code1-elder/backend/tests/test_schemas.py`。
- 不提交 `.env`、密钥、`node_modules`、`dist`、缓存或虚拟环境。
- 后端契约新增字段/路由必须显式报备用户；本计划即报备文本，未获批准不得执行 Task 1。
- 数据库只允许新增单表 `course_publications`，仅 `CREATE TABLE IF NOT EXISTS`；禁止 seed、预置数据、迁移框架、`ALTER TABLE`。
- 预置演示课程仍由代码提供、不落库、不可上下架。
- code3 后端课程域保持 501；不解除社区端课程域禁令。
- 老人端前端生产代码零改动；code4-shared 零改动；SOS、服务任务、监护人端零改动。
- 测试在事实源主仓库 `E:\c2--\code` 执行，不在 hardening worktree 执行。
- 所有测试数据使用明确的自动化标记，不含真实个人信息。

## 前置决策门（未获用户确认不得执行 Task 1）

1. 授权 code1 新表：`course_publications(course_id TEXT PRIMARY KEY, status TEXT NOT NULL, updated_at TEXT NOT NULL)`，仅 `CREATE TABLE IF NOT EXISTS`。
2. 批准契约新增：`status` / `editable` 字段、`include_unpublished` 查询参数、`POST /api/v1/courses/{course_id}/publication`、错误码 `course_not_editable` 与 `illegal_course_publication`。
3. 确认产品语义：预置课程不可上下架；已下架课程从老人端目录与学习记录页消失，但学习记录保留，重新发布后恢复。
4. 确认 code3 后端课程域仍为 501。

若任一项被拒绝，停止并改用规格第 4 节的备选方案重新设计。

---

### Task 1: 后端契约字段与仓库协议

**Files:**
- Modify: `code1-elder/backend/src/silver_companion_elder/schemas/courses.py`
- Modify: `code1-elder/backend/src/silver_companion_elder/repositories/protocols.py`
- Modify: `code1-elder/backend/tests/test_courses_api.py`

**Interfaces:**
- Consumes: 既有 `CourseSummary` / `CourseDetail` / `CreateCourseRequest`。
- Produces: `CourseStatus`（`published`/`unpublished`）、`CoursePublicationUpdate`、`CourseSummary.status`、`CourseSummary.editable`、统一的 `CourseRepository` 协议（含 `include_unpublished` 与 `set_publication`）。

- [ ] **Step 1: 写失败测试（字段集合与预置默认值）**

把 `code1-elder/backend/tests/test_courses_api.py` 顶部改为：

```python
import pytest
from fastapi.testclient import TestClient

from silver_companion_elder.main import create_app
from silver_companion_elder.repositories.courses import get_course_repository

client = TestClient(create_app())

COURSE_NOT_FOUND = {
    "error": {
        "code": "course_not_found",
        "message": "课程不存在",
    }
}

SUMMARY_FIELDS = {
    "id",
    "title",
    "category",
    "description",
    "duration_seconds",
    "video_url",
    "status",
    "editable",
}


@pytest.fixture(autouse=True)
def fresh_catalog(monkeypatch):
    monkeypatch.delenv("ELDER_DATABASE_PATH", raising=False)
    get_course_repository.cache_clear()
    yield
    get_course_repository.cache_clear()


def test_preset_courses_are_published_and_not_editable() -> None:
    body = client.get("/api/v1/courses").json()

    assert body
    for course in body:
        assert course["status"] == "published"
        assert course["editable"] is False
```

保留文件内既有三个测试，其余内容不变。

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
Push-Location "E:\c2--\code\code1-elder\backend"
& "E:\workspace\silver-companion-env\python.exe" -m pytest tests\test_courses_api.py -q
Pop-Location
```

Expected: FAIL（响应缺少 `status` / `editable`，字段集合断言失败）。

- [ ] **Step 3: 实现 schema**

在 `schemas/courses.py` 顶部加入 `Enum`，在 `NonEmptyText` 之后加入状态枚举，并给 `CourseSummary` 增加两个字段：

```python
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

NonEmptyText = Annotated[str, Field(min_length=1)]


class CourseStatus(str, Enum):
    """课程发布状态；缺行/新建默认 published。"""

    published = "published"
    unpublished = "unpublished"


class CourseSummary(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: NonEmptyText
    title: NonEmptyText
    category: NonEmptyText
    description: NonEmptyText
    duration_seconds: Annotated[int, Field(strict=True, ge=0)]
    # 契约扩展：课程关联视频的播放地址；演示预置课程未上传视频时为 null
    video_url: str | None = None
    # 契约扩展：发布状态与是否允许社区端上下架（预置课程恒为 False）
    status: CourseStatus = CourseStatus.published
    editable: bool = False
```

在文件末尾加入：

```python
class CoursePublicationUpdate(BaseModel):
    """上下架请求体；未知状态由 Pydantic 统一映射为 422。"""

    status: CourseStatus
```

- [ ] **Step 4: 统一仓库协议**

把 `repositories/protocols.py` 中两个重复的 `CourseRepository` 定义替换为一个（保留 `LearningRecordRepository` 不动）：

```python
from pathlib import Path
from typing import Protocol, Sequence

from fastapi import UploadFile

from silver_companion_elder.schemas.courses import (
    CourseDetail,
    CourseStatus,
    CourseSummary,
    CreateCourseRequest,
)
from silver_companion_elder.schemas.learning import LearningRecord
from silver_companion_elder.schemas.sos_events import (
    SosEvent,
    SosEventCreate,
    SosEventStatus,
)


class CourseRepository(Protocol):
    """课程/视频/学习记录仓库契约：内存实现与 SQLite 持久化实现共同遵守。"""

    def reset(self) -> None: ...
    async def create_course(self, request: CreateCourseRequest) -> CourseDetail: ...
    async def save_video(
        self, file: UploadFile, max_bytes: int, chunk_size: int
    ) -> tuple[str, str]: ...
    def get_video_path(self, video_id: str) -> Path | None: ...
    async def list_courses(
        self, include_unpublished: bool = False
    ) -> list[CourseSummary]: ...
    async def get_course(
        self, course_id: str, include_unpublished: bool = False
    ) -> CourseDetail | None: ...
    async def set_publication(
        self,
        course_id: str,
        status: CourseStatus,
        expected_status: CourseStatus,
    ) -> CourseDetail | None: ...
    async def list_records(self) -> list[LearningRecord]: ...
    async def upsert_record(
        self, course_id: str, progress_percent: int
    ) -> LearningRecord | None: ...
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```powershell
Push-Location "E:\c2--\code\code1-elder\backend"
& "E:\workspace\silver-companion-env\python.exe" -m pytest tests\test_courses_api.py -q
Pop-Location
```

Expected: PASS。

- [ ] **Step 6: 提交**

```powershell
git add code1-elder/backend/src/silver_companion_elder/schemas/courses.py code1-elder/backend/src/silver_companion_elder/repositories/protocols.py code1-elder/backend/tests/test_courses_api.py
git commit -m "feat(courses): add publication fields to course contract"
```

---

### Task 2: 内存与 SQLite 仓库的发布状态

**Files:**
- Create: `code1-elder/backend/tests/test_courses_publication_sqlite.py`
- Modify: `code1-elder/backend/src/silver_companion_elder/repositories/courses.py`
- Modify: `code1-elder/backend/src/silver_companion_elder/repositories/sqlite_courses.py`

**Interfaces:**
- Consumes: Task 1 的 `CourseStatus`、`CourseRepository`。
- Produces: `InMemoryCourseRepository` 与 `SqliteCourseRepository` 实现 `list_courses(include_unpublished=False)`、`get_course(course_id, include_unpublished=False)`、`set_publication(course_id, status, expected_status)`；SQLite 表 `course_publications`。

- [ ] **Step 1: 写失败测试**

创建 `code1-elder/backend/tests/test_courses_publication_sqlite.py`：

```python
"""课程上下架持久化测试（2026-11-14 授权例外：course_publications 单表）。"""

import asyncio
import sqlite3
import threading

from silver_companion_elder.repositories.courses import InMemoryCourseRepository
from silver_companion_elder.repositories.sqlite_courses import SqliteCourseRepository
from silver_companion_elder.schemas.courses import CourseStatus, CreateCourseRequest


def run(coro):
    return asyncio.run(coro)


def make_request(title: str = "上下架自动化测试课程") -> CreateCourseRequest:
    return CreateCourseRequest(
        title=title,
        category="数字素养",
        description="自动化测试课程",
        duration_seconds=120,
        outline=["第一步"],
    )


def make_repository(tmp_path) -> SqliteCourseRepository:
    repository = SqliteCourseRepository(tmp_path / "courses.db")
    repository.initialize()
    return repository


def test_created_course_is_published_and_editable(tmp_path) -> None:
    repository = make_repository(tmp_path)
    created = run(repository.create_course(make_request()))

    assert created.status == CourseStatus.published
    assert created.editable is True


def test_publication_persists_across_repository_instances(tmp_path) -> None:
    path = tmp_path / "courses.db"
    first = SqliteCourseRepository(path)
    first.initialize()
    created = run(first.create_course(make_request()))
    hidden = run(
        first.set_publication(
            created.id, CourseStatus.unpublished, CourseStatus.published
        )
    )
    assert hidden is not None and hidden.status == CourseStatus.unpublished

    second = SqliteCourseRepository(path)
    second.initialize()
    assert created.id not in {course.id for course in run(second.list_courses())}
    listed = {
        course.id: course
        for course in run(second.list_courses(include_unpublished=True))
    }
    assert listed[created.id].status == CourseStatus.unpublished
    assert listed[created.id].editable is True
    assert run(second.get_course(created.id)) is None
    assert run(second.get_course(created.id, include_unpublished=True)) is not None

    restored = run(
        second.set_publication(
            created.id, CourseStatus.published, CourseStatus.unpublished
        )
    )
    assert restored is not None and restored.status == CourseStatus.published


def test_same_status_transition_is_rejected(tmp_path) -> None:
    repository = make_repository(tmp_path)
    created = run(repository.create_course(make_request()))

    assert (
        run(
            repository.set_publication(
                created.id, CourseStatus.published, CourseStatus.published
            )
        )
        is None
    )


def test_preset_course_is_always_published_and_not_editable(tmp_path) -> None:
    repository = make_repository(tmp_path)
    preset = run(repository.get_course("course-smartphone-basics"))
    assert preset is not None
    assert preset.status == CourseStatus.published
    assert preset.editable is False
    assert (
        run(
            repository.set_publication(
                "course-smartphone-basics",
                CourseStatus.unpublished,
                CourseStatus.published,
            )
        )
        is None
    )
    assert run(repository.get_course("course-smartphone-basics")).status == CourseStatus.published


def test_unknown_course_publication_returns_none(tmp_path) -> None:
    repository = make_repository(tmp_path)

    assert (
        run(
            repository.set_publication(
                "course-ghost", CourseStatus.unpublished, CourseStatus.published
            )
        )
        is None
    )


def test_existing_database_defaults_courses_to_published(tmp_path) -> None:
    path = tmp_path / "legacy.db"
    connection = sqlite3.connect(path)
    connection.execute(
        """
        CREATE TABLE courses (
            id TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            duration_seconds INTEGER NOT NULL,
            outline_json TEXT NOT NULL,
            video_url TEXT
        )
        """
    )
    connection.execute(
        "INSERT INTO courses VALUES (?, ?, ?, ?, ?, ?, ?)",
        ("course-legacy", "旧库课程", "数字素养", "旧库已有课程", 60, '["第一步"]', None),
    )
    connection.commit()
    connection.close()

    repository = SqliteCourseRepository(path)
    repository.initialize()
    course = run(repository.get_course("course-legacy"))

    assert course is not None
    assert course.status == CourseStatus.published
    assert course.editable is True


def test_in_memory_publication_matches_sqlite_semantics() -> None:
    repository = InMemoryCourseRepository()
    created = run(repository.create_course(make_request()))
    assert created.status == CourseStatus.published
    assert created.editable is True

    hidden = run(
        repository.set_publication(
            created.id, CourseStatus.unpublished, CourseStatus.published
        )
    )
    assert hidden is not None and hidden.status == CourseStatus.unpublished
    assert created.id not in {course.id for course in run(repository.list_courses())}
    assert created.id in {
        course.id for course in run(repository.list_courses(include_unpublished=True))
    }
    assert run(repository.get_course(created.id)) is None
    assert (
        run(
            repository.set_publication(
                created.id, CourseStatus.published, CourseStatus.published
            )
        )
        is None
    )
    restored = run(
        repository.set_publication(
            created.id, CourseStatus.published, CourseStatus.unpublished
        )
    )
    assert restored is not None and restored.status == CourseStatus.published


def test_concurrent_unpublish_only_one_wins(tmp_path) -> None:
    path = tmp_path / "race.db"
    repository = SqliteCourseRepository(path)
    repository.initialize()
    created = run(repository.create_course(make_request()))
    barrier = threading.Barrier(2)
    results: list[object] = []

    def contend() -> None:
        contender = SqliteCourseRepository(path)
        barrier.wait()
        results.append(
            run(
                contender.set_publication(
                    created.id, CourseStatus.unpublished, CourseStatus.published
                )
            )
        )

    threads = [threading.Thread(target=contend) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sum(result is not None for result in results) == 1
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
Push-Location "E:\c2--\code\code1-elder\backend"
& "E:\workspace\silver-companion-env\python.exe" -m pytest tests\test_courses_publication_sqlite.py -q
Pop-Location
```

Expected: FAIL（`set_publication` 不存在 / 参数不匹配）。

- [ ] **Step 3: 实现内存仓库**

在 `repositories/courses.py` 顶部导入 `CourseStatus`：

```python
from silver_companion_elder.schemas.courses import (
    CourseDetail,
    CourseStatus,
    CourseSummary,
    CreateCourseRequest,
)
```

`InMemoryCourseRepository.__init__` 记录预置 id：

```python
    def __init__(self) -> None:
        self._courses = _demo_courses()
        self._preset_ids = set(self._courses)
        self._records: dict[str, LearningRecord] = {}
        self._videos: dict[str, Path] = {}
```

`create_course` 显式返回动态课程标记：

```python
        course = CourseDetail(
            id=course_id,
            title=request.title,
            category=request.category,
            description=request.description,
            duration_seconds=request.duration_seconds,
            outline=list(request.outline),
            video_url=video_url,
            status=CourseStatus.published,
            editable=True,
        )
```

替换 `list_courses` 与 `get_course`，并新增 `set_publication`：

```python
    async def list_courses(
        self, include_unpublished: bool = False
    ) -> list[CourseSummary]:
        return [
            CourseSummary(
                id=course.id,
                title=course.title,
                category=course.category,
                description=course.description,
                duration_seconds=course.duration_seconds,
                video_url=course.video_url,
                status=course.status,
                editable=course.id not in self._preset_ids,
            )
            for course in self._courses.values()
            if include_unpublished or course.status == CourseStatus.published
        ]

    async def get_course(
        self, course_id: str, include_unpublished: bool = False
    ) -> CourseDetail | None:
        course = self._courses.get(course_id)
        if course is None:
            return None
        if not include_unpublished and course.status != CourseStatus.published:
            return None
        return course

    async def set_publication(
        self,
        course_id: str,
        status: CourseStatus,
        expected_status: CourseStatus,
    ) -> CourseDetail | None:
        course = self._courses.get(course_id)
        if course is None or course_id in self._preset_ids:
            return None
        if course.status != expected_status:
            return None
        updated = course.model_copy(update={"status": status})
        self._courses[course_id] = updated
        return updated
```

- [ ] **Step 4: 实现 SQLite 仓库**

在 `repositories/sqlite_courses.py` 的 schema 常量后加入：

```python
CREATE_COURSE_PUBLICATIONS_SQL = """
CREATE TABLE IF NOT EXISTS course_publications (
    course_id TEXT PRIMARY KEY NOT NULL,
    status TEXT NOT NULL,
    updated_at TEXT NOT NULL
)
"""
```

`initialize` 中在 `CREATE_LEARNING_RECORDS_SQL` 之后执行：

```python
            connection.execute(CREATE_COURSE_PUBLICATIONS_SQL)
```

导入 `CourseStatus`：

```python
from silver_companion_elder.schemas.courses import (
    CourseDetail,
    CourseStatus,
    CourseSummary,
    CreateCourseRequest,
)
```

`create_course` 返回对象显式带状态（默认值已够，但保持与内存实现一致）：

```python
        course = CourseDetail(
            id=course_id,
            title=request.title,
            category=request.category,
            description=request.description,
            duration_seconds=request.duration_seconds,
            outline=list(request.outline),
            video_url=video_url,
            status=CourseStatus.published,
            editable=True,
        )
```

替换 `list_courses`、`get_course`，并新增 `set_publication`：

```python
    async def list_courses(
        self, include_unpublished: bool = False
    ) -> list[CourseSummary]:
        connection = self._connect()
        try:
            rows = connection.execute(
                "SELECT * FROM courses ORDER BY rowid ASC"
            ).fetchall()
            publications = connection.execute(
                "SELECT course_id, status FROM course_publications"
            ).fetchall()
        except sqlite3.Error as error:
            raise CourseStorageUnavailableError("failed to list courses") from error
        finally:
            connection.close()
        status_by_course = {
            row["course_id"]: CourseStatus(row["status"]) for row in publications
        }
        summaries = [
            CourseSummary(
                id=course.id,
                title=course.title,
                category=course.category,
                description=course.description,
                duration_seconds=course.duration_seconds,
                video_url=course.video_url,
                status=CourseStatus.published,
                editable=False,
            )
            for course in self._demo.values()
        ]
        for row in rows:
            status = status_by_course.get(row["id"], CourseStatus.published)
            if not include_unpublished and status != CourseStatus.published:
                continue
            summaries.append(
                CourseSummary(
                    id=row["id"],
                    title=row["title"],
                    category=row["category"],
                    description=row["description"],
                    duration_seconds=row["duration_seconds"],
                    video_url=row["video_url"],
                    status=status,
                    editable=True,
                )
            )
        return summaries

    async def get_course(
        self, course_id: str, include_unpublished: bool = False
    ) -> CourseDetail | None:
        demo = self._demo.get(course_id)
        if demo is not None:
            return demo
        connection = self._connect()
        try:
            row = connection.execute(
                "SELECT * FROM courses WHERE id = ?", (course_id,)
            ).fetchone()
            publication = connection.execute(
                "SELECT status FROM course_publications WHERE course_id = ?",
                (course_id,),
            ).fetchone()
        except sqlite3.Error as error:
            raise CourseStorageUnavailableError("failed to read course") from error
        finally:
            connection.close()
        if row is None:
            return None
        status = (
            CourseStatus(publication["status"])
            if publication is not None
            else CourseStatus.published
        )
        if not include_unpublished and status != CourseStatus.published:
            return None
        return CourseDetail(
            id=row["id"],
            title=row["title"],
            category=row["category"],
            description=row["description"],
            duration_seconds=row["duration_seconds"],
            outline=json.loads(row["outline_json"]),
            video_url=row["video_url"],
            status=status,
            editable=True,
        )

    async def set_publication(
        self,
        course_id: str,
        status: CourseStatus,
        expected_status: CourseStatus,
    ) -> CourseDetail | None:
        connection = self._connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            exists = connection.execute(
                "SELECT 1 FROM courses WHERE id = ?", (course_id,)
            ).fetchone()
            if exists is None:
                connection.rollback()
                return None
            row = connection.execute(
                "SELECT status FROM course_publications WHERE course_id = ?",
                (course_id,),
            ).fetchone()
            current = (
                CourseStatus(row["status"])
                if row is not None
                else CourseStatus.published
            )
            if current != expected_status:
                connection.rollback()
                return None
            connection.execute(
                "INSERT INTO course_publications (course_id, status, updated_at)"
                " VALUES (?, ?, ?)"
                " ON CONFLICT(course_id) DO UPDATE SET"
                " status = excluded.status, updated_at = excluded.updated_at",
                (course_id, status.value, datetime.now(timezone.utc).isoformat()),
            )
            connection.commit()
        except sqlite3.Error as error:
            connection.rollback()
            raise CourseStorageUnavailableError(
                "failed to update course publication"
            ) from error
        finally:
            connection.close()
        return await self.get_course(course_id, include_unpublished=True)
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```powershell
Push-Location "E:\c2--\code\code1-elder\backend"
& "E:\workspace\silver-companion-env\python.exe" -m pytest tests\test_courses_publication_sqlite.py tests\test_courses_sqlite.py -q
Pop-Location
```

Expected: PASS（新旧持久化测试都通过）。

- [ ] **Step 6: 提交**

```powershell
git add code1-elder/backend/tests/test_courses_publication_sqlite.py code1-elder/backend/src/silver_companion_elder/repositories/courses.py code1-elder/backend/src/silver_companion_elder/repositories/sqlite_courses.py
git commit -m "feat(courses): persist course publication state"
```

---

### Task 3: 上下架路由、过滤与错误码

**Files:**
- Create: `code1-elder/backend/tests/test_courses_publication_api.py`
- Modify: `code1-elder/backend/tests/test_contract_routes.py`
- Modify: `code1-elder/backend/src/silver_companion_elder/errors.py`
- Modify: `code1-elder/backend/src/silver_companion_elder/main.py`
- Modify: `code1-elder/backend/src/silver_companion_elder/api/courses.py`

**Interfaces:**
- Consumes: Task 2 的仓库方法。
- Produces: `POST /api/v1/courses/{course_id}/publication`、`GET /api/v1/courses?include_unpublished=true`、已下架详情 404、错误码 `course_not_editable` / `illegal_course_publication`。

- [ ] **Step 1: 写失败测试**

创建 `code1-elder/backend/tests/test_courses_publication_api.py`：

```python
import pytest
from fastapi.testclient import TestClient

from silver_companion_elder.main import create_app
from silver_companion_elder.repositories.courses import get_course_repository

client = TestClient(create_app())

COURSE_NOT_FOUND = {
    "error": {"code": "course_not_found", "message": "课程不存在"}
}
COURSE_NOT_EDITABLE = {
    "error": {"code": "course_not_editable", "message": "预置课程不支持上下架"}
}
ILLEGAL_COURSE_PUBLICATION = {
    "error": {
        "code": "illegal_course_publication",
        "message": "课程状态不允许重复变更",
    }
}

PAYLOAD = {
    "title": "上下架自动化测试课程",
    "category": "数字素养",
    "description": "自动化测试创建",
    "duration_seconds": 300,
    "outline": ["第一步", "第二步"],
}


@pytest.fixture(autouse=True)
def fresh_catalog(monkeypatch):
    monkeypatch.delenv("ELDER_DATABASE_PATH", raising=False)
    get_course_repository.cache_clear()
    yield
    get_course_repository.cache_clear()


def create_course() -> dict:
    response = client.post("/api/v1/courses", json=PAYLOAD)
    assert response.status_code == 201
    return response.json()


def set_publication(course_id: str, status: str):
    return client.post(
        f"/api/v1/courses/{course_id}/publication", json={"status": status}
    )


def test_created_course_is_published_and_editable() -> None:
    course = create_course()

    assert course["status"] == "published"
    assert course["editable"] is True
    listed = client.get("/api/v1/courses").json()
    assert course["id"] in {item["id"] for item in listed}


def test_unpublish_hides_course_from_default_catalog() -> None:
    course = create_course()

    response = set_publication(course["id"], "unpublished")

    assert response.status_code == 200
    assert response.json()["status"] == "unpublished"
    assert course["id"] not in {
        item["id"] for item in client.get("/api/v1/courses").json()
    }
    all_courses = client.get("/api/v1/courses?include_unpublished=true").json()
    hidden = next(item for item in all_courses if item["id"] == course["id"])
    assert hidden["status"] == "unpublished"
    assert hidden["editable"] is True


def test_unpublished_course_detail_returns_404() -> None:
    course = create_course()
    set_publication(course["id"], "unpublished")

    response = client.get(f"/api/v1/courses/{course['id']}")

    assert response.status_code == 404
    assert response.json() == COURSE_NOT_FOUND


def test_republish_restores_catalog_visibility() -> None:
    course = create_course()
    set_publication(course["id"], "unpublished")

    response = set_publication(course["id"], "published")

    assert response.status_code == 200
    assert response.json()["status"] == "published"
    assert course["id"] in {
        item["id"] for item in client.get("/api/v1/courses").json()
    }


def test_repeated_publication_returns_409() -> None:
    course = create_course()
    assert set_publication(course["id"], "unpublished").status_code == 200

    response = set_publication(course["id"], "unpublished")

    assert response.status_code == 409
    assert response.json() == ILLEGAL_COURSE_PUBLICATION


def test_preset_publication_returns_409() -> None:
    response = set_publication("course-smartphone-basics", "unpublished")

    assert response.status_code == 409
    assert response.json() == COURSE_NOT_EDITABLE


def test_unknown_course_publication_returns_404() -> None:
    response = set_publication("course-ghost", "unpublished")

    assert response.status_code == 404
    assert response.json() == COURSE_NOT_FOUND


def test_invalid_publication_status_returns_422() -> None:
    course = create_course()

    response = set_publication(course["id"], "draft")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"


def test_learning_records_survive_unpublish() -> None:
    course = create_course()
    saved = client.put(
        f"/api/v1/learning-records/{course['id']}", json={"progress_percent": 30}
    )
    assert saved.status_code == 200

    set_publication(course["id"], "unpublished")

    records = client.get("/api/v1/learning-records").json()
    assert any(
        item["course_id"] == course["id"] and item["progress_percent"] == 30
        for item in records
    )
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
Push-Location "E:\c2--\code\code1-elder\backend"
& "E:\workspace\silver-companion-env\python.exe" -m pytest tests\test_courses_publication_api.py -q
Pop-Location
```

Expected: FAIL（404/405，路由不存在）。

- [ ] **Step 3: 增加错误类型与处理器**

在 `errors.py` 的 `CourseNotFoundError` 之后加入：

```python
class CourseNotEditableError(Exception):
    """预置演示课程不支持上下架。"""


class IllegalCoursePublicationError(Exception):
    """课程发布状态不允许重复变更。"""
```

在 `COURSE_STORAGE_UNAVAILABLE` 之后加入：

```python
COURSE_NOT_EDITABLE: ErrorPayload = {
    "error": {
        "code": "course_not_editable",
        "message": "预置课程不支持上下架",
    }
}

ILLEGAL_COURSE_PUBLICATION: ErrorPayload = {
    "error": {
        "code": "illegal_course_publication",
        "message": "课程状态不允许重复变更",
    }
}
```

在既有 `course_not_found_handler` 之后加入：

```python
async def course_not_editable_handler(
    _request: Request, _error: CourseNotEditableError
) -> JSONResponse:
    return JSONResponse(status_code=409, content=COURSE_NOT_EDITABLE)


async def illegal_course_publication_handler(
    _request: Request, _error: IllegalCoursePublicationError
) -> JSONResponse:
    return JSONResponse(status_code=409, content=ILLEGAL_COURSE_PUBLICATION)
```

在 `main.py` 导入这两个异常与两个处理器，并在 `create_app()` 注册：

```python
    app.add_exception_handler(CourseNotEditableError, course_not_editable_handler)
    app.add_exception_handler(
        IllegalCoursePublicationError, illegal_course_publication_handler
    )
```

- [ ] **Step 4: 实现路由**

把 `api/courses.py` 改为：

```python
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from silver_companion_elder.errors import (
    CourseNotFoundError,
    CourseNotEditableError,
    IllegalCoursePublicationError,
)
from silver_companion_elder.repositories.courses import get_course_repository
from silver_companion_elder.repositories.protocols import CourseRepository
from silver_companion_elder.schemas.courses import (
    CourseDetail,
    CoursePublicationUpdate,
    CourseSummary,
    CreateCourseRequest,
)

router = APIRouter(prefix="/courses", tags=["courses"])
CourseId = Annotated[str, Path(min_length=1, pattern=r".*\S.*")]
IncludeUnpublished = Annotated[bool, Query()]
error_responses = {404: {"description": "课程不存在"}}
publication_error_responses = {
    404: {"description": "课程不存在"},
    409: {"description": "预置课程不可上下架或状态重复变更"},
}


@router.get("", response_model=list[CourseSummary])
async def list_courses(
    repository: Annotated[CourseRepository, Depends(get_course_repository)],
    include_unpublished: IncludeUnpublished = False,
) -> list[CourseSummary]:
    return await repository.list_courses(include_unpublished=include_unpublished)


@router.post("", response_model=CourseDetail, status_code=201, responses=error_responses)
async def create_course(
    request: CreateCourseRequest,
    repository: Annotated[CourseRepository, Depends(get_course_repository)],
) -> CourseDetail:
    try:
        return await repository.create_course(request)
    except CourseNotFoundError:
        # video_id 校验失败归为请求校验错误（422），而不是资源 404
        from fastapi.exceptions import RequestValidationError

        raise RequestValidationError(
            errors=[
                {
                    "loc": ("body", "video_id"),
                    "msg": "视频不存在，请先上传视频",
                    "type": "value_error",
                }
            ]
        ) from None


@router.get("/{course_id}", response_model=CourseDetail, responses=error_responses)
async def get_course(
    course_id: CourseId,
    repository: Annotated[CourseRepository, Depends(get_course_repository)],
) -> CourseDetail:
    course = await repository.get_course(course_id)
    if course is None:
        raise CourseNotFoundError
    return course


# 微信小程序 uni.request 不支持 PATCH：上下架统一走 POST 子资源。
@router.post(
    "/{course_id}/publication",
    response_model=CourseDetail,
    responses=publication_error_responses,
)
async def update_course_publication(
    course_id: CourseId,
    payload: CoursePublicationUpdate,
    repository: Annotated[CourseRepository, Depends(get_course_repository)],
) -> CourseDetail:
    course = await repository.get_course(course_id, include_unpublished=True)
    if course is None:
        raise CourseNotFoundError
    if not course.editable:
        raise CourseNotEditableError
    if course.status == payload.status:
        raise IllegalCoursePublicationError
    updated = await repository.set_publication(
        course_id, payload.status, expected_status=course.status
    )
    if updated is None:
        raise IllegalCoursePublicationError
    return updated
```

- [ ] **Step 5: 更新 OpenAPI 路径白名单**

`tests/test_contract_routes.py` 的 `implemented_paths` 增加一行：

```python
        "/api/v1/courses/{course_id}/publication",
```

- [ ] **Step 6: 运行测试确认通过**

Run:

```powershell
Push-Location "E:\c2--\code\code1-elder\backend"
& "E:\workspace\silver-companion-env\python.exe" -m pytest tests -q
Pop-Location
```

Expected: 全部 PASS（含既有课程/视频/学习记录/SOS/OpenAPI 白名单）。

- [ ] **Step 7: 提交**

```powershell
git add code1-elder/backend/tests/test_courses_publication_api.py code1-elder/backend/tests/test_contract_routes.py code1-elder/backend/src/silver_companion_elder/errors.py code1-elder/backend/src/silver_companion_elder/main.py code1-elder/backend/src/silver_companion_elder/api/courses.py
git commit -m "feat(courses): expose course publication API"
```

---

### Task 4: 社区端 DTO、API 与映射

**Files:**
- Modify: `code3-community/frontend/src/types/elderCourses.ts`
- Modify: `code3-community/frontend/src/api/elderCourses.ts`
- Modify: `code3-community/frontend/src/mappers/courseMapper.ts`
- Modify: `code3-community/frontend/src/data/courseProvider.ts`
- Modify: `code3-community/frontend/src/api/elderCourses.spec.ts`
- Modify: `code3-community/frontend/src/mappers/courseMapper.spec.ts`
- Modify: `code3-community/frontend/src/data/courseProvider.spec.ts`

**Interfaces:**
- Consumes: Task 3 的 HTTP 契约。
- Produces: `CourseStatus`、`CourseSummaryDto.status/editable`、`ElderCourseView.status/editable`、`getElderCourses(request, { includeUnpublished })`、`updateCoursePublication(courseId, status, request?)`、`courseStatusLabel(status)`。

- [ ] **Step 1: 更新类型**

在 `types/elderCourses.ts` 中加入：

```ts
/** 课程发布状态：与 code1 契约一致 */
export type CourseStatus = 'published' | 'unpublished'
```

`CourseSummaryDto` 增加：

```ts
  status: CourseStatus
  /** 预置演示课程为 false，社区端动态课程为 true */
  editable: boolean
```

`ElderCourseView` 增加：

```ts
  status: CourseStatus
  editable: boolean
```

- [ ] **Step 2: 写失败测试（API 与 mapper）**

`api/elderCourses.spec.ts`：更新 `dto` 为：

```ts
const dto = {
  id: 'course-1',
  title: '智能手机基础操作',
  category: '数字素养',
  description: '从开关机到连 Wi-Fi。',
  duration_seconds: 600,
  video_url: null,
  status: 'published',
  editable: true,
}
```

在 `describe` 内追加：

```ts
  it('管理目录可请求包含已下架课程', async () => {
    const { request, calls } = recorder([dto])

    await getElderCourses(request, { includeUnpublished: true })

    expect(calls[0]).toEqual({
      path: '/api/v1/courses?include_unpublished=true',
      options: { method: 'GET' },
    })
  })

  it('上下架使用 POST /publication 并携带 JSON 状态', async () => {
    const { request, calls } = recorder({ ...dto, status: 'unpublished' })

    await expect(
      updateCoursePublication('course-1', 'unpublished', request),
    ).resolves.toMatchObject({ status: 'unpublished' })

    expect(calls[0]).toEqual({
      path: '/api/v1/courses/course-1/publication',
      options: {
        method: 'POST',
        data: { status: 'unpublished' },
        header: { 'Content-Type': 'application/json' },
      },
    })
  })

  it.each([
    [{ ...dto, status: 'draft' }, 'invalid course status'],
    [{ ...dto, editable: 'yes' }, 'invalid course editable'],
  ])('非法发布字段被拒绝：%s', (raw, message) => {
    expect(() => parseCourseSummary(raw)).toThrow(message)
  })
```

并把导入改为：

```ts
import {
  createElderCourse,
  getElderCourses,
  getLearningRecords,
  parseCourseSummary,
  parseCourseVideoUpload,
  parseLearningRecord,
  updateCoursePublication,
  uploadCourseVideo,
} from './elderCourses'
```

`mappers/courseMapper.spec.ts`：`dto` 增加 `status: 'published', editable: true`；`toElderCourseView(dto)` 期望对象增加 `status: 'published', editable: true`；追加：

```ts
  it('发布状态文案', () => {
    expect(courseStatusLabel('published')).toBe('已发布')
    expect(courseStatusLabel('unpublished')).toBe('已下架')
  })
```

导入 `courseStatusLabel`。

`data/courseProvider.spec.ts`：`dto` 增加 `status: 'published', editable: true`；api provider 期望视图增加 `status: 'published', editable: true`。

- [ ] **Step 3: 运行测试确认失败**

Run:

```powershell
npm --prefix "E:\c2--\code\code3-community\frontend" test -- src/api/elderCourses.spec.ts src/mappers/courseMapper.spec.ts src/data/courseProvider.spec.ts
```

Expected: FAIL（`updateCoursePublication` / `courseStatusLabel` 未导出，DTO 字段未解析）。

- [ ] **Step 4: 实现 API 与 mapper**

`api/elderCourses.ts` 导入 `CourseStatus`，并加入解析与请求：

```ts
export function parseCourseStatus(raw: unknown): CourseStatus {
  if (raw !== 'published' && raw !== 'unpublished') {
    throw new Error('invalid course status')
  }
  return raw
}
```

在 `parseCourseSummary` 中、返回对象前加入：

```ts
  if (typeof record.editable !== 'boolean') throw new Error('invalid course editable')
```

返回对象追加：

```ts
    status: parseCourseStatus(record.status),
    editable: record.editable,
```

替换 `getElderCourses` 并新增 `updateCoursePublication`：

```ts
export interface CourseListOptions {
  includeUnpublished?: boolean
}

/** GET /api/v1/courses；管理页传 includeUnpublished 以看到已下架课程 */
export function getElderCourses(
  request: ElderCourseRequest = elderApiRequest,
  options: CourseListOptions = {},
): Promise<CourseSummaryDto[]> {
  const path = options.includeUnpublished
    ? '/api/v1/courses?include_unpublished=true'
    : '/api/v1/courses'
  return request<CourseSummaryDto[]>(path, { method: 'GET' }).then((raw: unknown) => {
    if (!Array.isArray(raw)) throw new Error('invalid courses payload')
    return raw.map(parseCourseSummary)
  })
}

/** POST /api/v1/courses/{id}/publication：微信端不支持 PATCH，使用 POST 子资源 */
export function updateCoursePublication(
  courseId: string,
  status: CourseStatus,
  request: ElderCourseRequest = elderApiRequest,
): Promise<CourseSummaryDto> {
  return request<CourseSummaryDto>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/publication`,
    {
      method: 'POST',
      data: { status },
      header: { 'Content-Type': 'application/json' },
    },
  ).then(parseCourseSummary)
}
```

`mappers/courseMapper.ts` 导入 `CourseStatus`，加入文案函数，并扩展映射：

```ts
export function courseStatusLabel(status: CourseStatus): string {
  return status === 'published' ? '已发布' : '已下架'
}

export function toElderCourseView(dto: CourseSummaryDto): ElderCourseView {
  return {
    id: dto.id,
    title: dto.title,
    category: dto.category,
    description: dto.description,
    durationText: formatDuration(dto.duration_seconds),
    hasVideo: dto.video_url !== null && dto.video_url.length > 0,
    status: dto.status,
    editable: dto.editable,
  }
}
```

`data/courseProvider.ts` 的 `mockElderCourses` 追加：

```ts
    status: 'published',
    editable: false,
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```powershell
npm --prefix "E:\c2--\code\code3-community\frontend" test -- src/api/elderCourses.spec.ts src/mappers/courseMapper.spec.ts src/data/courseProvider.spec.ts
```

Expected: PASS。

- [ ] **Step 6: 提交**

```powershell
git add code3-community/frontend/src/types/elderCourses.ts code3-community/frontend/src/api/elderCourses.ts code3-community/frontend/src/mappers/courseMapper.ts code3-community/frontend/src/data/courseProvider.ts code3-community/frontend/src/api/elderCourses.spec.ts code3-community/frontend/src/mappers/courseMapper.spec.ts code3-community/frontend/src/data/courseProvider.spec.ts
git commit -m "feat(community): add course publication API mapping"
```

---

### Task 5: 社区端编排与教学页

**Files:**
- Modify: `code3-community/frontend/src/composables/useCoursePublish.ts`
- Modify: `code3-community/frontend/src/composables/useCoursePublish.spec.ts`
- Modify: `code3-community/frontend/src/pages/teaching/index.vue`
- Create: `code3-community/frontend/src/pages/teaching/page-boundaries.spec.ts`

**Interfaces:**
- Consumes: Task 4 的 `getElderCourses(..., { includeUnpublished: true })`、`updateCoursePublication`、`ElderCourseView.status/editable`。
- Produces: `CoursePublishController.updatingId`、`setPublication(courseId, status): Promise<boolean>`；教学页上下架交互。

- [ ] **Step 1: 写失败测试（composable）**

`useCoursePublish.spec.ts`：

顶部 `dto` 增加 `status: 'published', editable: true`；`deps(result)` 增加：

```ts
    updatePublication: vi.fn(async () => result),
```

追加：

```ts
  it('上下架成功后刷新目录并清空错误', async () => {
    const d = deps(dto)
    const controller = useCoursePublish(d)

    const ok = await controller.setPublication('course-1', 'unpublished')

    expect(ok).toBe(true)
    expect(d.updatePublication).toHaveBeenCalledWith('course-1', 'unpublished')
    expect(d.listCourses).toHaveBeenCalledTimes(1)
    expect(controller.updatingId.value).toBe('')
    expect(controller.publishError.value).toBe('')
  })

  it('上下架失败写入错误且不刷新目录', async () => {
    const error = Object.assign(new Error('课程状态不允许重复变更'), {
      statusCode: 409,
      code: 'illegal_course_publication',
      fields: [],
    })
    const d = {
      ...deps(dto),
      updatePublication: vi.fn(async () => { throw error }),
    }
    const controller = useCoursePublish(d)

    const ok = await controller.setPublication('course-1', 'unpublished')

    expect(ok).toBe(false)
    expect(d.listCourses).not.toHaveBeenCalled()
    expect(controller.publishError.value).toBe('课程状态不允许重复变更')
    expect(controller.updatingId.value).toBe('')
  })

  it('更新进行中阻止重复提交', async () => {
    let resolveUpdate: (value: CourseSummaryDto) => void = () => undefined
    const pending = new Promise<CourseSummaryDto>((resolve) => {
      resolveUpdate = resolve
    })
    const d = {
      ...deps(dto),
      updatePublication: vi.fn(() => pending),
    }
    const controller = useCoursePublish(d)

    const first = controller.setPublication('course-1', 'unpublished')
    const second = await controller.setPublication('course-1', 'published')

    expect(second).toBe(false)
    resolveUpdate(dto)
    await expect(first).resolves.toBe(true)
    expect(d.updatePublication).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 2: 写失败测试（页面边界）**

创建 `pages/teaching/page-boundaries.spec.ts`：

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')

describe('teaching page boundaries', () => {
  it('上下架通过 composable，不直接调用课程 API', () => {
    expect(source).toContain('catalog.setPublication')
    expect(source).not.toMatch(/api\/elderCourses/)
  })

  it('预置课程不可操作，动态课程可上下架', () => {
    expect(source).toMatch(/v-if="!course\.editable"/)
    expect(source).toContain('预置课程')
    expect(source).toContain('updatingId.value')
    expect(source).toContain('下架')
    expect(source).toContain('重新发布')
  })

  it('不自行改写发布状态', () => {
    expect(source).not.toMatch(/course\.status\s*=[^=]/)
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```powershell
npm --prefix "E:\c2--\code\code3-community\frontend" test -- src/composables/useCoursePublish.spec.ts src/pages/teaching/page-boundaries.spec.ts
```

Expected: FAIL（`setPublication` / `updatingId` 不存在，页面无对应标记）。

- [ ] **Step 4: 实现 composable**

`useCoursePublish.ts`：

- 导入 `updateCoursePublication` 与 `CourseStatus`。
- `CoursePublishDeps` 增加：

```ts
  updatePublication?: (courseId: string, status: CourseStatus) => Promise<CourseSummaryDto>
```

- `CoursePublishController` 增加：

```ts
  /** 正在上下架的课程 id；空串表示空闲 */
  updatingId: Ref<string>
  setPublication: (courseId: string, status: CourseStatus) => Promise<boolean>
```

- 默认依赖改为：

```ts
  const listCourses =
    deps.listCourses ??
    (async () => await getElderCourses(undefined, { includeUnpublished: true }))
  const updatePublication =
    deps.updatePublication ??
    (async (courseId, status) => await updateCoursePublication(courseId, status))
```

- 状态：

```ts
  const updatingId = ref('')
```

- 新增方法：

```ts
  async function setPublication(
    courseId: string,
    status: CourseStatus,
  ): Promise<boolean> {
    if (updatingId.value) return false
    updatingId.value = courseId
    publishError.value = ''
    try {
      await updatePublication(courseId, status)
      await load()
      return true
    } catch (error) {
      publishError.value = describeCourseError(error)
      return false
    } finally {
      updatingId.value = ''
    }
  }
```

- 返回对象追加 `updatingId, setPublication`。

- [ ] **Step 5: 实现教学页 api 分支**

`pages/teaching/index.vue`：

在 `publishApiCourse` 之后加入：

```ts
async function setPublication(
  id: string,
  status: 'published' | 'unpublished',
) {
  const ok = await catalog.setPublication(id, status)
  if (!ok) {
    tip(catalog.publishError.value)
    return
  }
  tip(status === 'published' ? '课程已重新发布' : '课程已下架')
}
```

把 api 分支的横幅与课程卡改为：

```html
      <view class="api-banner">课程发布至老人端课程服务（配置 ELDER_DATABASE_PATH 时持久化）。</view>
      <view v-if="catalog.loading.value" class="course-empty">课程目录加载中…</view>
      <view v-else-if="catalog.loadError.value" class="course-empty">{{ catalog.loadError.value }}</view>
      <view v-else class="course-list">
        <view v-for="course in catalog.courses.value" :key="course.id" class="course-card">
          <view class="course-top">
            <view class="course-title">{{ course.title }}</view>
            <view class="course-tags">
              <view class="tag" :class="course.status === 'published' ? 'tag-green' : 'tag-red'">
                {{ course.status === 'published' ? '已发布' : '已下架' }}
              </view>
              <view class="tag" :class="course.hasVideo ? 'tag-green' : 'tag-blue'">
                {{ course.hasVideo ? '有视频' : '无视频' }}
              </view>
            </view>
          </view>
          <view class="course-meta">{{ course.category }} · {{ course.durationText }}</view>
          <view class="course-meta">学员进度：{{ course.progressPercent == null ? '暂无学习记录' : course.progressPercent + '%' }}</view>
          <view class="course-note">{{ course.description }}</view>
          <view class="course-footer">
            <view class="course-actions">
              <view v-if="!course.editable" class="small-action muted">预置课程</view>
              <view
                v-else
                class="small-action"
                @tap="setPublication(course.id, course.status === 'published' ? 'unpublished' : 'published')"
              >
                {{ catalog.updatingId.value === course.id
                  ? '处理中…'
                  : course.status === 'published' ? '下架' : '重新发布' }}
              </view>
            </view>
          </view>
        </view>
        <view v-if="catalog.courses.value.length === 0" class="course-empty">暂无课程</view>
      </view>
```

样式追加：

```css
.course-tags {
  flex: none;
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.small-action.muted {
  color: #98a2b3;
}
```

- [ ] **Step 6: 运行测试确认通过**

Run:

```powershell
npm --prefix "E:\c2--\code\code3-community\frontend" test
npm --prefix "E:\c2--\code\code3-community\frontend" run build:mp-weixin
```

Expected: 全部测试 PASS，`build:mp-weixin` DONE，type-check 0 错误。

- [ ] **Step 7: 提交**

```powershell
git add code3-community/frontend/src/composables/useCoursePublish.ts code3-community/frontend/src/composables/useCoursePublish.spec.ts code3-community/frontend/src/pages/teaching/index.vue code3-community/frontend/src/pages/teaching/page-boundaries.spec.ts
git commit -m "feat(community): manage course publication from teaching page"
```

---

### Task 6: 跨端验收扩展

**Files:**
- Modify: `docs/superpowers/specs/2026-11-14-cross-end-acceptance-design.md`
- Modify: `scripts/acceptance/scenarios.py`
- Modify: `scripts/acceptance/run_acceptance.py`（仅在检查总数硬编码时）

**Interfaces:**
- Consumes: 验收基座的 `Client`（规格中的 `support.Client`）与临时 SQLite 环境；Task 3 的 HTTP 契约。
- Produces: 11 项新检查（S04a–S04f、S18a–S18e），总检查数 22 → 33。

- [ ] **Step 1: 更新验收规格**

在 `2026-11-14-cross-end-acceptance-design.md` 的场景表中：

- 在 S04 后插入 S04a–S04f（内容见规格第 8 节同名表）。
- 把 S18 改为：elder 重启后 `GET /api/v1/courses?include_unpublished=true` 仍含 S03 课程且 `status=unpublished`。
- 在 S18 后插入 S18a–S18e。
- 把“总计 22 项检查”改为“总计 33 项检查”。

- [ ] **Step 2: 写失败检查**

在 `scenarios.py` 的课程场景中、S04 之后加入（若基座的请求助手命名不同，只调整 `request_json` 这一处调用形状）：

```python
def run_course_publication_checks(client, course_id: str) -> None:
    unpublished = client.request_json(
        "POST",
        f"/api/v1/courses/{course_id}/publication",
        expected_status=200,
        json={"status": "unpublished"},
    )
    assert unpublished["status"] == "unpublished", unpublished

    catalog = client.request_json("GET", "/api/v1/courses", expected_status=200)
    assert course_id not in {course["id"] for course in catalog}, catalog

    all_courses = client.request_json(
        "GET",
        "/api/v1/courses?include_unpublished=true",
        expected_status=200,
    )
    hidden = [course for course in all_courses if course["id"] == course_id]
    assert len(hidden) == 1, all_courses
    assert hidden[0]["status"] == "unpublished", hidden[0]
    assert hidden[0]["editable"] is True, hidden[0]

    client.request_json(
        "GET",
        f"/api/v1/courses/{course_id}",
        expected_status=404,
    )

    conflict = client.request_json(
        "POST",
        f"/api/v1/courses/{course_id}/publication",
        expected_status=409,
        json={"status": "unpublished"},
    )
    assert conflict["error"]["code"] == "illegal_course_publication", conflict

    missing = client.request_json(
        "POST",
        "/api/v1/courses/acceptance-ghost/publication",
        expected_status=404,
        json={"status": "unpublished"},
    )
    assert missing["error"]["code"] == "course_not_found", missing
```

重启后（在既有 S17–S19 的重启客户端上）加入：

```python
def run_course_publication_restart_checks(client, course_id: str) -> None:
    all_courses = client.request_json(
        "GET",
        "/api/v1/courses?include_unpublished=true",
        expected_status=200,
    )
    hidden = [course for course in all_courses if course["id"] == course_id]
    assert len(hidden) == 1 and hidden[0]["status"] == "unpublished", all_courses

    catalog = client.request_json("GET", "/api/v1/courses", expected_status=200)
    assert course_id not in {course["id"] for course in catalog}, catalog

    records = client.request_json(
        "GET", "/api/v1/learning-records", expected_status=200
    )
    assert any(
        record["course_id"] == course_id and record["progress_percent"] == 42
        for record in records
    ), records

    published = client.request_json(
        "POST",
        f"/api/v1/courses/{course_id}/publication",
        expected_status=200,
        json={"status": "published"},
    )
    assert published["status"] == "published", published

    restored = client.request_json("GET", "/api/v1/courses", expected_status=200)
    assert course_id in {course["id"] for course in restored}, restored
```

在编排器中：课程创建后调用 `run_course_publication_checks(client, state.course_id)`；elder 重启后调用 `run_course_publication_restart_checks(restarted_client, state.course_id)`，并确保 S04 的学习进度 42 在上下架检查之前写入。

- [ ] **Step 3: 运行验收确认失败**

Run:

```powershell
.\scripts\verify-acceptance.ps1 -Python "E:\workspace\silver-companion-env\python.exe"
```

Expected: FAIL（新检查尚未接线或后端未启动时按失败定位输出）。

- [ ] **Step 4: 接线并运行确认通过**

按 Step 2 接入编排器，运行同一命令。

Expected: 所有检查 PASS，末尾 `ACCEPTANCE PASS (33 checks)`。

- [ ] **Step 5: 提交**

```powershell
git add docs/superpowers/specs/2026-11-14-cross-end-acceptance-design.md scripts/acceptance/scenarios.py scripts/acceptance/run_acceptance.py
git commit -m "test(acceptance): cover course publication and restart persistence"
```

---

### Task 7: 文档、授权记录与全量验证

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/api.md`
- Modify: `docs/architecture.md`
- Modify: `docs/progress.md`
- Modify: `HANDOVER.md`

**Interfaces:**
- Consumes: 前六个任务的实现与测试结果。
- Produces: 契约与边界文档、AGENTS 授权记录、进度与交接更新。

- [ ] **Step 1: 记录 AGENTS 授权（仅在用户批准后）**

在 `AGENTS.md` 的“当前阶段禁令”段落、2026-11-14 老人端例外之后追加：

```text
2026-11-14 用户明确授权同类例外（仅限老人端课程上下架）：`code1-elder/backend` 允许在 `ELDER_DATABASE_PATH` 启用的同一数据库中使用单表 `course_publications`（`course_id` 主键、`status`、`updated_at`），仅允许 `CREATE TABLE IF NOT EXISTS`；缺行等价于 `published`；禁止 seed、预置数据与迁移框架。该例外不解除认证、通知、RAG、老人记忆、数字画像、设备业务以及社区端救援/知识/课程领域的禁令。
```

- [ ] **Step 2: 更新 API 文档**

`docs/api.md` 的老人端课程章节：

- 课程字段说明增加 `status` 与 `editable`。
- 表格把 `GET /api/v1/courses` 说明改为“默认仅已发布；`include_unpublished=true` 返回全部”。
- `GET /api/v1/courses/{course_id}` 说明补充“已下架按不存在返回 404”。
- 新增一行：`POST /api/v1/courses/{course_id}/publication`，体 `{"status":"published"|"unpublished"}`，微信端兼容写法。
- 错误表增加 `409 course_not_editable` 与 `409 illegal_course_publication`。
- 说明预置课程 `editable=false`，不落库、不可上下架；下架保留学习记录。

- [ ] **Step 3: 更新架构文档**

`docs/architecture.md` 的课程数据流/状态说明增加：

- `course_publications` 单表与“缺行即 published”。
- 社区端管理列表使用 `include_unpublished=true`，老人端默认过滤。
- 社区端 → code1 HTTP；无跨应用内部导入。
- 验收层覆盖上下架与重启持久化。

- [ ] **Step 4: 更新进度与交接**

`docs/progress.md` 新增 2026-11-14 章节，记录：

- 后端字段、路由、错误码、SQLite 新表与测试数量（执行后填实际值）。
- 社区端上下架交互与测试数量。
- 验收 33 项中的上下架检查。
- 老人端零改动与“下架后历史消失、记录保留”的语义。

`HANDOVER.md` 更新一句话现状与下一步候选：课程上下架已真实化；剩余候选保持既有列表，并注明 code3 后端课程域仍为 501。

- [ ] **Step 5: 全量验证**

Run（按顺序，任一步非零即停止）：

```powershell
.\scripts\verify-framework.ps1 -Python "E:\workspace\silver-companion-env\python.exe"
.\scripts\verify-acceptance.ps1 -Python "E:\workspace\silver-companion-env\python.exe"
```

Expected: 两条命令均成功；验收输出 `ACCEPTANCE PASS (33 checks)`；三端测试与 build/type-check 全过；code4-shared 契约测试全过。

- [ ] **Step 6: 检查工作区**

```powershell
git status --short
```

Expected: 只含本任务修改的文档；无 `dist`、数据库、日志或临时文件。

- [ ] **Step 7: 提交**

```powershell
git add AGENTS.md docs/api.md docs/architecture.md docs/progress.md HANDOVER.md
git commit -m "docs: document course publication slice"
```

---

## 执行完成后的集成

- 合并一律 rebase + `--ff-only`，禁止 force push。
- 推送由用户执行；向用户报告分支、提交列表与命令。
- 若任一验收失败，保留工作区与日志，不通过删除测试或放宽断言绕过。
