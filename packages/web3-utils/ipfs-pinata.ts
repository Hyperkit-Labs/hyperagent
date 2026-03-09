/**
 * IpfsPinataToolkit: wraps Pinata API for pin/unpin. Use from storage service or agent-runtime.
 * Keys and API URL are passed in; no raw vendor SDK in callers.
 */
import type { PinResult } from "@hyperagent/core-types";

export interface IpfsPinataToolkitOptions {
  jwt: string;
  baseUrl?: string;
  gatewayBase?: string;
}

export class IpfsPinataToolkit {
  constructor(
    private readonly jwt: string,
    private readonly baseUrl = "https://api.pinata.cloud",
    private readonly gatewayBase = "https://gateway.pinata.cloud/ipfs"
  ) {}

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
    return {
      cid: data.IpfsHash,
      gatewayUrl: `${this.gatewayBase}/${data.IpfsHash}`,
    };
  }

  async unpin(cid: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/pinning/unpin/${cid}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.jwt}` },
    });
    if (!response.ok) throw new Error("Failed to unpin");
  }
}
