"""
UI export API: _build_viem_wagmi_zip, export_ui_app_api.
Exports dApp as zip with React/Next.js scaffold.
"""

import base64
import os
import io
import json
import logging
import zipfile
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from registries import (
    get_chain,
    get_chain_rpc_explorer,
    get_default_chain_id,
    get_timeout,
)
from store import get_workflow
from trace_context import get_trace_headers

from ipfs_client import canonical_ipfs_gateway_url

from .common import _sanitize_ident, _sanitize_label, _sanitize_name

logger = logging.getLogger(__name__)

COMPILE_SERVICE_URL = os.environ.get(
    "COMPILE_SERVICE_URL", "http://localhost:8004"
).rstrip("/")


def _extract_erc20_constructor_args(w: dict[str, Any]) -> list[Any]:
    """Extract constructor args (name, symbol, initialSupply) from wizard_options or spec for ERC20."""
    opts = (w.get("oz_wizard_options") or {}).copy()
    spec_wo = (w.get("spec") or {}).get("wizard_options")
    if isinstance(spec_wo, dict):
        opts.update(spec_wo)
    name = opts.get("name") or "MyToken"
    symbol = opts.get("symbol") or "MTK"
    premint = opts.get("premint") or opts.get("initialSupply")
    if premint is not None and str(premint).strip() != "":
        try:
            supply = int(str(premint).replace(",", ""))
            if supply > 0:
                return [str(name), str(symbol), supply]
        except (ValueError, TypeError):
            pass
    return [str(name), str(symbol)]


def _build_viem_wagmi_zip(
    zf: zipfile.ZipFile,
    schema: dict[str, Any],
    app_name: str,
    chain_id: int,
    contract_addr: str,
    abi: list,
    read_actions: list,
    write_actions: list,
    rpc_url: str,
    explorer_url: str,
    chain_name: str,
) -> list[str]:
    """Add viem + wagmi Next.js scaffold to zip. Returns list of file paths written."""
    files_written: list[str] = []
    abi_json = json.dumps(abi)
    rpc_url_escaped = rpc_url.replace('"', '\\"')
    explorer_url_escaped = explorer_url.rstrip("/").replace('"', '\\"')
    chain_name_escaped = chain_name.replace('"', '\\"')

    deps = {
        "next": "14.2.0",
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "viem": "^2.21.0",
        "wagmi": "^2.12.0",
        "@tanstack/react-query": "^5.59.0",
        "@wagmi/core": "^2.12.0",
        "tailwindcss": "^3.4.0",
    }
    zf.writestr(
        "package.json",
        json.dumps(
            {
                "name": app_name,
                "version": "0.1.0",
                "private": True,
                "scripts": {
                    "dev": "next dev",
                    "build": "next build",
                    "start": "next start",
                },
                "dependencies": deps,
                "devDependencies": {
                    "typescript": "^5.0.0",
                    "@types/react": "^18.2.0",
                    "@types/node": "^20.0.0",
                },
            },
            indent=2,
        ),
    )
    files_written.append("package.json")

    zf.writestr(
        "tsconfig.json",
        json.dumps(
            {
                "compilerOptions": {
                    "target": "es2017",
                    "lib": ["dom", "es2017"],
                    "jsx": "preserve",
                    "module": "esnext",
                    "moduleResolution": "bundler",
                    "strict": True,
                    "esModuleInterop": True,
                    "skipLibCheck": True,
                    "forceConsistentCasingInFileNames": True,
                    "resolveJsonModule": True,
                    "isolatedModules": True,
                    "noEmit": True,
                    "incremental": True,
                    "paths": {"@/*": ["./src/*"]},
                },
                "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
                "exclude": ["node_modules"],
            },
            indent=2,
        ),
    )
    files_written.append("tsconfig.json")

    zf.writestr(
        "tailwind.config.ts",
        'import type { Config } from "tailwindcss";\nconst config: Config = { content: ["./src/**/*.{ts,tsx}"], theme: { extend: {} }, plugins: [] };\nexport default config;\n',
    )
    zf.writestr(
        "next.config.mjs",
        '/** @type {import("next").NextConfig} */\nconst nextConfig = {};\nexport default nextConfig;\n',
    )
    files_written.extend(["tailwind.config.ts", "next.config.mjs"])

    contracts_list = schema.get("contracts") or []
    if not contracts_list:
        contracts_list = [{"address": contract_addr, "name": "Contract"}]
    contracts_json = json.dumps(
        [
            {"address": c.get("address", ""), "name": c.get("name", "Contract")}
            for c in contracts_list
        ]
    )
    zf.writestr(
        "src/lib/contract.ts",
        f"""export const CONTRACTS = {contracts_json} as const;
export const CONTRACT_ADDRESS = "{contract_addr}" as const;
export const CHAIN_ID = {chain_id};
export const RPC_URL = "{rpc_url_escaped}";
export const EXPLORER_URL = "{explorer_url_escaped}";
export const ABI = {abi_json} as const;
""",
    )
    files_written.append("src/lib/contract.ts")

    zf.writestr(
        "src/lib/wagmi.ts",
        f"""import {{ http, createConfig }} from "wagmi";
import {{ injected }} from "wagmi/connectors";
import {{ CHAIN_ID, RPC_URL }} from "./contract";

export const config = createConfig({{
  chains: [{{
    id: CHAIN_ID,
    name: "{chain_name_escaped}",
    nativeCurrency: {{ decimals: 18, name: "ETH", symbol: "ETH" }},
    rpcUrls: {{ default: {{ http: [RPC_URL] }} }},
    blockExplorers: {{ default: {{ url: "{explorer_url_escaped}" }} }},
  }}],
  connectors: [injected()],
  transports: {{ [CHAIN_ID]: http(RPC_URL) }},
}});
""",
    )
    files_written.append("src/lib/wagmi.ts")

    read_cards = []
    for a in read_actions[:6]:
        if a["fn"] == "balanceOf":
            read_cards.append(
                '<div className="p-4 bg-zinc-800/80 rounded-lg border border-zinc-700">'
                '<span className="text-zinc-400 text-sm">'
                + (a.get("label", a["fn"]) or "balanceOf")
                + "</span>"
                '<div className="text-white font-mono mt-1">{balanceOfResult?.data !== undefined ? formatUnits(balanceOfResult.data as bigint, decimalsResult?.data ?? 18) : "-"}</div>'
                "</div>"
            )
        elif a["fn"] == "totalSupply":
            read_cards.append(
                '<div className="p-4 bg-zinc-800/80 rounded-lg border border-zinc-700">'
                '<span className="text-zinc-400 text-sm">'
                + (a.get("label", a["fn"]) or "totalSupply")
                + "</span>"
                '<div className="text-white font-mono mt-1">{totalSupplyResult?.data !== undefined ? formatUnits(totalSupplyResult.data as bigint, decimalsResult?.data ?? 18) : "-"}</div>'
                "</div>"
            )
        elif a["fn"] in ("name", "symbol", "decimals"):
            v = a["fn"] + "Result"
            read_cards.append(
                f'<div className="p-4 bg-zinc-800/80 rounded-lg border border-zinc-700">'
                f'<span className="text-zinc-400 text-sm">{a.get("label", a["fn"])}</span>'
                f'<div className="text-white font-mono mt-1">{{{v}?.data ?? "-"}}</div>'
                f"</div>"
            )

    write_forms = []
    for a in write_actions[:6]:
        if a["fn"] == "mint":
            write_forms.append(
                '<div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 space-y-2">'
                '<h3 className="text-sm font-medium text-zinc-300">'
                + (a.get("label", a["fn"]) or "mint")
                + "</h3>"
                '<input placeholder="Recipient address" value={mintTo} onChange={e => setMintTo(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-sm text-white" />'
                '<input placeholder="Amount" value={mintAmount} onChange={e => setMintAmount(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-sm text-white" />'
                '<button onClick={() => writeMint()} disabled={isMintPending} className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-sm">{isMintPending ? "Pending..." : "Mint"}</button>'
                '{mintTxHash && <a href={`${EXPLORER_URL}/tx/${mintTxHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 block mt-1">View tx</a>}'
                "</div>"
            )
        elif a["fn"] == "burn":
            write_forms.append(
                '<div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 space-y-2">'
                '<h3 className="text-sm font-medium text-zinc-300">'
                + (a.get("label", a["fn"]) or "burn")
                + "</h3>"
                '<input placeholder="Amount" value={burnAmount} onChange={e => setBurnAmount(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-sm text-white" />'
                '<button onClick={() => writeBurn()} disabled={isBurnPending} className="px-4 py-2 rounded bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 text-sm">{isBurnPending ? "Pending..." : "Burn"}</button>'
                '{burnTxHash && <a href={`${EXPLORER_URL}/tx/${burnTxHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 block mt-1">View tx</a>}'
                "</div>"
            )
        elif a["fn"] == "transfer":
            write_forms.append(
                '<div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 space-y-2">'
                '<h3 className="text-sm font-medium text-zinc-300">'
                + (a.get("label", a["fn"]) or "transfer")
                + "</h3>"
                '<input placeholder="To address" value={transferTo} onChange={e => setTransferTo(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-sm text-white" />'
                '<input placeholder="Amount" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-sm text-white" />'
                '<button onClick={() => writeTransfer()} disabled={isTransferPending} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-sm">{isTransferPending ? "Pending..." : "Transfer"}</button>'
                '{transferTxHash && <a href={`${EXPLORER_URL}/tx/${transferTxHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 block mt-1">View tx</a>}'
                "</div>"
            )

    read_cards_str = (
        "\n".join(read_cards)
        if read_cards
        else '<p className="text-zinc-500 text-sm">No read actions.</p>'
    )
    write_forms_str = (
        "\n".join(write_forms)
        if write_forms
        else '<p className="text-zinc-500 text-sm">No write actions in ABI.</p>'
    )
    schema_name = json.dumps(schema.get("name", "dApp"))

    page_content = f""""use client";

import {{ useState }} from "react";
import {{ WagmiProvider, useAccount, useConnect, useReadContract, useWriteContract }} from "wagmi";
import {{ QueryClient, QueryClientProvider }} from "@tanstack/react-query";
import {{ formatUnits }} from "viem";
import {{ config }} from "@/lib/wagmi";
import {{ CONTRACT_ADDRESS, ABI, EXPLORER_URL, CONTRACTS }} from "@/lib/contract";

const queryClient = new QueryClient();

function AppContent() {{
  const {{ address, isConnected }} = useAccount();
  const {{ connect, connectors, isPending: isConnectPending }} = useConnect();
  const [mintTo, setMintTo] = useState("");
  const [mintAmount, setMintAmount] = useState("");
  const [burnAmount, setBurnAmount] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);
  const [burnTxHash, setBurnTxHash] = useState<string | null>(null);
  const [transferTxHash, setTransferTxHash] = useState<string | null>(null);

  const {{ data: balanceOfResult }} = useReadContract({{ address: CONTRACT_ADDRESS, abi: ABI, functionName: "balanceOf", args: address ? [address] : undefined }});
  const {{ data: totalSupplyResult }} = useReadContract({{ address: CONTRACT_ADDRESS, abi: ABI, functionName: "totalSupply" }});
  const {{ data: decimalsResult }} = useReadContract({{ address: CONTRACT_ADDRESS, abi: ABI, functionName: "decimals" }});
  const {{ data: nameResult }} = useReadContract({{ address: CONTRACT_ADDRESS, abi: ABI, functionName: "name" }});
  const {{ data: symbolResult }} = useReadContract({{ address: CONTRACT_ADDRESS, abi: ABI, functionName: "symbol" }});

  const {{ writeContract: writeMintFn, isPending: isMintPending }} = useWriteContract({{ mutation: {{ onSuccess: (data) => setMintTxHash(data) }} }});
  const {{ writeContract: writeBurnFn, isPending: isBurnPending }} = useWriteContract({{ mutation: {{ onSuccess: (data) => setBurnTxHash(data) }} }});
  const {{ writeContract: writeTransferFn, isPending: isTransferPending }} = useWriteContract({{ mutation: {{ onSuccess: (data) => setTransferTxHash(data) }} }});

  const writeMint = () => {{
    if (!mintTo || !mintAmount) return;
    const decimals = Number(decimalsResult ?? 18);
    const amount = BigInt(parseFloat(mintAmount) * 10 ** decimals);
    writeMintFn({{ address: CONTRACT_ADDRESS, abi: ABI, functionName: "mint", args: [mintTo, amount] }});
  }};
  const writeBurn = () => {{
    if (!burnAmount) return;
    const decimals = Number(decimalsResult ?? 18);
    const amount = BigInt(parseFloat(burnAmount) * 10 ** decimals);
    writeBurnFn({{ address: CONTRACT_ADDRESS, abi: ABI, functionName: "burn", args: [amount] }});
  }};
  const writeTransfer = () => {{
    if (!transferTo || !transferAmount) return;
    const decimals = Number(decimalsResult ?? 18);
    const amount = BigInt(parseFloat(transferAmount) * 10 ** decimals);
    writeTransferFn({{ address: CONTRACT_ADDRESS, abi: ABI, functionName: "transfer", args: [transferTo, amount] }});
  }};

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">{{nameResult ?? {schema_name}}}</h1>
        <p className="text-zinc-400 text-sm">Contract: <code className="text-xs">{{CONTRACT_ADDRESS}}</code> on {chain_name}</p>
        {{CONTRACTS.length > 1 ? (
          <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 space-y-2">
            <h2 className="text-sm font-medium text-zinc-300">Contracts</h2>
            {{CONTRACTS.map((c, i) => (
              <div key={{i}} className="flex justify-between items-center text-sm">
                <span className="text-zinc-400">{{c.name}}</span>
                <a href={{`${{EXPLORER_URL}}/address/${{c.address}}`}} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline font-mono text-xs">{{c.address?.slice(0, 10)}}...</a>
              </div>
            ))}}
          </div>
        ) : null}}
        {{!isConnected ? (
          <button onClick={{() => connect({{ connector: connectors[0] }})}} disabled={{isConnectPending}} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {{isConnectPending ? "Connecting..." : "Connect MetaMask"}}
          </button>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{read_cards_str}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{write_forms_str}</div>
          </div>
        )}}
      </div>
    </main>
  );
}}

export default function Home() {{
  return (
    <WagmiProvider config={{config}}>
      <QueryClientProvider client={{queryClient}}>
        <AppContent />
      </QueryClientProvider>
    </WagmiProvider>
  );
}}
"""
    zf.writestr("src/app/page.tsx", page_content)
    files_written.append("src/app/page.tsx")

    layout_title = schema.get("name", "dApp").replace('"', '\\"')
    zf.writestr(
        "src/app/layout.tsx",
        f"""import type {{ Metadata }} from "next";
import "./globals.css";

export const metadata: Metadata = {{ title: "{layout_title}", description: "Generated by HyperAgent" }};

export default function RootLayout({{ children }}: {{ children: React.ReactNode }}) {{
  return <html lang="en"><body>{{children}}</body></html>;
}}
""",
    )
    zf.writestr(
        "src/app/globals.css",
        "@tailwind base;\\n@tailwind components;\\n@tailwind utilities;\\n",
    )
    files_written.extend(["src/app/layout.tsx", "src/app/globals.css"])

    readme = f"""# {schema.get('name', 'dApp')}

Generated by HyperAgent. Full React/Next.js dApp with viem + wagmi.

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy (Vercel)

```bash
npm run build
npx vercel --prod
```

Or connect this folder to Vercel in the dashboard for automatic deploys.

## Contract

- Address: `{contract_addr}`
- Chain: {chain_name} (ID: {chain_id})
- Explorer: {explorer_url}
"""
    zf.writestr("README.md", readme)
    files_written.append("README.md")

    return files_written


class UiAppExportBody(BaseModel):
    template: str = Field(
        default="viem-wagmi", description="viem-wagmi (default) or hyperagent-default"
    )
    include_deploy_scripts: bool = Field(
        default=True,
        description="Include deployment scripts when contract source available",
    )
    deploy_target: str = Field(
        default="zip",
        description="Export target: zip, ipfs, vercel, sandbox, or coolify. sandbox/coolify = self-hosted primary.",
    )


router = APIRouter(prefix="/api/v1/workflows", tags=["ui-export"])


@router.post("/{workflow_id}/ui-apps/export")
async def export_ui_app_api(
    workflow_id: str, body: UiAppExportBody | None = None, request: Request = None
) -> dict[str, Any]:
    """Export dApp as zip: full React/Next.js scaffold with contract integration. Returns zip_base64 and filename."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        from .common import assert_workflow_owner

        assert_workflow_owner(w, request)
    schema = w.get("ui_schema")
    if not schema:
        raise HTTPException(
            status_code=400,
            detail="Generate UI schema first (POST /ui-schema/generate)",
        )
    template = (body.template if body else "viem-wagmi") or "viem-wagmi"
    include_deploy = body.include_deploy_scripts if body else True
    app_name = _sanitize_name(schema.get("name") or "dapp").lower().replace(" ", "-")
    chain_id = schema.get("chainId") or get_default_chain_id()
    contract_addr = schema.get("contractAddress", "")
    abi = schema.get("abi", [])
    raw_actions = schema.get("actions", [])
    for a in raw_actions:
        a["fn"] = _sanitize_ident(a.get("fn", ""), "action")
        a["label"] = _sanitize_label(a.get("label", a["fn"]))
        for p in a.get("params", []):
            p["name"] = _sanitize_ident(p.get("name", ""), "param")
    read_actions = [a for a in raw_actions if a.get("kind") == "read"]
    write_actions = [a for a in raw_actions if a.get("kind") == "write"]

    rpc_explorer = get_chain_rpc_explorer(chain_id)
    if not rpc_explorer and template == "viem-wagmi":
        raise HTTPException(
            status_code=400,
            detail=f"Chain {chain_id} not in registry; add to infra/registries/network/chains.yaml",
        )
    rpc_url = rpc_explorer[0] if rpc_explorer else ""
    explorer_url = rpc_explorer[1] if rpc_explorer else ""
    chain_entry = get_chain(chain_id)
    cl = (chain_entry or {}).get("chainlist") or {}
    chain_name = (
        cl.get("name", f"Chain {chain_id}")
        if isinstance(cl, dict)
        else f"Chain {chain_id}"
    )

    buf = io.BytesIO()
    files_list: list[str] = []
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("ui_schema.json", json.dumps(schema, indent=2))
        files_list.append("ui_schema.json")

        if template == "viem-wagmi":
            files_list = _build_viem_wagmi_zip(
                zf,
                schema,
                app_name,
                chain_id,
                contract_addr,
                abi,
                read_actions,
                write_actions,
                rpc_url,
                explorer_url,
                chain_name,
            )

        test_files = w.get("test_files") or {}
        for name, code in test_files.items():
            if isinstance(code, str) and (
                name.endswith(".sol") or name.endswith(".t.sol")
            ):
                path = name if "/" in name else f"test/{name}"
                zf.writestr(path, code)
                files_list.append(path)

        if include_deploy and w.get("contracts"):
            contracts_dict = w.get("contracts") or {}
            first_name = next(
                (n for n in contracts_dict if isinstance(contracts_dict.get(n), str)),
                None,
            )
            if first_name:
                try:
                    headers = get_trace_headers()
                    with httpx.Client(timeout=get_timeout("main")) as client:
                        r = client.post(
                            f"{COMPILE_SERVICE_URL}/compile",
                            json={
                                "contractCode": contracts_dict[first_name],
                                "framework": "hardhat",
                            },
                            headers=headers,
                        )
                        r.raise_for_status()
                        data = r.json()
                    if data.get("success") and data.get("bytecode"):
                        bytecode = data["bytecode"]
                        explorer_base = explorer_url.rstrip("/").replace("\\", "\\\\")
                        constructor_args = _extract_erc20_constructor_args(w)
                        if len(constructor_args) == 3:
                            args_ts = f"[{json.dumps(constructor_args[0])}, {json.dumps(constructor_args[1])}, BigInt({json.dumps(str(constructor_args[2]))})]"
                        elif len(constructor_args) >= 2:
                            args_ts = f"[{json.dumps(constructor_args[0])}, {json.dumps(constructor_args[1])}]"
                        else:
                            args_ts = "[]"
                        deploy_script = f"""import {{ createWalletClient, http }} from "viem";
import {{ privateKeyToAccount }} from "viem/accounts";
import {{ defineChain }} from "viem";
import {{ CHAIN_ID, RPC_URL }} from "../src/lib/contract";

const chain = defineChain({{ id: CHAIN_ID, name: "Custom", nativeCurrency: {{ decimals: 18, name: "ETH", symbol: "ETH" }}, rpcUrls: {{ default: {{ http: [RPC_URL] }} }} }});
const BYTECODE = "{bytecode}" as `0x${{string}}`;
const ABI = {json.dumps(abi)};
const CONSTRUCTOR_ARGS = {args_ts};

async function main() {{
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {{ console.error("Set PRIVATE_KEY"); process.exit(1); }}
  const account = privateKeyToAccount(pk as `0x${{string}}`);
  const client = createWalletClient({{ account, chain, transport: http(RPC_URL) }});
  const hash = await client.deployContract({{ abi: ABI, bytecode: BYTECODE, account, args: CONSTRUCTOR_ARGS }});
  console.log("Deployed tx:", hash);
  console.log("Explorer:", "{explorer_base}/tx/" + hash);
}}
main().catch(console.error);
"""
                        zf.writestr("scripts/deploy.ts", deploy_script)
                        zf.writestr(
                            "contracts/Contract.sol", contracts_dict[first_name]
                        )
                        zf.writestr(
                            "scripts/chain.config.json",
                            json.dumps(
                                {
                                    "chainId": chain_id,
                                    "rpcUrl": rpc_url,
                                    "explorerUrl": explorer_url,
                                },
                                indent=2,
                            ),
                        )
                        files_list.extend(
                            [
                                "scripts/deploy.ts",
                                "contracts/Contract.sol",
                                "scripts/chain.config.json",
                            ]
                        )
                except Exception as e:
                    logger.warning("[export] deploy script skipped: %s", e)

    buf.seek(0)
    zip_bytes = buf.getvalue()
    zip_b64 = base64.b64encode(zip_bytes).decode("ascii")
    filename = f"{app_name}-{workflow_id[:8]}.zip"
    deploy_target = (body.deploy_target if body else "zip") or "zip"
    ipfs_cid = None
    ipfs_gateway_url = None
    vercel_url = None
    vercel_deployment_id = None
    sandbox_url = None
    sandbox_deployment_id = None
    coolify_url = None
    coolify_deployment_id = None

    if deploy_target in ("sandbox", "coolify"):
        base_url = (
            os.environ.get("SANDBOX_DEPLOY_URL")
            or os.environ.get("COOLIFY_DEPLOY_URL")
            or ""
        ).rstrip("/")
        token = (
            os.environ.get("SANDBOX_DEPLOY_TOKEN")
            or os.environ.get("COOLIFY_TOKEN")
            or ""
        ).strip()
        if not base_url or not token:
            raise HTTPException(
                status_code=503,
                detail="SANDBOX_DEPLOY_URL and SANDBOX_DEPLOY_TOKEN (or COOLIFY_*) required for deploy_target=sandbox/coolify.",
            )
        project_name = f"{app_name}-{workflow_id[:8]}"
        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                files = {"file": (filename, zip_bytes, "application/zip")}
                data = {"project_name": project_name, "workflow_id": workflow_id}
                deploy_endpoint = (
                    base_url
                    if base_url.rstrip("/").endswith("deploy")
                    else f"{base_url.rstrip('/')}/deploy"
                )
                r = await client.post(
                    deploy_endpoint,
                    headers={"Authorization": f"Bearer {token}"},
                    files=files,
                    data=data,
                )
                r.raise_for_status()
                data = r.json()
                sandbox_url = data.get("url") or data.get("deployment_url")
                sandbox_deployment_id = data.get("deployment_id") or data.get(
                    "deployment_uuid"
                )
                if deploy_target == "coolify":
                    coolify_url = sandbox_url
                    coolify_deployment_id = sandbox_deployment_id
        except httpx.HTTPStatusError as e:
            logger.warning(
                "[export] sandbox/coolify deploy HTTP error: %s %s",
                e.response.status_code,
                e.response.text[:500],
            )
            raise HTTPException(
                status_code=502,
                detail=f"Sandbox deployment failed: {e.response.text[:200]}",
            )
        except Exception as e:
            logger.warning("[export] sandbox deploy error: %s", e)
            raise HTTPException(
                status_code=502, detail=f"Sandbox deployment failed: {str(e)[:200]}"
            )

    if deploy_target == "vercel":
        token = (os.environ.get("VERCEL_TOKEN") or "").strip()
        if not token:
            raise HTTPException(
                status_code=503,
                detail="VERCEL_TOKEN required for deploy_target=vercel. Set in orchestrator env.",
            )
        vercel_files: list[dict[str, str]] = []
        with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
            for name in zf.namelist():
                if name.endswith("/"):
                    continue
                raw = zf.read(name)
                try:
                    content = raw.decode("utf-8")
                    vercel_files.append(
                        {"file": name, "data": content, "encoding": "utf-8"}
                    )
                except UnicodeDecodeError:
                    vercel_files.append(
                        {
                            "file": name,
                            "data": base64.b64encode(raw).decode("ascii"),
                            "encoding": "base64",
                        }
                    )
        if not vercel_files:
            raise HTTPException(
                status_code=500, detail="No files in export for Vercel deployment"
            )
        project_name = f"{app_name}-{workflow_id[:8]}"
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                r = await client.post(
                    "https://api.vercel.com/v13/deployments",
                    headers={"Authorization": f"Bearer {token}"},
                    json={
                        "name": project_name,
                        "files": vercel_files,
                        "projectSettings": {
                            "framework": "nextjs",
                            "buildCommand": "npm run build",
                            "installCommand": "npm install",
                        },
                        "target": "production",
                    },
                )
                r.raise_for_status()
                data = r.json()
                vercel_url = data.get("url") or (
                    data.get("alias", [None])[0] if data.get("alias") else None
                )
                vercel_deployment_id = data.get("id")
                if vercel_url and not vercel_url.startswith("http"):
                    vercel_url = f"https://{vercel_url}"
        except httpx.HTTPStatusError as e:
            logger.warning(
                "[export] Vercel deploy HTTP error: %s %s",
                e.response.status_code,
                e.response.text[:500],
            )
            raise HTTPException(
                status_code=502,
                detail=f"Vercel deployment failed: {e.response.text[:200]}",
            )
        except Exception as e:
            logger.warning("[export] Vercel deploy error: %s", e)
            raise HTTPException(
                status_code=502, detail=f"Vercel deployment failed: {str(e)[:200]}"
            )

    if deploy_target == "ipfs":
        try:
            import ipfs_client

            if ipfs_client.is_configured():
                content_b64 = base64.b64encode(zip_bytes).decode("ascii")
                cid = await ipfs_client.pin_json(
                    content_b64,
                    f"{app_name}-{workflow_id[:8]}.zip.b64",
                    {"workflow_id": workflow_id},
                )
                if cid:
                    ipfs_cid = cid
                    chain_entry = get_chain(chain_id)
                    gw = (
                        (chain_entry or {}).get("ipfs_gateway") if chain_entry else None
                    )
                    if gw:
                        ipfs_gateway_url = f"{gw.rstrip('/')}/ipfs/{cid}"
                    else:
                        ipfs_gateway_url = canonical_ipfs_gateway_url(cid)
        except Exception as e:
            logger.warning("[export] IPFS pin failed: %s", e)
    out = {
        "workflow_id": workflow_id,
        "ui_schema": schema,
        "template": template,
        "zip_base64": zip_b64,
        "filename": filename,
        "files": files_list,
        "message": (
            "React/Next.js scaffold exported as a downloadable zip only "
            "(run npm install && npm run dev locally). This export does not by itself "
            "persist to decentralized storage unless you use deploy_target=ipfs."
        ),
    }
    if ipfs_cid:
        out["ipfs_cid"] = ipfs_cid
        out["ipfs_gateway_url"] = ipfs_gateway_url
        out["message"] = (
            f"Bundle content-addressed on IPFS (pinning provider; not Filecoin archival proof): {ipfs_gateway_url}"
        )
    if vercel_url:
        out["vercel_url"] = vercel_url
        out["vercel_deployment_id"] = vercel_deployment_id
        out["message"] = f"Deployed to Vercel: {vercel_url}"
    if sandbox_url:
        out["deploy_target"] = deploy_target
        out["deployment_url"] = sandbox_url
        out["deployment_id"] = sandbox_deployment_id
        out["message"] = f"Deployed to {deploy_target}: {sandbox_url}"
    return out
