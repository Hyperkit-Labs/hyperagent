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
    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <h4 className="text-sm font-semibold text-blue-900 mb-2">📚 Documentation Context Used</h4>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-blue-700 font-medium">Protocols:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {metadata.protocols_used?.map((protocol: string, idx: number) => (
              <Badge key={idx} variant="outline" className="text-xs bg-white">
                {protocol}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <span className="text-blue-700 font-medium">Context Size:</span>
          <span className="ml-2 text-blue-600">{metadata.context_length?.toLocaleString()} chars</span>
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
    <Card>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Workflow Progress</h3>
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
                className={`flex items-center gap-3 p-2 rounded ${
                  isCurrent ? 'bg-blue-50' : isCompleted ? 'bg-green-50' : 'bg-gray-50'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span className={`text-sm ${isCurrent ? 'font-medium text-blue-900' : ''}`}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

