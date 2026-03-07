'use client';

import React, { useState } from 'react';
import { FileText, Layout, Code, Shield, TestTube, Rocket, LayoutGrid, Clock, Download, Loader2, RefreshCw, ShieldCheck, Search, MessageSquare, Bug } from 'lucide-react';
import { Plan } from '@/components/ai-elements';
import type { PlanStep, PlanStepStatus } from '@/components/ai-elements';
import type { Workflow } from '@/lib/types';
import { exportUiApp, downloadExportedZip } from '@/lib/api';

const STAGE_ICONS: Record<string, React.ReactNode> = {
  spec: <FileText className="w-5 h-5" />,
  design: <Layout className="w-5 h-5" />,
  codegen: <Code className="w-5 h-5" />,
  scrubd: <Search className="w-5 h-5" />,
  audit: <Shield className="w-5 h-5" />,
  autofix: <RefreshCw className="w-5 h-5" />,
  debate: <MessageSquare className="w-5 h-5" />,
  guardian: <ShieldCheck className="w-5 h-5" />,
  simulation: <TestTube className="w-5 h-5" />,
  exploit_sim: <Bug className="w-5 h-5" />,
  deploy: <Rocket className="w-5 h-5" />,
  ui_scaffold: <LayoutGrid className="w-5 h-5" />,
};

/**
 * Canonical pipeline order. Non-negotiable, mandatory as default.
 * Must match backend STEP_ORDER (nodes.py) + conditional stages (autofix, guardian).
 */
const PIPELINE_ORDER = [
  { name: 'spec', label: 'Spec', required: true },
  { name: 'design', label: 'Design', required: true },
  { name: 'codegen', label: 'Codegen', required: true },
  { name: 'scrubd', label: 'Scrubd', required: true },
  { name: 'audit', label: 'Audit', required: true },
  { name: 'autofix', label: 'Autofix', required: true },
  { name: 'debate', label: 'Debate', required: true },
  { name: 'guardian', label: 'Guardian', required: true },
  { name: 'simulation', label: 'Simulation', required: true },
  { name: 'exploit_sim', label: 'Exploit Sim', required: true },
  { name: 'deploy', label: 'Deploy', required: true },
  { name: 'ui_scaffold', label: 'UI Schema', required: true },
];

interface WorkflowStagesProps {
  workflow: Workflow;
  contractData: { bytecode?: string; source_code?: string; [key: string]: unknown } | null;
}

function normalizeStatus(s: string): PlanStepStatus {
  const lower = s.toLowerCase();
  if (lower === 'completed' || lower === 'done' || lower === 'success') return 'completed';
  if (lower === 'failed' || lower === 'error') return 'failed';
  if (lower === 'processing' || lower === 'running' || lower === 'building' || lower === 'in_progress') return 'processing';
  return 'pending';
}

export function WorkflowStages({ workflow, contractData }: WorkflowStagesProps) {
  const backendStages = workflow.stages || [];
  const stageMap = new Map(
    backendStages.map((s: { name?: string; stage?: string; status?: string }) => [
      (s.name ?? s.stage) ?? '',
      s,
    ])
  );

  const workflowFailed = workflow.status === 'failed';
  const errorSource = ((workflow.metadata ?? workflow.meta_data) as Record<string, unknown> | undefined);
  const workflowError = errorSource?.error as string | undefined;

  const activeStageDefs = PIPELINE_ORDER;

  const steps: PlanStep[] = activeStageDefs.map((stageDef) => {
    const stage = stageMap.get(stageDef.name) as { status?: string; error?: string; cycles?: number } | undefined;
    let status: PlanStepStatus = stage ? normalizeStatus(stage?.status ?? 'pending') : 'pending';

    if (!stage && (workflow.status === 'building' || workflow.status === 'running' || workflow.status === 'spec_review' || workflow.status === 'design_review')) {
      const idx = activeStageDefs.findIndex((s) => s.name === stageDef.name);
      const prevDone = idx > 0 && activeStageDefs.slice(0, idx).every((prev) => {
        const p = stageMap.get(prev.name) as { status?: string } | undefined;
        return p && (p.status === 'completed' || p.status === 'done');
      });
      if (prevDone) status = 'processing';
      else if (idx === 0 && !stage) status = 'processing';
    }

    if (workflowFailed && status === 'pending' && !stage) {
      const idx = activeStageDefs.findIndex((s) => s.name === stageDef.name);
      const anyPrevCompleted = backendStages.length > 0;
      const isFirstUncompleted = !anyPrevCompleted && idx === 0;
      const prevAllDone = idx > 0 && activeStageDefs.slice(0, idx).every((prev) => {
        const p = stageMap.get(prev.name) as { status?: string } | undefined;
        return p && (p.status === 'completed' || p.status === 'done');
      });
      if (isFirstUncompleted || prevAllDone) {
        status = 'failed';
      }
    }

    if (stageDef.name === 'codegen' && !stage && contractData?.bytecode) status = 'completed';
    if (stageDef.name === 'deploy' && !stage) {
      const deployResult = (workflow as { deployment_result?: { contract_address?: string } }).deployment_result;
      if (deployResult?.contract_address) status = 'completed';
    }

    let label = stageDef.label;
    if (stageDef.name === 'autofix' && stage?.cycles) {
      label = `Autofix (${stage.cycles} cycle${stage.cycles > 1 ? 's' : ''})`;
    }

    return {
      id: stageDef.name,
      label,
      status,
      icon: STAGE_ICONS[stageDef.name] ?? <Clock className="w-5 h-5" />,
      error: stage?.error,
      required: stageDef.required ?? false,
    };
  });

  const hasUiSchema = !!workflow.ui_schema;
  const workflowId = workflow.workflow_id;
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!workflowId || !hasUiSchema) return;
    setExporting(true);
    setExportError(null);
    try {
      const res = await exportUiApp(workflowId);
      if (res.zip_base64 && res.filename) {
        downloadExportedZip(res);
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Plan title="Workflow Stages" steps={steps} />
      {workflowFailed && workflowError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
          <p className="text-xs font-medium text-red-400 mb-1">Pipeline failed</p>
          <p className="text-xs text-red-400/80 break-words font-mono">{workflowError}</p>
        </div>
      )}
      {workflowFailed && !workflowError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
          <p className="text-xs font-medium text-red-400">Pipeline failed. Check logs or retry with a different prompt.</p>
        </div>
      )}
      {hasUiSchema && workflowId && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] text-sm font-medium disabled:opacity-60 transition-colors"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Exporting…' : 'Export UI app'}
          </button>
          {exportError && <span className="text-xs text-[var(--color-semantic-error)]">{exportError}</span>}
        </div>
      )}
    </div>
  );
}
