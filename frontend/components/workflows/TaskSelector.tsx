'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface TaskCostBreakdown {
  total_usdc: number;
  breakdown: Record<string, {
    base: number;
    multiplier: number;
    final: number;
  }>;
  selected_tasks: string[];
  network: string;
  network_multiplier: number;
  model_multiplier: number;
  complexity_multiplier: number;
}

interface TaskSelectorProps {
  selectedTasks: string[];
  onTasksChange: (tasks: string[]) => void;
  network: string;
  model?: string;
  contractComplexity?: string;
  promptLength?: number;
  onCostUpdate?: (cost: TaskCostBreakdown | null) => void;
}

const TASK_DESCRIPTIONS: Record<string, { label: string; description: string; requires?: string[] }> = {
  generation: {
    label: 'Code Generation',
    description: 'Generate smart contract code from natural language description',
  },
  audit: {
    label: 'Security Audit',
    description: 'Automated security analysis and vulnerability detection',
    requires: ['generation'],
  },
  testing: {
    label: 'Automated Testing',
    description: 'Generate and run unit tests for the contract',
    requires: ['generation'],
  },
  deployment: {
    label: 'Deployment',
    description: 'Deploy contract to the selected blockchain network',
    requires: ['generation'],
  },
};

export function TaskSelector({
  selectedTasks,
  onTasksChange,
  network,
  model = 'gemini-2.5-flash',
  contractComplexity = 'standard',
  promptLength,
  onCostUpdate,
}: TaskSelectorProps) {
  const [costBreakdown, setCostBreakdown] = useState<TaskCostBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch cost estimate when tasks or network change
  useEffect(() => {
    if (!network || selectedTasks.length === 0) {
      setCostBreakdown(null);
      onCostUpdate?.(null);
      return;
    }

    const fetchCostEstimate = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/workflows/estimate-cost`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            selected_tasks: selectedTasks,
            network: network,
            model: model,
            contract_complexity: contractComplexity,
            prompt_length: promptLength,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || errorData.message || 'Failed to estimate cost');
        }

        const data: TaskCostBreakdown = await response.json();
        setCostBreakdown(data);
        onCostUpdate?.(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cost estimate');
        setCostBreakdown(null);
        onCostUpdate?.(null);
      } finally {
        setLoading(false);
      }
    };

    // Debounce API calls
    const timeoutId = setTimeout(fetchCostEstimate, 500);
    return () => clearTimeout(timeoutId);
  }, [selectedTasks, network, model, contractComplexity, promptLength, onCostUpdate]);

  const handleTaskToggle = (task: string) => {
    const taskInfo = TASK_DESCRIPTIONS[task];
    if (!taskInfo) return;

    // Check dependencies
    if (taskInfo.requires) {
      const missingDeps = taskInfo.requires.filter((dep) => !selectedTasks.includes(dep));
      if (missingDeps.length > 0 && !selectedTasks.includes(task)) {
        // Auto-add required tasks
        const newTasks = [...selectedTasks, ...missingDeps, task];
        onTasksChange(newTasks);
        return;
      }
    }

    // Toggle task
    if (selectedTasks.includes(task)) {
      // Remove task and any tasks that depend on it
      const tasksToRemove = [task];
      Object.entries(TASK_DESCRIPTIONS).forEach(([t, info]) => {
        if (info.requires?.includes(task)) {
          tasksToRemove.push(t);
        }
      });
      onTasksChange(selectedTasks.filter((t) => !tasksToRemove.includes(t)));
    } else {
      onTasksChange([...selectedTasks, task]);
    }
  };

  const allTasks = Object.keys(TASK_DESCRIPTIONS);

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Select Tasks *
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Choose which tasks to execute. You'll only pay for selected tasks.
          </p>
          <div className="space-y-2">
            {allTasks.map((task) => {
              const taskInfo = TASK_DESCRIPTIONS[task];
              const isSelected = selectedTasks.includes(task);
              const isDisabled = taskInfo.requires?.some((dep) => !selectedTasks.includes(dep));

              return (
                <label
                  key={task}
                  className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : isDisabled
                      ? 'border-gray-200 bg-gray-50 opacity-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleTaskToggle(task)}
                    disabled={isDisabled}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        {taskInfo.label}
                      </span>
                      {costBreakdown && isSelected && (
                        <span className="text-sm font-semibold text-blue-600">
                          ${costBreakdown.breakdown[task]?.final.toFixed(4) || '0.0000'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{taskInfo.description}</p>
                    {taskInfo.requires && taskInfo.requires.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Requires: {taskInfo.requires.map((r) => TASK_DESCRIPTIONS[r].label).join(', ')}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {costBreakdown && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Total Cost</span>
              <span className="text-lg font-bold text-gray-900">
                ${costBreakdown.total_usdc.toFixed(4)} USDC
              </span>
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <div>Network: {costBreakdown.network} (×{costBreakdown.network_multiplier})</div>
              {costBreakdown.model_multiplier > 1 && (
                <div>Model: {model} (×{costBreakdown.model_multiplier})</div>
              )}
              <div>Complexity: {contractComplexity} (×{costBreakdown.complexity_multiplier})</div>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-sm text-gray-500 text-center py-2">Calculating cost...</div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </Card>
  );
}

