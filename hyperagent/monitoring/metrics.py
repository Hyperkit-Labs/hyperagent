"""Prometheus metrics for monitoring"""

import time
from typing import Any, Dict

from prometheus_client import Counter, Gauge, Histogram, Info

# Workflow metrics
workflow_created = Counter(
    "hyperagent_workflows_created_total",
    "Total number of workflows created",
    ["network", "contract_type"],
)

workflow_completed = Counter(
    "hyperagent_workflows_completed_total",
    "Total number of workflows completed",
    ["network", "status"],
)

workflow_duration = Histogram(
    "hyperagent_workflow_duration_seconds",
    "Workflow execution duration in seconds",
    ["network"],
    buckets=[10, 30, 60, 120, 300, 600, 1800],
)

workflow_stage_duration = Histogram(
    "hyperagent_workflow_stage_duration_seconds",
    "Individual stage duration in seconds",
    ["stage", "network"],
    buckets=[1, 5, 10, 30, 60, 120],
)

# Agent metrics
agent_executions = Counter(
    "hyperagent_agent_executions_total",
    "Total number of agent executions",
    ["agent_name", "status"],
)

agent_duration = Histogram(
    "hyperagent_agent_duration_seconds",
    "Agent execution duration in seconds",
    ["agent_name"],
    buckets=[1, 5, 10, 30, 60, 120],
)

agent_errors = Counter(
    "hyperagent_agent_errors_total", "Total number of agent errors", ["agent_name", "error_type"]
)

# LLM metrics
llm_requests = Counter(
    "hyperagent_llm_requests_total", "Total number of LLM API requests", ["provider", "model"]
)

llm_tokens = Counter(
    "hyperagent_llm_tokens_total",
    "Total number of LLM tokens processed",
    ["provider", "type"],  # type: input or output
)

llm_duration = Histogram(
    "hyperagent_llm_duration_seconds",
    "LLM API call duration in seconds",
    ["provider"],
    buckets=[0.5, 1, 2, 5, 10, 30],
)

llm_errors = Counter(
    "hyperagent_llm_errors_total", "Total number of LLM API errors", ["provider", "error_type"]
)

# Security audit metrics
audit_scans = Counter(
    "hyperagent_audit_scans_total", "Total number of security audits performed", ["tool", "result"]
)

audit_vulnerabilities = Counter(
    "hyperagent_audit_vulnerabilities_total",
    "Total number of vulnerabilities found",
    ["severity", "tool"],
)

audit_duration = Histogram(
    "hyperagent_audit_duration_seconds",
    "Security audit duration in seconds",
    ["tool"],
    buckets=[5, 10, 30, 60, 120, 300],
)

# Deployment metrics
deployments = Counter(
    "hyperagent_deployments_total", "Total number of contract deployments", ["network", "status"]
)

deployment_gas = Histogram(
    "hyperagent_deployment_gas_used",
    "Gas used for contract deployments",
    ["network"],
    buckets=[100000, 500000, 1000000, 2000000, 5000000],
)

deployment_duration = Histogram(
    "hyperagent_deployment_duration_seconds",
    "Contract deployment duration in seconds",
    ["network"],
    buckets=[10, 30, 60, 120, 300, 600],
)

# x402 Payment metrics
x402_payment_verifications = Counter(
    "hyperagent_x402_payment_verifications_total",
    "Total number of x402 payment verifications",
    ["network", "status"],  # status: verified, failed, required
)

x402_payment_failures = Counter(
    "hyperagent_x402_payment_failures_total",
    "Total number of x402 payment verification failures",
    ["network", "error_type"],
)

x402_settlement_duration = Histogram(
    "hyperagent_x402_settlement_duration_seconds",
    "x402 payment settlement duration in seconds",
    ["network"],
    buckets=[0.5, 1, 2, 5, 10, 30],
)

gasless_deployments = Counter(
    "hyperagent_gasless_deployments_total",
    "Total number of gasless deployments",
    ["network", "status"],
)

acontext_api_calls = Counter(
    "hyperagent_acontext_api_calls_total",
    "Total number of Acontext API calls",
    ["operation", "status"],  # operation: store, retrieve, enhance
)

# System metrics
active_workflows = Gauge(
    "hyperagent_active_workflows", "Number of currently active workflows", ["network"]
)

queue_size = Gauge("hyperagent_queue_size", "Number of items in processing queue", ["queue_name"])

database_connections = Gauge(
    "hyperagent_database_connections", "Number of active database connections"
)

redis_connections = Gauge("hyperagent_redis_connections", "Number of active Redis connections")

# Application info
app_info = Info("hyperagent_info", "HyperAgent application information")


class MetricsCollector:
    """
    Metrics Collector

    Concept: Centralized metrics collection for monitoring
    Logic: Wraps operations to track performance and errors
    Usage: Decorators and context managers for automatic tracking
    """

    @staticmethod
    def track_workflow(network: str, contract_type: str):
        """Track workflow creation"""
        workflow_created.labels(network=network, contract_type=contract_type).inc()

    @staticmethod
    def track_agent_execution(agent_name: str, duration: float, success: bool):
        """Track agent execution"""
        status = "success" if success else "failure"
        agent_executions.labels(agent_name=agent_name, status=status).inc()
        agent_duration.labels(agent_name=agent_name).observe(duration)

    @staticmethod
    def track_llm_request(
        provider: str, model: str, duration: float, input_tokens: int = 0, output_tokens: int = 0
    ):
        """Track LLM API request"""
        llm_requests.labels(provider=provider, model=model).inc()
        llm_duration.labels(provider=provider).observe(duration)
        if input_tokens > 0:
            llm_tokens.labels(provider=provider, type="input").inc(input_tokens)
        if output_tokens > 0:
            llm_tokens.labels(provider=provider, type="output").inc(output_tokens)

    @staticmethod
    def track_audit(tool: str, duration: float, vulnerabilities: Dict[str, int]):
        """Track security audit"""
        result = "passed" if sum(vulnerabilities.values()) == 0 else "failed"
        audit_scans.labels(tool=tool, result=result).inc()
        audit_duration.labels(tool=tool).observe(duration)

        for severity, count in vulnerabilities.items():
            if count > 0:
                audit_vulnerabilities.labels(severity=severity, tool=tool).inc(count)

    @staticmethod
    def track_deployment(network: str, status: str, gas_used: int, duration: float):
        """Track contract deployment"""
        deployments.labels(network=network, status=status).inc()
        deployment_gas.labels(network=network).observe(gas_used)
        deployment_duration.labels(network=network).observe(duration)

    @staticmethod
    def update_active_workflows(network: str, count: int):
        """Update active workflows count"""
        active_workflows.labels(network=network).set(count)

    @staticmethod
    def update_queue_size(queue_name: str, size: int):
        """Update queue size"""
        queue_size.labels(queue_name=queue_name).set(size)

    @staticmethod
    def track_x402_payment(network: str, status: str, duration: float = None):
        """Track x402 payment verification"""
        x402_payment_verifications.labels(network=network, status=status).inc()
        if duration is not None:
            x402_settlement_duration.labels(network=network).observe(duration)

    @staticmethod
    def track_x402_failure(network: str, error_type: str):
        """Track x402 payment failure"""
        x402_payment_failures.labels(network=network, error_type=error_type).inc()

    @staticmethod
    def track_gasless_deployment(network: str, status: str):
        """Track gasless deployment"""
        gasless_deployments.labels(network=network, status=status).inc()

    @staticmethod
    def track_acontext_call(operation: str, status: str):
        """Track Acontext API call"""
        acontext_api_calls.labels(operation=operation, status=status).inc()


# Context manager for timing operations
class Timer:
    """Context manager for timing operations"""

    def __init__(self, histogram: Histogram, labels: Dict[str, str] = None):
        self.histogram = histogram
        self.labels = labels or {}
        self.start_time = None

    def __enter__(self):
        self.start_time = time.time()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time
        if self.labels:
            self.histogram.labels(**self.labels).observe(duration)
        else:
            self.histogram.observe(duration)
        return False
