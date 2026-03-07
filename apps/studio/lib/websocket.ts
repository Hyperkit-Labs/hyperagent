/**
 * Workflow WebSocket client for real-time updates.
 */

import { getServiceUrl } from '@/config/environment';

function wsBase(): string {
  const url = getServiceUrl('backend');
  // Convert HTTP/HTTPS to WS/WSS
  if (url.startsWith('https://')) {
    return url.replace(/^https/, 'wss');
  }
  return url.replace(/^http/, 'ws');
}

export interface WorkflowMessage {
  type: string;
  data?: unknown;
}

type Unsubscribe = () => void;

export class WorkflowWebSocket {
  private workflowId: string;
  private ws: WebSocket | null = null;
  private messageHandlers: Set<(msg: WorkflowMessage) => void> = new Set();
  private connectHandlers: Set<() => void> = new Set();
  private disconnectHandlers: Set<() => void> = new Set();
  private errorHandlers: Set<(err: Event) => void> = new Set();

  constructor(workflowId: string) {
    this.workflowId = workflowId;
  }

  onMessage(handler: (message: WorkflowMessage) => void): Unsubscribe {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnect(handler: () => void): Unsubscribe {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  onDisconnect(handler: () => void): Unsubscribe {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  onError(handler: (err: Event) => void): Unsubscribe {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  connect(): void {
    if (typeof window === 'undefined' || this.ws?.readyState === WebSocket.OPEN) return;
    const base = wsBase();
    // Backend WebSocket endpoint: /ws/workflow/{workflow_id} (not under /api/v1)
    // Remove /api/v1 from base URL for WebSocket path
    const wsBaseUrl = base.replace('/api/v1', '');
    const url = `${wsBaseUrl}/ws/workflow/${this.workflowId}`;
    this.ws = new WebSocket(url);
    this.ws.onopen = () => this.connectHandlers.forEach((h) => h());
    this.ws.onclose = () => this.disconnectHandlers.forEach((h) => h());
    this.ws.onerror = (e) => this.errorHandlers.forEach((h) => h(e));
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WorkflowMessage;
        this.messageHandlers.forEach((h) => h(msg));
      } catch {
        // ignore parse errors
      }
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
