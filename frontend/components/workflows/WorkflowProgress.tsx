'use client';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Workflow } from '@/lib/types';

interface WorkflowProgressProps {
  workflow: Workflow;
}

const stages = [
  { key: 'generating', label: 'Generation', progress: 20 },
  { key: 'compiling', label: 'Compilation', progress: 40 },
  { key: 'auditing', label: 'Audit', progress: 60 },
  { key: 'testing', label: 'Testing', progress: 80 },
  { key: 'deploying', label: 'Deployment', progress: 100 },
];

function RAGContextMetadata({ metadata }: { metadata: any }) {
  if (!metadata || !metadata.has_context) return null;

  return (
    <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
      <h4 className="text-sm font-semibold text-blue-400 mb-2">📚 Documentation Context Used</h4>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-blue-300 font-medium">Protocols:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {metadata.protocols_used?.map((protocol: string, idx: number) => (
              <Badge key={idx} variant="info" className="text-xs">
                {protocol}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <span className="text-blue-300 font-medium">Context Size:</span>
          <span className="ml-2 text-blue-400">{metadata.context_length?.toLocaleString()} chars</span>
        </div>
      </div>
    </div>
  );
}

export function WorkflowProgress({ workflow }: WorkflowProgressProps) {
  // Normalize status to lowercase for comparison
  const normalizedStatus = workflow.status?.toLowerCase() || 'pending';
  const currentStageIndex = stages.findIndex((s) => normalizedStatus === s.key);
  
  // Use progress_percentage if available, otherwise calculate from stage
  const progress = workflow.progress_percentage ?? (currentStageIndex >= 0 ? stages[currentStageIndex].progress : 0);

  // Extract RAG metadata if available
  const ragMetadata = workflow.metadata?.rag_metadata;

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Workflow Progress</h3>
          <StatusBadge status={workflow.status} />
        </div>

        <ProgressBar progress={progress} />

        {ragMetadata && <RAGContextMetadata metadata={ragMetadata} />}

        <div className="space-y-2">
          {stages.map((stage, index) => {
            const isCompleted = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;

            return (
              <div
                key={stage.key}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                  isCurrent 
                    ? 'bg-blue-500/10 border border-blue-500/20' 
                    : isCompleted 
                    ? 'bg-green-500/10 border border-green-500/20' 
                    : 'bg-white/5 border border-white/10'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCompleted
                      ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                      : isCurrent
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 animate-pulse'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span className={`text-sm font-medium ${
                  isCurrent 
                    ? 'text-blue-400' 
                    : isCompleted 
                    ? 'text-green-400' 
                    : 'text-gray-400'
                }`}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

