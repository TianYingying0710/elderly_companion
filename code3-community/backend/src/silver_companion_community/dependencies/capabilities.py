from typing import NoReturn

from silver_companion_community.errors import CapabilityNotImplementedError


def capability_not_implemented() -> NoReturn:
    raise CapabilityNotImplementedError
