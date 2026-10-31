from typing import Mapping, Protocol


class DeviceGateway(Protocol):
    """Pending: device ingress contract; no device integration is implemented."""

    async def receive(self, device_id: str, payload: Mapping[str, object]) -> None: ...
