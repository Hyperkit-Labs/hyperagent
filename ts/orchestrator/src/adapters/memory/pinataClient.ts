/**
 * Pinata IPFS client
 * Implements MEMORY_INTEGRATION_POINTS operations for immutable memory layer
 * 
 * Spec: MEMORY_LAYERS.immutable.backend = "https://api.pinata.cloud"
 */

import { MEMORY_INTEGRATION_POINTS } from "../../core/spec/memory";
import { config } from "../../config/env";
import { MemoryStorageError } from "../../core/errors";

export interface PinataPinOptions {
  pinataMetadata?: {
    name?: string;
    keyvalues?: Record<string, string>;
  };
  pinataOptions?: {
    cidVersion?: 0 | 1;
  };
}

export interface PinataPinResponse {
  IpfsHash: string; // CID
  PinSize: number;
  Timestamp: string;
}

export interface PinataClientConfig {
  apiKey?: string;
  apiSecret?: string;
  gatewayUrl?: string;
}

/**
 * Pinata IPFS client
 * Implements pin_to_ipfs and fetch_from_ipfs operations
 */
export class PinataClient {
  private apiKey: string;
  private apiSecret: string;
  private gatewayUrl: string;
  private baseUrl = "https://api.pinata.cloud";

  constructor(clientConfig: PinataClientConfig = {}) {
    this.apiKey = clientConfig.apiKey || config.PINATA_API_KEY || "";
    this.apiSecret = clientConfig.apiSecret || config.PINATA_API_SECRET || "";
    this.gatewayUrl = clientConfig.gatewayUrl || "https://gateway.pinata.cloud";
  }

  /**
   * Pin data to IPFS (MEMORY_INTEGRATION_POINTS.eigenda)
   * Stores contract + audit results as JSON
   * 
   * @param data - Data to pin (object will be JSON stringified)
   * @param options - Pinata pin options
   * @returns IPFS CID
   */
  async pinToIPFS(
    data: any,
    options: PinataPinOptions = {},
  ): Promise<string> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error(
        "Pinata API credentials not configured. Set PINATA_API_KEY and PINATA_API_SECRET environment variables.",
      );
    }

    try {
      // Convert data to JSON if it's an object
      const jsonData = typeof data === "string" ? data : JSON.stringify(data);

      // Create FormData for multipart upload
      const formData = new FormData();
      const blob = new Blob([jsonData], { type: "application/json" });
      formData.append("file", blob, "contract.json");

      // Add metadata
      if (options.pinataMetadata) {
        formData.append(
          "pinataMetadata",
          JSON.stringify(options.pinataMetadata),
        );
      }

      // Add options
      if (options.pinataOptions) {
        formData.append("pinataOptions", JSON.stringify(options.pinataOptions));
      }

      // Pin to IPFS
      const response = await fetch(`${this.baseUrl}/pinning/pinFileToIPFS`, {
        method: "POST",
        headers: {
          pinata_api_key: this.apiKey,
          pinata_secret_api_key: this.apiSecret,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new MemoryStorageError(
          `Pinata pin failed: ${errorText}`,
          "ipfs",
          {
            statusCode: response.status,
            url: `${this.baseUrl}/pinning/pinFileToIPFS`,
          },
        );
      }

      const result = await response.json() as PinataPinResponse;
      return result.IpfsHash; // CID
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to pin to IPFS: ${message}`);
    }
  }

  /**
   * Pin JSON data directly (alternative to pinFileToIPFS)
   * More efficient for JSON data
   */
  async pinJSONToIPFS(
    data: any,
    options: PinataPinOptions = {},
  ): Promise<string> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error(
        "Pinata API credentials not configured. Set PINATA_API_KEY and PINATA_API_SECRET environment variables.",
      );
    }

    try {
      const payload = {
        pinataContent: data,
        pinataMetadata: options.pinataMetadata || {},
        pinataOptions: {
          cidVersion: 1,
          ...options.pinataOptions,
        },
      };

      const response = await fetch(`${this.baseUrl}/pinning/pinJSONToIPFS`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          pinata_api_key: this.apiKey,
          pinata_secret_api_key: this.apiSecret,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new MemoryStorageError(
          `Pinata pinJSON failed: ${errorText}`,
          "ipfs",
          {
            statusCode: response.status,
            url: `${this.baseUrl}/pinning/pinJSONToIPFS`,
          },
        );
      }

      const result = await response.json() as PinataPinResponse;
      return result.IpfsHash; // CID
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to pin JSON to IPFS: ${message}`);
    }
  }

  /**
   * Fetch data from IPFS via CID (MEMORY_INTEGRATION_POINTS.fetch_from_ipfs)
   * 
   * @param cid - IPFS content identifier
   * @returns Parsed data (JSON parsed if JSON, otherwise string)
   */
  async fetchFromIPFS(cid: string): Promise<any> {
    try {
      // Use Pinata gateway to fetch content
      const response = await fetch(`${this.gatewayUrl}/ipfs/${cid}`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new MemoryStorageError(
          `IPFS fetch failed: ${response.status}`,
          "ipfs",
          {
            statusCode: response.status,
            url: `${this.gatewayUrl}/ipfs/${cid}`,
          },
        );
      }

      const contentType = response.headers.get("content-type");
      const text = await response.text();

      // Try to parse as JSON if content-type suggests JSON
      if (contentType?.includes("application/json") || text.trim().startsWith("{")) {
        try {
          return JSON.parse(text);
        } catch {
          // Not valid JSON, return as string
          return text;
        }
      }

      return text;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch from IPFS: ${message}`);
    }
  }

  /**
   * Check if Pinata credentials are configured
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.apiSecret);
  }
}

/**
 * Create Pinata client with default config
 */
export function createPinataClient(config?: PinataClientConfig): PinataClient {
  return new PinataClient(config);
}

