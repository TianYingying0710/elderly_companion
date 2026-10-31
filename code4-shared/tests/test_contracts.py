from silver_companion_shared.contracts.health import HealthPayload
from silver_companion_shared.contracts.errors import (
    CAPABILITY_NOT_IMPLEMENTED,
    ErrorDetail,
    ErrorPayload,
    to_validation_payload,
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


def test_to_validation_payload_maps_each_error_to_a_field() -> None:
    class _Exc:
        def errors(self) -> list[dict]:
            return [
                {"loc": ("body", "result"), "type": "missing", "msg": "Field required"},
                {"loc": ("query", "limit"), "type": "greater_than_equal", "msg": "Input should be greater than or equal to 1"},
            ]

    payload = to_validation_payload(_Exc())

    assert payload["error"]["code"] == "validation_failed"
    assert payload["error"]["message"] == "请求参数不合法"
    assert payload["error"]["fields"] == [
        {"path": "body.result", "code": "missing", "message": "Field required"},
        {"path": "query.limit", "code": "greater_than_equal", "message": "Input should be greater than or equal to 1"},
    ]
