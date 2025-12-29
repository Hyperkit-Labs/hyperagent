"use client";

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface BackendOfflineProps {
  onRetry?: () => void;
}

export function BackendOffline({ onRetry }: BackendOfflineProps) {
  return (
    <Card className="p-8 text-center">
      <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-orange-600" />
        </div>
        
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Backend Service Offline
          </h3>
          <p className="text-gray-600">
            The HyperAgent API is not currently running. Please start the backend service to continue.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 w-full text-left">
          <p className="text-sm font-medium text-gray-900 mb-2">To start the backend:</p>
          <code className="text-xs bg-gray-900 text-green-400 p-2 rounded block">
            uvicorn hyperagent.api.main:app --reload
          </code>
        </div>

        {onRetry && (
          <Button
            onClick={onRetry}
            variant="primary"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </Button>
        )}
      </div>
    </Card>
  );
}

