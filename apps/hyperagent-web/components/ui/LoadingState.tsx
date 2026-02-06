/**
 * LoadingState Component
 * Displays loading indicators with different variants
 * Follows senior frontend best practices for UI feedback
 */

'use client';

import React from 'react';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'

interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton' | 'pulse' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  fullscreen?: boolean;
}

export function LoadingState({ 
  variant = 'spinner', 
  size = 'md', 
  message,
  fullscreen = false 
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const content = (
    <>
      {variant === 'spinner' && (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className={`${sizeClasses[size]} text-violet-500 animate-spin`} />
          {message && (
            <p className="text-slate-400 text-sm">{message}</p>
          )}
        </div>
      )}

      {variant === 'minimal' && (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          {message || 'Loading...'}
        </div>
      )}

      {variant === 'pulse' && (
        <div className="space-y-4 w-full">
          <div className="h-8 bg-slate-800/50 rounded-lg animate-pulse" />
          <div className="h-8 bg-slate-800/50 rounded-lg animate-pulse" />
          <div className="h-8 bg-slate-800/50 rounded-lg animate-pulse" />
        </div>
      )}

      {variant === 'skeleton' && (
        <div className="space-y-4 w-full">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-800/50 rounded-lg animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-800/50 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-slate-800/50 rounded animate-pulse w-1/2" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-800/50 rounded-lg animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-800/50 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-slate-800/50 rounded animate-pulse w-1/2" />
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 bg-[#05050A]/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-8">
          {content}
        </div>
      </div>
    );
  }

  return <div className="flex items-center justify-center p-8">{content}</div>;
}

/**
 * LoadingOverlay Component
 * Displays a loading overlay over content
 */
export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
      <LoadingState variant="spinner" size="md" message={message} />
    </div>
  );
}

/**
 * TableSkeleton Component
 * Displays a loading skeleton for tables
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-slate-900/30 rounded-lg">
          <div className="w-8 h-8 bg-slate-800/50 rounded animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-800/50 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-slate-800/50 rounded animate-pulse w-1/2" />
          </div>
          <div className="w-20 h-6 bg-slate-800/50 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/**
 * CardSkeleton Component
 * Displays a loading skeleton for cards
 */
export function CardSkeleton() {
  return (
    <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 bg-slate-800/50 rounded w-32" />
        <div className="w-8 h-8 bg-slate-800/50 rounded" />
      </div>
      <div className="h-10 bg-slate-800/50 rounded w-24 mb-2" />
      <div className="h-4 bg-slate-800/50 rounded w-full" />
    </div>
  );
}

