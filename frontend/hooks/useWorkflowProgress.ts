"use client";

import { useEffect, useState, useRef } from 'react';

interface WorkflowProgress {
  progress: number;
  stage: string;
  status: string;
  details?: string;
}

interface UseWebSocketReturn {
  lastMessage: string | null;
  isConnected: boolean;
}

function useWebSocket(url: string, enabled: boolean = true): UseWebSocketReturn {
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!enabled || !url) {
      return;
    }

    let isMounted = true;

    const connect = () => {
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isMounted) {
            setIsConnected(true);
          }
        };

        ws.onmessage = (event) => {
          if (isMounted) {
            setLastMessage(event.data);
          }
        };

        ws.onerror = () => {
          if (isMounted) {
            setIsConnected(false);
          }
        };

        ws.onclose = (event) => {
          if (isMounted) {
            setIsConnected(false);
            
            if (event.code !== 1000 && event.code !== 1001) {
              reconnectTimeoutRef.current = setTimeout(() => {
                if (isMounted) {
                  connect();
                }
              }, 3000);
            }
          }
        };
      } catch (error) {
        if (isMounted) {
          setIsConnected(false);
        }
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000);
      }
    };
  }, [url, enabled]);

  return { lastMessage, isConnected };
}

export function useWorkflowProgress(workflowId: string, enabled: boolean = true) {
  const [progress, setProgress] = useState<WorkflowProgress>({
    progress: 0,
    stage: 'planning',
    status: 'pending'
  });
  
  // WebSocket is disabled by default since TS API doesn't implement WS endpoints yet.
  // Enable this when using Python backend by setting NEXT_PUBLIC_WS_ENABLED=true
  const wsEnabled = process.env.NEXT_PUBLIC_WS_ENABLED === 'true';
  
  const wsUrl = workflowId 
    ? `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}/ws/workflow/${workflowId}`
    : '';
  
  const { lastMessage, isConnected } = useWebSocket(wsUrl, wsEnabled && enabled && !!workflowId);
  
  useEffect(() => {
    if (!lastMessage) {
      return;
    }

    try {
      const event = JSON.parse(lastMessage);
      const type = String(event?.type ?? '').toLowerCase();

      // Python backend emits EventType values like "workflow.progressed".
      if (type === 'workflow.progressed') {
        const stageRaw = String(event?.data?.stage ?? event?.data?.current_stage ?? 'planning').toLowerCase();
        const stage = stageRaw === 'compilation' ? 'generation' : stageRaw;

        setProgress({
          progress: Number(event?.data?.progress_percentage ?? 0),
          stage,
          status: 'running',
          details: event?.data?.details,
        });
        return;
      }

      if (type === 'workflow.completed') {
        setProgress((prev) => ({ ...prev, progress: 100, status: 'completed' }));
        return;
      }

      if (type === 'workflow.failed') {
        setProgress((prev) => ({ ...prev, status: 'failed' }));
        return;
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, [lastMessage]);
  
  return { ...progress, isConnected };
}

