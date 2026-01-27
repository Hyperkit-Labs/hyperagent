"use client";

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface BackendOfflineProps {
  onRetry?: () => void;
}

export function BackendOffline({ onRetry }: BackendOfflineProps) {
  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
      <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-orange-400" />
        </div>
        
        <div>
          <h3 className="text-xl font-bold text-white mb-2">
            Backend Service Offline
          </h3>
          <p className="text-gray-400">
            The HyperAgent API is not currently running. Please start the backend service to continue.
          </p>
        </div>

        <div className="bg-gray-800/50 border border-white/10 rounded-xl p-4 w-full text-left">
          <p className="text-sm font-semibold text-gray-300 mb-2">To start the backend:</p>
          <code className="text-xs bg-gray-900 text-green-400 p-3 rounded-lg block border border-white/5 font-mono">
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
    </div>
  );
}

