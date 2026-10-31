from silver_companion_shared.contracts.health import HealthPayload
from silver_companion_shared.contracts.errors import (
    CAPABILITY_NOT_IMPLEMENTED,
    ErrorDetail,
    ErrorPayload,
)
from silver_companion_shared.interfaces import (
    CommunityKnowledgeRetriever,
    DataAccess,
    DeviceGateway,
    ElderMemoryStore,
    LanguageModelService,
)


def test_shared_contracts_are_importable() -> None:
    payload: HealthPayload = {"status": "ok", "service": "test"}
    assert payload["status"] == "ok"
    assert all(
        contract is not None
        for contract in (
            CommunityKnowledgeRetriever,
            DataAccess,
            DeviceGateway,
            ElderMemoryStore,
            LanguageModelService,
        )
    )


def test_capability_not_implemented_error_contract() -> None:
    detail: ErrorDetail = {
        "code": "capability_not_implemented",
        "message": "该业务能力尚未接入",
    }
    payload: ErrorPayload = {"error": detail}

    assert payload == CAPABILITY_NOT_IMPLEMENTED
    assert set(payload) == {"error"}
