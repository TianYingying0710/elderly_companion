from typing import Protocol


class CommunityKnowledgeRetriever(Protocol):
    """Pending: community knowledge retrieval contract."""

    async def search(self, query: str, limit: int = 5) -> list[str]: ...
