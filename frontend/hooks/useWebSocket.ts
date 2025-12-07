'use client';

import { useEffect, useState, useRef } from 'react';
import { WorkflowWebSocket } from '@/lib/websocket';
import type { WebSocketMessage, Workflow } from '@/lib/types';

export function useWebSocket(workflowId: string | null) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WorkflowWebSocket | null>(null);

  useEffect(() => {
    if (!workflowId) {
      return;
    }

    const ws = new WorkflowWebSocket(workflowId);
    wsRef.current = ws;

    const unsubscribeMessage = ws.onMessage((message) => {
      if (message.type === 'workflow_progressed' || message.type === 'workflow_completed' || message.type === 'workflow_failed') {
        if (message.data) {
          setWorkflow(message.data as Workflow);
        }
      }
    });

    const unsubscribeConnect = ws.onConnect(() => {
      setConnected(true);
      setError(null);
    });

    const unsubscribeDisconnect = ws.onDisconnect(() => {
      setConnected(false);
    });

    const unsubscribeError = ws.onError((err) => {
      setError('WebSocket connection error');
      console.error('WebSocket error:', err);
    });

    ws.connect();

    return () => {
      unsubscribeMessage();
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeError();
      ws.disconnect();
    };
  }, [workflowId]);

  return { workflow, connected, error };
}

