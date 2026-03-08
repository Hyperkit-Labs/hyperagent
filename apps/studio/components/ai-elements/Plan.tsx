'use client';

import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

export type PlanStepStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface PlanStep {
  id: string;
  label: string;
  status: PlanStepStatus;
  icon?: React.ReactNode;
  error?: string;
  required?: boolean;
}

export interface PlanProps {
  title?: string;
  steps: PlanStep[];
  className?: string;
}

export function Plan({ title, steps, className = '' }: PlanProps) {
  return (
    <div className={className}>
      {title && (
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">{title}</h2>
      )}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isCompleted = step.status === 'completed';
          const isFailed = step.status === 'failed';
          const isProcessing = step.status === 'processing';

          const borderClass = isCompleted
            ? 'border-[var(--color-semantic-success)]/20'
            : isFailed
              ? 'border-[var(--color-semantic-error)]/20'
              : isProcessing
                ? 'border-[var(--color-semantic-warning)]/20'
                : 'border-[var(--color-border-subtle)]';

          const iconBgClass = isCompleted
            ? 'bg-[var(--color-semantic-success)]/10 text-[var(--color-semantic-success)]'
            : isFailed
              ? 'bg-[var(--color-semantic-error)]/10 text-[var(--color-semantic-error)]'
              : isProcessing
                ? 'bg-[var(--color-semantic-warning)]/10 text-[var(--color-semantic-warning)] animate-pulse'
                : 'bg-[var(--color-bg-panel)] text-[var(--color-text-muted)]';

          const statusText = isCompleted
            ? 'Completed'
            : isFailed
              ? 'Failed'
              : isProcessing
                ? 'In Progress...'
                : 'Pending';

          const statusColorClass = isCompleted
            ? 'text-[var(--color-semantic-success)]'
            : isFailed
              ? 'text-[var(--color-semantic-error)]'
              : isProcessing
                ? 'text-[var(--color-semantic-warning)]'
                : 'text-[var(--color-text-muted)]';

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
              className={`p-4 bg-[var(--color-bg-elevated)] border rounded-lg transition-colors duration-300 ${borderClass} ${isCompleted ? 'ring-1 ring-[var(--color-semantic-success)]/30' : ''}`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${iconBgClass}`}
                >
                  {step.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[var(--color-text-primary)]">{step.label}</p>
                    {step.required && (
                      <span className="text-xs px-2 py-0.5 bg-[var(--color-semantic-info)]/20 text-[var(--color-semantic-info)] rounded">
                        Required
                      </span>
                    )}
                  </div>
                  <p className={`text-sm ${statusColorClass}`}>{statusText}</p>
                  {step.error && (
                    <p className="text-xs text-[var(--color-semantic-error)] mt-1 whitespace-pre-wrap">
                      {step.error}
                    </p>
                  )}
                </div>
                {isCompleted && (
                  <CheckCircle className="w-5 h-5 text-[var(--color-semantic-success)]" />
                )}
                {isFailed && (
                  <XCircle className="w-5 h-5 text-[var(--color-semantic-error)]" />
                )}
                {isProcessing && (
                  <Loader2 className="w-5 h-5 text-[var(--color-semantic-warning)] animate-spin" />
                )}
                {step.status === 'pending' && (
                  <Clock className="w-5 h-5 text-[var(--color-text-muted)]" />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
