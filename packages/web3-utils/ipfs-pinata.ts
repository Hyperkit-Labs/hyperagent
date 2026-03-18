/**
 * IpfsPinataToolkit: Pinata IPFS pin/unpin.
 * Use your dedicated gateway domain (e.g. example-gateway.mypinata.cloud) instead of shared gateway.pinata.cloud.
 * See docs.pinata.cloud/gateways for dedicated gateway setup.
 */
import type { PinResult } from "@hyperagent/core-types";

export interface IpfsPinataToolkitOptions {
  jwt: string;
  baseUrl?: string;
  /** Dedicated gateway domain (e.g. example-gateway.mypinata.cloud). No protocol or path. */
  gatewayDomain?: string;
  /** Legacy: full base URL (e.g. https://example-gateway.mypinata.cloud/ipfs). Overrides gatewayDomain when set. */
  gatewayBase?: string;
}

function isValidCid(cid: string): boolean {
  if (!cid || typeof cid !== "string") return false;
  const trimmed = cid.trim();
  if (trimmed.length < 10 || trimmed.length > 200) return false;
  return /^[A-Za-z0-9_-]+$/.test(trimmed);
}

function buildGatewayUrl(cid: string, opts: IpfsPinataToolkitOptions): string {
  if (opts.gatewayBase) {
    const base = opts.gatewayBase.replace(/\/$/, "");
    return `${base}/${cid}`;
  }
  const domain = opts.gatewayDomain || "gateway.pinata.cloud";
  return `https://${domain}/ipfs/${cid}`;
}

export class IpfsPinataToolkit {
  constructor(
    private readonly jwt: string,
    private readonly options: Partial<IpfsPinataToolkitOptions> = {}
  ) {}

  private get baseUrl(): string {
    return this.options.baseUrl || "https://api.pinata.cloud";
  }

  async pin(content: string, name: string): Promise<PinResult> {
    const response = await fetch(`${this.baseUrl}/pinning/pinJSONToIPFS`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.jwt}`,
      },
      body: JSON.stringify({
        pinataContent: { name, content },
        pinataMetadata: { name },
      }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pinata API error: ${error}`);
    }
    const data = (await response.json()) as { IpfsHash: string };
    const cid = data.IpfsHash;
    const opts: IpfsPinataToolkitOptions = {
      jwt: this.jwt,
      gatewayDomain: this.options.gatewayDomain,
      gatewayBase: this.options.gatewayBase,
    };
    return {
      cid,
      gatewayUrl: buildGatewayUrl(cid, opts),
    };
  }

  async unpin(cid: string): Promise<void> {
    if (!isValidCid(cid)) throw new Error("Invalid CID");
    const safeCid = encodeURIComponent(cid);
    const response = await fetch(`${this.baseUrl}/pinning/unpin/${safeCid}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.jwt}` },
    });
    if (!response.ok) throw new Error("Failed to unpin");
  }
}
