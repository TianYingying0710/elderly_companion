"""组合根：把存储实现注入 Service。测试可用 `dependency_overrides` 替换。"""

import os
from pathlib import Path

from fastapi import Depends

from silver_companion_community.repositories.sqlite_service_tasks import (
    SqliteServiceTaskRepository,
)
from silver_companion_community.service_errors import ServiceUnavailableError
from silver_companion_community.services.service_tasks import ServiceTaskService

DATABASE_PATH_ENV = "COMMUNITY_DATABASE_PATH"


def _configured_database_path() -> Path:
    raw = os.getenv(DATABASE_PATH_ENV, "").strip()
    if not raw:
        # 未配置路径属于部署配置缺失，按「服务不可用」返回，而不是伪造空数据。
        raise ServiceUnavailableError("COMMUNITY_DATABASE_PATH is not configured")
    return Path(raw)


def get_service_task_repository() -> SqliteServiceTaskRepository:
    path = _configured_database_path()
    try:
        # 只创建「已配置数据库文件」的父目录，不触碰其他路径；失败按 503 处理。
        path.parent.mkdir(parents=True, exist_ok=True)
    except OSError as error:
        raise ServiceUnavailableError("database directory is not usable") from error
    repository = SqliteServiceTaskRepository(path)
    repository.initialize()
    return repository


def get_service_task_service(
    repository: SqliteServiceTaskRepository = Depends(get_service_task_repository),
) -> ServiceTaskService:
    return ServiceTaskService(repository)
