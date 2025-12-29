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
  
  const wsUrl = workflowId 
    ? `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}/ws/workflow/${workflowId}`
    : '';
  
  const { lastMessage, isConnected } = useWebSocket(wsUrl, enabled && !!workflowId);
  
  useEffect(() => {
    if (lastMessage) {
      try {
        const event = JSON.parse(lastMessage);
        
        if (event.type === 'WORKFLOW_PROGRESSED') {
          setProgress({
            progress: event.data.progress_percentage || 0,
            stage: event.data.stage || event.data.current_stage || 'planning',
            status: event.data.status || 'pending',
            details: event.data.details
          });
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    }
  }, [lastMessage]);
  
  return { ...progress, isConnected };
}

