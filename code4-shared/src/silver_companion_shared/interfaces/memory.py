from typing import Protocol


class ElderMemoryStore(Protocol):
    """Pending: elder-memory storage contract; no records are created here."""

    async def read(self, elder_id: str) -> list[str]: ...

    async def write(self, elder_id: str, content: str) -> None: ...
