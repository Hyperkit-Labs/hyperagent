"""
Load GitOps registries from infra/registries (categorized: network/, x402/, sdks/, erc8004/, root).
Single source of truth; load at startup and cache. Set REGISTRIES_PATH to override.
Paths: pipelines.yaml, network/chains.yaml, security.yaml, tokens.yaml, x402/settings.yaml,
roma.yaml, orchestrator.yaml, erc8004/erc8004.yaml.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

DEFAULT_PIPELINE_ID = "evm-default"

try:
    import yaml
except ImportError:
    yaml = None

_REGISTRIES_PATH = os.environ.get("REGISTRIES_PATH", "")
_PIPELINES: dict[str, Any] | None = None
_CHAINS: dict[str, Any] | None = None
_SECURITY: dict[str, Any] | None = None
_TOKENS: dict[str, Any] | None = None
_X402_SETTINGS: dict[str, Any] | None = None
_X402_PRODUCTS: dict[str, Any] | None = None
_STABLECOINS: dict[str, Any] | None = None
_ROMA: dict[str, Any] | None = None
_ORCHESTRATOR: dict[str, Any] | None = None
_ERC8004: dict[str, Any] | None = None


def _registries_dir() -> Path:
    if _REGISTRIES_PATH:
        return Path(_REGISTRIES_PATH)
    # Default: repo infra/registries (when running from services/orchestrator)
    return Path(__file__).resolve().parent.parent.parent / "infra" / "registries"


def _load_yaml(name: str) -> dict[str, Any]:
    path = _registries_dir() / name
    if not path.exists():
        return {}
    if yaml is None:
        return {}
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _ensure_loaded() -> None:
    global _PIPELINES, _CHAINS, _SECURITY, _TOKENS, _X402_SETTINGS, _X402_PRODUCTS, _STABLECOINS, _ROMA, _ORCHESTRATOR, _ERC8004
    if _PIPELINES is None:
        _PIPELINES = _load_yaml("pipelines.yaml")
    if _CHAINS is None:
        _CHAINS = _load_yaml("network/chains.yaml")
    if _SECURITY is None:
        _SECURITY = _load_yaml("security.yaml")
    if _TOKENS is None:
        _TOKENS = _load_yaml("tokens.yaml")
    if _X402_SETTINGS is None:
        _X402_SETTINGS = _load_yaml("x402/settings.yaml")
    if _X402_PRODUCTS is None:
        _X402_PRODUCTS = _load_yaml("x402/x402-products.yaml")
    if _STABLECOINS is None:
        _STABLECOINS = _load_yaml("x402/stablecoins.yaml")
    if _ROMA is None:
        _ROMA = _load_yaml("roma.yaml")
    if _ORCHESTRATOR is None:
        _ORCHESTRATOR = _load_yaml("orchestrator.yaml")
    if _ERC8004 is None:
        _ERC8004 = _load_yaml("erc8004/erc8004.yaml")


def get_x402_enabled() -> bool:
    """Whether x402 payments are enabled. Source: infra/registries/x402/settings.yaml.
    Env override: set X402_ENABLED=true|false to override the registry (ops only)."""
    override = os.environ.get("X402_ENABLED")
    if override is not None and str(override).strip() != "":
        return str(override).strip().lower() in ("1", "true", "yes")
    _ensure_loaded()
    spec = (_X402_SETTINGS or {}).get("spec", {})
    for item in spec.get("settings") or []:
        if item.get("id") == "x402-enabled":
            val = item.get("value")
            if isinstance(val, bool):
                return val
            if isinstance(val, str):
                return val.lower() in ("1", "true", "yes")
            return bool(val)
    return False


def _get_setting_bool(setting_id: str) -> bool:
    """Read a boolean setting from x402/settings.yaml spec.settings."""
    _ensure_loaded()
    for item in (_X402_SETTINGS or {}).get("spec", {}).get("settings") or []:
        if item.get("id") == setting_id:
            val = item.get("value")
            if isinstance(val, bool):
                return val
            if isinstance(val, str):
                return val.lower() in ("1", "true", "yes")
            return bool(val)
    return False


def get_monitoring_enabled() -> bool:
    """Whether monitoring feature is enabled. Source: x402/settings.yaml (monitoring-enabled)."""
    return _get_setting_bool("monitoring-enabled")


def get_default_pipeline_id() -> str:
    """Default pipeline id. Source: pipelines.yaml metadata.defaultPipelineId."""
    _ensure_loaded()
    meta = (_PIPELINES or {}).get("metadata", {})
    return meta.get("defaultPipelineId") or DEFAULT_PIPELINE_ID


def get_roma_complexity_threshold() -> int:
    """ROMA trigger threshold. Source: roma.yaml spec.complexityThreshold."""
    _ensure_loaded()
    spec = (_ROMA or {}).get("spec", {})
    return int(spec.get("complexityThreshold", 7))


def get_roma_complexity_indicators() -> list[str]:
    """Words that contribute to complexity score. Source: roma.yaml spec.complexityIndicators."""
    _ensure_loaded()
    spec = (_ROMA or {}).get("spec", {})
    raw = spec.get("complexityIndicators") or []
    return [str(x).lower() for x in raw if x]


def get_timeout(agent: str) -> float:
    """HTTP timeout in seconds for an agent or client. Source: orchestrator.yaml spec.timeouts."""
    _ensure_loaded()
    timeouts = (_ORCHESTRATOR or {}).get("spec", {}).get("timeouts") or {}
    return float(timeouts.get(agent, timeouts.get("default", 60.0)))


def get_da_backend() -> str:
    """DA backend for traces. Always none (stub mode)."""
    return "none"


def get_memory_backend() -> str:
    """Memory backend for context: acontext | supabase | memory. Source: orchestrator.yaml spec.backends.memory_backend. Env MEMORY_BACKEND overrides."""
    override = os.environ.get("MEMORY_BACKEND", "").strip().lower()
    if override in ("acontext", "supabase", "memory"):
        return override
    _ensure_loaded()
    backends = (_ORCHESTRATOR or {}).get("spec", {}).get("backends") or {}
    out = (backends.get("memory_backend") or "supabase").lower()
    return out if out in ("acontext", "supabase", "memory") else "supabase"


def get_mainnet_chain_ids() -> tuple[int, ...]:
    """Chain IDs considered mainnet (category != testnet). Source: network/chains.yaml.
    Env override: MAINNET_CHAIN_IDS comma-separated overrides registry."""
    raw = os.environ.get("MAINNET_CHAIN_IDS", "").strip()
    if raw:
        return tuple(int(x.strip()) for x in raw.split(",") if x.strip())
    out = []
    for c in list_chains(enabled_only=True):
        ha = c.get("hyperagent") or {}
        if (ha.get("category") or "mainnet").lower() != "testnet":
            out.append(c.get("id"))
    return tuple(x for x in out if isinstance(x, int))


def get_pipeline(pipeline_id: str | None = None) -> dict[str, Any] | None:
    """Return pipeline spec by id (stages, defaultModels, gates)."""
    _ensure_loaded()
    pid = pipeline_id or get_default_pipeline_id()
    root = _PIPELINES or {}
    spec = root.get("spec", {})
    for p in spec.get("pipelines", []):
        if p.get("id") == pid:
            return p
    return None


def get_pipeline_gates(pipeline_id: str | None = None) -> list[dict[str, Any]]:
    """Return gates for pipeline (audit maxSeverity, simulation requireSuccess, etc.)."""
    p = get_pipeline(pipeline_id)
    if not p:
        return []
    return p.get("gates") or []


def get_audit_max_severity(pipeline_id: str | None = None) -> str:
    """Max severity allowed to pass audit gate (e.g. high, medium)."""
    for g in get_pipeline_gates(pipeline_id):
        if g.get("type") == "audit" and "maxSeverity" in g:
            return g["maxSeverity"]
    return "high"


def get_slither_to_swc(category: str) -> str | None:
    """Map Slither detector category to SWC ID. Source: security.yaml spec.slitherToSwc."""
    _ensure_loaded()
    spec = (_SECURITY or {}).get("spec", {})
    mapping = spec.get("slitherToSwc") or {}
    return mapping.get(category) if isinstance(mapping, dict) else None


def get_high_severity_swc() -> list[str]:
    """SWC IDs that block deploy when matched. Source: security.yaml spec.highSeveritySwc."""
    _ensure_loaded()
    spec = (_SECURITY or {}).get("spec", {})
    swcs = spec.get("highSeveritySwc") or []
    return [str(x) for x in swcs if x]


def get_chain(chain_id: int) -> dict[str, Any] | None:
    """Return chain entry by numeric chain id (chainlist + hyperagent)."""
    _ensure_loaded()
    spec = (_CHAINS or {}).get("spec", {})
    for c in spec.get("chains", []):
        if c.get("id") == chain_id:
            return c
    return None


def get_chain_rpc_explorer(chain_id: int) -> tuple[str, str] | None:
    """Return (rpc_url, explorer_url) for chain_id from registry. Single source of truth; no env/fallback."""
    c = get_chain(chain_id)
    if not c:
        return None
    cl = c.get("chainlist") or {}
    rpc_urls = cl.get("rpcUrls") or []
    explorer_urls = cl.get("blockExplorerUrls") or []
    rpc = (rpc_urls[0] or "").strip() if rpc_urls else ""
    explorer = (explorer_urls[0] or "").strip() if explorer_urls else ""
    if not rpc:
        return None
    if not explorer:
        explorer = ""
    return (rpc, explorer)


def _normalize_slug(s: str) -> str:
    """Strip dashes, underscores, spaces for fuzzy slug matching."""
    return s.strip().lower().replace("-", "").replace("_", "").replace(" ", "")


def get_chain_id_by_network_slug(network_slug: str) -> int | None:
    """Resolve network slug (e.g. skale-base-sepolia or skalebase-sepolia) to chain_id from registry."""
    if not (network_slug and isinstance(network_slug, str)):
        return None
    slug = network_slug.strip().lower()
    norm = _normalize_slug(slug)
    for c in list_chains(enabled_only=False):
        cid = c.get("id")
        ha = c.get("hyperagent") or {}
        s = (ha.get("slug") or "").strip().lower()
        if isinstance(cid, int) and s:
            if s == slug or _normalize_slug(s) == norm:
                return cid
        cl = c.get("chainlist") or {}
        name = (cl.get("name") or "").strip().lower().replace(" ", "-")
        if isinstance(cid, int) and name:
            if name == slug or _normalize_slug(name) == norm:
                return cid
    return None


def list_chains(enabled_only: bool = True) -> list[dict[str, Any]]:
    """List chains from registry; optionally only enabled."""
    _ensure_loaded()
    spec = (_CHAINS or {}).get("spec", {})
    out = []
    for c in spec.get("chains", []):
        if enabled_only and not c.get("enabled", True):
            continue
        out.append(c)
    return out


def get_registry_versions() -> dict[str, str]:
    """Return metadata versions for run reproducibility (pipelines_version, etc.)."""
    _ensure_loaded()
    versions = {}
    if _PIPELINES:
        meta = (_PIPELINES or {}).get("metadata", {})
        versions["pipelines_version"] = meta.get("version", "unknown")
    if _CHAINS:
        meta = (_CHAINS or {}).get("metadata", {})
        versions["chains_version"] = meta.get("version", "unknown")
    if _ERC8004:
        meta = (_ERC8004 or {}).get("metadata", {})
        versions["erc8004_version"] = meta.get("version", "unknown")
    return versions


def get_template(template_id: str) -> dict[str, Any] | None:
    """Return template by id from token registry (source, wizard, riskProfile, etc.)."""
    _ensure_loaded()
    spec = (_TOKENS or {}).get("spec", {})
    for t in spec.get("templates", []):
        if t.get("id") == template_id:
            return t
    return None


def list_templates() -> list[dict[str, Any]]:
    """List all templates from token registry."""
    _ensure_loaded()
    spec = (_TOKENS or {}).get("spec", {})
    return list(spec.get("templates", []))


def get_templates_for_api() -> list[dict[str, Any]]:
    """Templates as API shape: id, name, description, source, codegen_mode, riskProfile."""
    out = []
    for t in list_templates():
        source = t.get("source") or "custom"
        wizard = t.get("wizard") or {}
        codegen_mode = "oz_wizard" if source == "openzeppelin-wizard" else "custom"
        out.append({
            "id": t.get("id"),
            "name": t.get("name"),
            "description": _template_description(t),
            "source": source,
            "codegen_mode": codegen_mode,
            "risk_profile": t.get("riskProfile", "medium"),
            "requires_human_approval": t.get("requiresHumanApproval", False),
            "wizard_kind": wizard.get("kind"),
            "wizard_options": wizard.get("options"),
        })
    return out


def _template_description(t: dict[str, Any]) -> str:
    """One-line description from standards/features."""
    standards = t.get("standards") or []
    features = t.get("features") or []
    parts = list(standards) + list(features)
    return ", ".join(parts) if parts else (t.get("name") or t.get("id", ""))


def get_x402_resources() -> list[dict[str, Any]]:
    """x402 billable resources: id, name, unit, description. Source: x402/x402-products.yaml."""
    _ensure_loaded()
    spec = (_X402_PRODUCTS or {}).get("spec", {})
    return list(spec.get("resources", []))


def get_x402_plans() -> list[dict[str, Any]]:
    """x402 subscription plans: id, name, limits, enabledPipelines, features. Source: x402/x402-products.yaml."""
    _ensure_loaded()
    spec = (_X402_PRODUCTS or {}).get("spec", {})
    return list(spec.get("plans", []))


def get_x402_plan(plan_id: str) -> dict[str, Any] | None:
    """Return single plan by id."""
    for p in get_x402_plans():
        if p.get("id") == plan_id:
            return p
    return None


def get_stablecoins_by_chain() -> dict[str, dict[str, str]]:
    """Return { chainId: { USDC: addr, USDT: addr } } from x402/stablecoins.yaml."""
    _ensure_loaded()
    spec = (_STABLECOINS or {}).get("spec", {})
    out: dict[str, dict[str, str]] = {}
    for token in spec.get("tokens", []):
        symbol = (token.get("symbol") or "").upper()
        if not symbol:
            continue
        for by_chain in token.get("byChain", []):
            cid = str(by_chain.get("chainId", ""))
            addr = (by_chain.get("address") or "").strip()
            if cid and addr:
                if cid not in out:
                    out[cid] = {}
                out[cid][symbol] = addr
    return out


def get_resource_price(resource_id: str) -> float:
    """Unit price for a resource (credits). Phase 1: flat pricing per resource type."""
    prices = {
        "pipeline.run": 0.15,
        "tenderly.sim": 0.05,
        "audit.full": 0.10,
        "codegen.quick": 0.02,
    }
    return prices.get(resource_id, 0.15)


def check_plan_limit(plan_id: str, resource_id: str, current_usage: int) -> bool:
    """Check if usage is within plan limits. Returns True if within limit or no limit set."""
    plan = get_x402_plan(plan_id)
    if not plan:
        return True
    limits = plan.get("limits") or {}
    limit = limits.get(resource_id)
    if limit is None or limit == {}:
        return True
    return current_usage < int(limit)


ANCHOR_NETWORK_SLUG = "skalebase-sepolia"
FALLBACK_CHAIN_ID = 324705682


# --- ERC-8004 (Trustless Agents) ---


def _get_erc8004_hyperagent() -> dict[str, Any]:
    """Return hyperagent spec from erc8004.yaml."""
    _ensure_loaded()
    spec = (_ERC8004 or {}).get("spec", {})
    return spec.get("hyperagent") or {}


def _get_erc8004_chain(chain_id: int) -> dict[str, Any] | None:
    """Return chain entry from erc8004 spec.chains by chainId."""
    _ensure_loaded()
    for c in (_ERC8004 or {}).get("spec", {}).get("chains") or []:
        if c.get("chainId") == chain_id:
            return c
    return None


def get_erc8004_agent_id(chain_id: int) -> str | None:
    """Return HyperAgent agentId for chain_id from erc8004.yaml. Env A2A_AGENT_ID overrides when chain matches A2A_DEFAULT_CHAIN_ID."""
    override_id = os.environ.get("A2A_AGENT_ID", "").strip()
    override_chain = os.environ.get("A2A_DEFAULT_CHAIN_ID", "").strip()
    if override_id and override_chain and str(chain_id) == override_chain:
        return override_id
    ha = _get_erc8004_hyperagent()
    for entry in ha.get("agentIds") or []:
        if entry.get("chainId") == chain_id:
            return str(entry.get("agentId", ""))
    return None


def get_erc8004_agent_registry(chain_id: int) -> str | None:
    """Return agentRegistry string (eip155:chainId:identityRegistry) for chain_id."""
    c = _get_erc8004_chain(chain_id)
    return (c.get("agentRegistry") or "").strip() or None


def get_erc8004_payment_wallet() -> str | None:
    """Return payment wallet from erc8004 hyperagent. Matches MERCHANT_WALLET_ADDRESS."""
    ha = _get_erc8004_hyperagent()
    return (ha.get("paymentWallet") or "").strip() or None


def get_a2a_default_chain_id() -> int | None:
    """Return default chain for A2A. Env A2A_DEFAULT_CHAIN_ID overrides; else anchor chain from registry."""
    raw = os.environ.get("A2A_DEFAULT_CHAIN_ID", "").strip()
    if raw:
        try:
            return int(raw)
        except ValueError:
            pass
    return get_default_chain_id()


def get_a2a_agent_id() -> str | None:
    """Return agentId for A2A. Env A2A_AGENT_ID overrides; else from erc8004 for default chain."""
    raw = os.environ.get("A2A_AGENT_ID", "").strip()
    if raw:
        return raw
    chain_id = get_a2a_default_chain_id()
    if chain_id is not None:
        return get_erc8004_agent_id(chain_id)
    return None


def get_erc8004_agent_identity(chain_id: int | None = None) -> dict[str, Any] | None:
    """Return agent identity for traces: agentId, agentRegistry, chainId."""
    cid = chain_id if chain_id is not None else get_a2a_default_chain_id()
    if cid is None:
        return None
    agent_id = get_erc8004_agent_id(cid)
    agent_registry = get_erc8004_agent_registry(cid)
    if not agent_id or not agent_registry:
        return None
    return {
        "agentId": agent_id,
        "agentRegistry": agent_registry,
        "chainId": cid,
    }


def get_default_chain_id() -> int:
    """Return chain_id for anchor network from registry."""
    cid = get_chain_id_by_network_slug(ANCHOR_NETWORK_SLUG)
    return cid if cid is not None else FALLBACK_CHAIN_ID


def get_networks_for_api(skale: bool = False) -> list[dict[str, Any]]:
    """Return chains as API network list: network_id, name, chain_id, currency, tier, category, is_mainnet.
    Anchor testnet first among testnets so Studio default is live.
    When skale=True, return SKALE Base networks (slug starting with skalebase-)."""
    out = []
    for c in list_chains(enabled_only=True):
        chain_id = c.get("id")
        cl = c.get("chainlist") or {}
        ha = c.get("hyperagent") or {}
        name = cl.get("name") or ha.get("slug") or str(chain_id)
        slug = ha.get("slug") or (name.lower().replace(" ", "-") if name else str(chain_id))
        if skale and not (slug and slug.startswith("skalebase-")):
            continue
        currency = (cl.get("nativeCurrency") or {}).get("symbol") or "ETH"
        tier = ha.get("tier") or "supported"
        category = ha.get("category") or "mainnet"
        is_mainnet = category != "testnet"
        out.append({
            "network": slug,
            "network_id": slug,
            "name": name,
            "chain_id": chain_id,
            "currency": currency,
            "tier": tier,
            "category": category,
            "is_mainnet": is_mainnet,
        })
    def order_key(item: dict[str, Any]) -> tuple[int, str]:
        slug = (item.get("network_id") or "").strip()
        is_mainnet = item.get("is_mainnet", True)
        if slug == ANCHOR_NETWORK_SLUG:
            return (0, slug)
        if not is_mainnet:
            return (1, slug)
        return (2, slug)
    out.sort(key=order_key)
    return out
