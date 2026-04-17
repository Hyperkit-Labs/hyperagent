"""Pytest configuration for the pipeline eval harness.

Adds the orchestrator service root to sys.path so imports like
`from workflow_state import AgentState` work without installation.
"""

from __future__ import annotations

import sys
from pathlib import Path

# services/orchestrator is the importable root for the orchestrator service.
_ORCHESTRATOR_ROOT = Path(__file__).parent.parent.parent
if str(_ORCHESTRATOR_ROOT) not in sys.path:
    sys.path.insert(0, str(_ORCHESTRATOR_ROOT))
