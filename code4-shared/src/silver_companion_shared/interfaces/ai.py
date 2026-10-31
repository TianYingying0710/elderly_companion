from typing import Protocol, Sequence


class LanguageModelService(Protocol):
    """Pending: language-model provider contract; no network calls are implemented."""

    async def generate(self, messages: Sequence[str]) -> str: ...
