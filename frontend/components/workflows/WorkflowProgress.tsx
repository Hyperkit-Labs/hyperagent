'use client';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card } from '@/components/ui/Card';
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

export function WorkflowProgress({ workflow }: WorkflowProgressProps) {
  const currentStage = stages.find((s) => workflow.status === s.key) || stages[0];
  const currentStageIndex = stages.findIndex((s) => workflow.status === s.key);

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Workflow Progress</h3>
          <StatusBadge status={workflow.status} />
        </div>

        <ProgressBar progress={workflow.progress_percentage} />

        <div className="space-y-2">
          {stages.map((stage, index) => {
            const isCompleted = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;
            const isPending = index > currentStageIndex;

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

