"""
Structured Logging Configuration

Concept: Centralized logging with structured output
Logic: JSON formatting, log levels, correlation IDs, file rotation
"""

import json
import logging
import sys
import uuid
from datetime import datetime
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from pathlib import Path
from typing import Any, Dict, Optional

from hyperagent.core.config import settings


class JSONFormatter(logging.Formatter):
    """
    JSON Log Formatter

    Concept: Format logs as JSON for structured logging
    Logic: Convert log records to JSON with metadata
    """

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON"""
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add correlation ID if present
        if hasattr(record, "correlation_id"):
            log_data["correlation_id"] = record.correlation_id

        # Add workflow ID if present
        if hasattr(record, "workflow_id"):
            log_data["workflow_id"] = record.workflow_id

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add extra fields
        if hasattr(record, "extra_fields"):
            log_data.update(record.extra_fields)

        return json.dumps(log_data)


class CorrelationFilter(logging.Filter):
    """
    Correlation ID Filter

    Concept: Add correlation ID to log records
    Logic: Extract from context or generate new
    """

    def filter(self, record: logging.LogRecord) -> bool:
        """Add correlation ID to record"""
        if not hasattr(record, "correlation_id"):
            # Try to get from contextvars or generate
            record.correlation_id = str(uuid.uuid4())
        return True


def setup_logging(
    log_level: str = None,
    log_format: str = None,
    log_file: str = None,
    enable_file_logging: bool = True,
) -> logging.Logger:
    """
    Setup application logging

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_format: Log format (json, text)
        log_file: Path to log file
        enable_file_logging: Enable file logging

    Returns:
        Configured root logger
    """
    # Get configuration
    log_level = log_level or settings.log_level
    log_format = log_format or settings.log_format
    log_file = log_file or settings.log_file

    # Create logs directory
    if enable_file_logging and log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Remove existing handlers
    root_logger.handlers.clear()

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    if log_format == "json":
        console_handler.setFormatter(JSONFormatter())
        console_handler.addFilter(CorrelationFilter())
    else:
        # Text formatter
        text_formatter = logging.Formatter(
            "[%(asctime)s] %(levelname)s [%(name)s:%(lineno)d] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        console_handler.setFormatter(text_formatter)

    root_logger.addHandler(console_handler)

    # File handler (with rotation)
    if enable_file_logging and log_file:
        file_handler = TimedRotatingFileHandler(
            log_file,
            when="midnight",
            interval=1,
            backupCount=30,  # Keep 30 days of logs
            encoding="utf-8",
        )
        file_handler.setLevel(logging.DEBUG)  # File gets all logs

        if log_format == "json":
            file_handler.setFormatter(JSONFormatter())
            file_handler.addFilter(CorrelationFilter())
        else:
            file_handler.setFormatter(text_formatter)

        root_logger.addHandler(file_handler)

    # Set levels for third-party loggers
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)

    return root_logger


def get_logger(name: str) -> logging.Logger:
    """
    Get logger instance

    Args:
        name: Logger name (usually __name__)

    Returns:
        Logger instance
    """
    return logging.getLogger(name)


def log_with_context(
    logger: logging.Logger,
    level: int,
    message: str,
    correlation_id: Optional[str] = None,
    workflow_id: Optional[str] = None,
    **extra_fields,
):
    """
    Log with context information

    Args:
        logger: Logger instance
        level: Log level
        message: Log message
        correlation_id: Correlation ID for request tracking
        workflow_id: Workflow ID
        **extra_fields: Additional fields to include
    """
    extra = {
        "correlation_id": correlation_id,
        "workflow_id": workflow_id,
        "extra_fields": extra_fields,
    }
    logger.log(level, message, extra=extra)


# Initialize logging on import
setup_logging()
