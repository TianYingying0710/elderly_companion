from typing import Protocol, TypeVar

T = TypeVar("T")


class DataAccess(Protocol[T]):
    """Pending: persistence contract; no database implementation exists yet."""

    async def get(self, identifier: str) -> T | None: ...

    async def save(self, value: T) -> None: ...
