/**
 * Mock implementations for testing
 */

import { HyperAgentState } from "../../core/spec/state";

/**
 * Mock Chroma client for testing
 */
export class MockChromaClient {
  private stored: Array<{ content: string; metadata: any }> = [];

  async findSimilar(query: string, limit: number = 5) {
    return this.stored
      .slice(0, limit)
      .map((item, idx) => ({
        id: `mock_${idx}`,
        content: item.content,
        metadata: item.metadata,
        distance: 0.5,
      }));
  }

  async storeContract(content: string, metadata: any): Promise<boolean> {
    this.stored.push({ content, metadata });
    return true;
  }

  clear(): void {
    this.stored = [];
  }
}

/**
 * Mock Pinata client for testing
 */
export class MockPinataClient {
  private pinned: Map<string, any> = new Map();

  async pinJSONToIPFS(data: any): Promise<string> {
    const cid = `mock_cid_${Math.random().toString(36).slice(2, 11)}`;
    this.pinned.set(cid, data);
    return cid;
  }

  async fetchFromIPFS(cid: string): Promise<any> {
    return this.pinned.get(cid) || null;
  }

  isConfigured(): boolean {
    return true;
  }

  clear(): void {
    this.pinned.clear();
  }
}

/**
 * Mock Python audit client for testing
 */
export class MockPythonAuditClient {
  async auditContract(contractCode: string) {
    return {
      status: "success" as const,
      vulnerabilities: [],
      overall_risk_score: 0,
      audit_status: "passed" as const,
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  mapFindingsToOrchestratorFormat(response: any) {
    return {
      passed: response.audit_status === "passed",
      findings: [],
    };
  }
}

/**
 * Mock Anthropic client for testing
 */
export async function mockCallAnthropic(
  config: { apiKey: string; model: string; maxTokens: number; temperature: number },
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  // Return a simple mock contract
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockContract {
    string public name = "Mock";
    
    function getName() public view returns (string memory) {
        return name;
    }
}`;
}

