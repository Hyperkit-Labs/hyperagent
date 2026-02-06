/**
 * ErrorAlert Component
 * Displays error messages with different severity levels
 * Follows senior frontend best practices for error communication
 */

'use client';

import React from 'react';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import Info from 'lucide-react/dist/esm/icons/info'
import XCircle from 'lucide-react/dist/esm/icons/x-circle'
import X from 'lucide-react/dist/esm/icons/x'

interface ErrorAlertProps {
  title?: string;
  message: string;
  severity?: 'error' | 'warning' | 'info';
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function ErrorAlert({ 
  title, 
  message, 
  severity = 'error',
  dismissible = true,
  onDismiss,
  action
}: ErrorAlertProps) {
  const config = {
    error: {
      icon: XCircle,
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
      iconColor: 'text-red-500',
      textColor: 'text-red-400',
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/20',
      iconColor: 'text-yellow-500',
      textColor: 'text-yellow-400',
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      iconColor: 'text-blue-500',
      textColor: 'text-blue-400',
    },
  };

  const { icon: Icon, bgColor, borderColor, iconColor, textColor } = config[severity];

  return (
    <div className={`${bgColor} border ${borderColor} rounded-xl p-4 relative`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`} />
        
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={`text-sm font-semibold ${textColor} mb-1`}>
              {title}
            </h4>
          )}
          <p className="text-sm text-slate-300">
            {message}
          </p>
          
          {action && (
            <button
              onClick={action.onClick}
              className={`mt-3 text-sm font-medium ${textColor} hover:underline`}
            >
              {action.label}
            </button>
          )}
        </div>

        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * ErrorFallback Component
 * Displays a full-page error state
 */
export function ErrorFallback({ 
  error, 
  reset 
}: { 
  error: Error | string; 
  reset?: () => void;
}) {
  const errorMessage = typeof error === 'string' ? error : error.message;

  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        
        <h3 className="text-xl font-semibold text-white mb-2">
          Something went wrong
        </h3>
        
        <p className="text-slate-400 mb-6">
          {errorMessage}
        </p>

        {reset && (
          <button
            onClick={reset}
            className="px-6 py-2 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white rounded-lg font-medium transition-all duration-200"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * EmptyState Component
 * Displays an empty state when no data is available
 */
export function EmptyState({ 
  title, 
  message, 
  action 
}: { 
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Info className="w-8 h-8 text-slate-500" />
        </div>
        
        <h3 className="text-xl font-semibold text-white mb-2">
          {title}
        </h3>
        
        <p className="text-slate-400 mb-6">
          {message}
        </p>

        {action && (
          <button
            onClick={action.onClick}
            className="px-6 py-2 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white rounded-lg font-medium transition-all duration-200"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

