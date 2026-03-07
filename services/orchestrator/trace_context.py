"""
Request/trace ID for propagation to downstream services. Set at pipeline start, read in providers.
"""
from contextvars import ContextVar

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


def set_request_id(value: str | None) -> None:
    _request_id.set(value)


def get_request_id() -> str | None:
    return _request_id.get()
