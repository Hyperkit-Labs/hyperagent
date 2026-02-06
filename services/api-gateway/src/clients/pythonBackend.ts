/**
 * HTTP client for existing Python FastAPI backend
 * Used during migration period for features not yet ported to TS
 */
import { loadEnv } from "../config/env";

const env = loadEnv();

export interface PythonBackendClient {
  getWorkflow(id: string): Promise<unknown>;
  listWorkflows(): Promise<unknown>;
  getDeployment(id: string): Promise<unknown>;
}

export function createPythonBackendClient(): PythonBackendClient {
  const baseUrl = env.PYTHON_BACKEND_URL || "http://localhost:8000";

  return {
    async getWorkflow(id: string): Promise<unknown> {
      const response = await fetch(`${baseUrl}/api/v1/workflows/${id}`);
      if (!response.ok) {
        throw new Error(`Python backend error: ${response.statusText}`);
      }
      return response.json();
    },

    async listWorkflows(): Promise<unknown> {
      const response = await fetch(`${baseUrl}/api/v1/workflows`);
      if (!response.ok) {
        throw new Error(`Python backend error: ${response.statusText}`);
      }
      return response.json();
    },

    async getDeployment(id: string): Promise<unknown> {
      const response = await fetch(`${baseUrl}/api/v1/deployments/${id}`);
      if (!response.ok) {
        throw new Error(`Python backend error: ${response.statusText}`);
      }
      return response.json();
    },
  };
}

