"""Contract routes package - interaction endpoints"""

# Import the main contracts router from the .py file
# We need to import it directly to avoid circular imports
import importlib.util
import sys
from pathlib import Path

# Load contracts.py module
contracts_file = Path(__file__).parent.parent / "contracts.py"
spec = importlib.util.spec_from_file_location("contracts_routes_file", contracts_file)
contracts_routes_file = importlib.util.module_from_spec(spec)
sys.modules["contracts_routes_file"] = contracts_routes_file
spec.loader.exec_module(contracts_routes_file)

# Export router from the file
router = contracts_routes_file.router

# Also export the interact router (it's already a router, not a module)
from hyperagent.api.routes.contracts.interact import router as interact_router

__all__ = ["router", "interact_router"]

