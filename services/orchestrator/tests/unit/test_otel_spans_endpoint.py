"""OTLP HTTP endpoint normalization for orchestrator spans."""

from __future__ import annotations

import otel_spans


def test_traces_endpoint_appends_v1_traces(monkeypatch):
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://dd-agent:4318")
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", raising=False)
    assert otel_spans._otlp_http_traces_endpoint() == "http://dd-agent:4318/v1/traces"


def test_traces_endpoint_respects_full_url(monkeypatch):
    monkeypatch.setenv(
        "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
        "https://collector.example.com/v1/traces",
    )
    assert (
        otel_spans._otlp_http_traces_endpoint()
        == "https://collector.example.com/v1/traces"
    )


def test_traces_endpoint_metrics_to_traces(monkeypatch):
    monkeypatch.setenv(
        "OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318/v1/metrics"
    )
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", raising=False)
    assert otel_spans._otlp_http_traces_endpoint() == "http://localhost:4318/v1/traces"
