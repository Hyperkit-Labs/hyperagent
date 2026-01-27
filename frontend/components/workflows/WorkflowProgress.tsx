'use client';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Workflow } from '@/lib/types';
import { DNANodeProgress, DNANodeStatus, DNANodeType } from './DNANodeProgress';

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

/**
 * Extract DNA node statuses from workflow state
 */
function extractDNANodes(workflow: Workflow): DNANodeStatus[] {
  const nodes: DNANodeStatus[] = [];
  const status = workflow.status?.toLowerCase() || '';
  const logs = workflow.logs || [];
  
  // Check if this is a v2 workflow (has meta with workflowId)
  const isV2Workflow = !!workflow.meta?.workflowId;
  
  if (isV2Workflow) {
    // Parse logs to determine node statuses
    const nodeStatusMap = new Map<DNANodeType, { status: DNANodeStatus['status']; message?: string; details?: any }>();
    
    // Policy node
    const policyLogs = logs.filter(l => l.toLowerCase().includes('[policy]'));
    if (policyLogs.length > 0) {
      const lastPolicyLog = policyLogs[policyLogs.length - 1];
      nodeStatusMap.set('policy', {
        status: lastPolicyLog.toLowerCase().includes('error') || lastPolicyLog.toLowerCase().includes('failed') 
          ? 'failed' 
          : 'completed',
        message: lastPolicyLog,
        details: lastPolicyLog.toLowerCase().includes('violation') ? { violations: [lastPolicyLog] } : undefined
      });
    } else if (status === 'processing' || status === 'auditing' || status === 'validating' || status === 'deploying' || status === 'success') {
      nodeStatusMap.set('policy', { status: 'completed' });
    }
    
    // Generate node
    const generateLogs = logs.filter(l => l.toLowerCase().includes('[generate]'));
    if (generateLogs.length > 0) {
      const lastGenerateLog = generateLogs[generateLogs.length - 1];
      nodeStatusMap.set('generate', {
        status: workflow.contract ? 'completed' : 'processing',
        message: lastGenerateLog
      });
    } else if (workflow.contract) {
      nodeStatusMap.set('generate', { status: 'completed' });
    }
    
    // Audit node
    if (workflow.auditResults) {
      nodeStatusMap.set('audit', {
        status: workflow.auditResults.passed ? 'completed' : 'failed',
        message: workflow.auditResults.passed ? 'Audit passed' : 'Audit failed',
        details: { findings: workflow.auditResults.findings || [] }
      });
    } else if (status === 'auditing') {
      nodeStatusMap.set('audit', { status: 'processing' });
    }
    
    // Validate node
    const validateLogs = logs.filter(l => l.toLowerCase().includes('[validate]'));
    if (validateLogs.length > 0) {
      const lastValidateLog = validateLogs[validateLogs.length - 1];
      nodeStatusMap.set('validate', {
        status: lastValidateLog.toLowerCase().includes('passed') ? 'completed' : 'failed',
        message: lastValidateLog,
        details: lastValidateLog.toLowerCase().includes('failed') ? { errors: [lastValidateLog] } : undefined
      });
    } else if (status === 'validating' || status === 'deploying' || status === 'success') {
      nodeStatusMap.set('validate', { status: 'completed' });
    }
    
    // Deploy node
    if (workflow.deploymentAddress || workflow.txHash) {
      nodeStatusMap.set('deploy', {
        status: 'completed',
        message: `Deployed to ${workflow.deploymentAddress}`
      });
    } else if (status === 'deploying') {
      nodeStatusMap.set('deploy', { status: 'processing' });
    }
    
    // EigenDA node
    if (workflow.meta?.ipfsCid) {
      nodeStatusMap.set('eigenda', {
        status: 'completed',
        message: `IPFS CID: ${workflow.meta.ipfsCid}`
      });
    } else if (status === 'success') {
      // Check logs for EigenDA
      const eigendaLogs = logs.filter(l => l.toLowerCase().includes('[eigenda]'));
      if (eigendaLogs.length > 0) {
        nodeStatusMap.set('eigenda', { status: 'completed' });
      }
    }
    
    // Monitor node
    if (status === 'success') {
      const monitorLogs = logs.filter(l => l.toLowerCase().includes('[monitor]'));
      nodeStatusMap.set('monitor', {
        status: 'completed',
        message: 'Workflow complete',
        details: {
          storage: {
            chroma: monitorLogs.some(l => l.toLowerCase().includes('chroma')),
            ipfs: monitorLogs.some(l => l.toLowerCase().includes('ipfs'))
          }
        }
      });
    }
    
    // Build node status array
    const dnaNodeTypes: DNANodeType[] = ['policy', 'generate', 'audit', 'validate', 'deploy', 'eigenda', 'monitor'];
    dnaNodeTypes.forEach(nodeType => {
      const nodeData = nodeStatusMap.get(nodeType);
      if (nodeData) {
        nodes.push({
          node: nodeType,
          status: nodeData.status,
          message: nodeData.message,
          details: nodeData.details
        });
      } else {
        // Determine if node should be pending or skipped
        const nodeIndex = dnaNodeTypes.indexOf(nodeType);
        const hasPreviousCompleted = nodes.some(n => dnaNodeTypes.indexOf(n.node) < nodeIndex && n.status === 'completed');
        nodes.push({
          node: nodeType,
          status: hasPreviousCompleted ? 'pending' : 'pending'
        });
      }
    });
  }
  
  return nodes;
}

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
  // Check if this is a v2 workflow (DNA blueprint)
  const isV2Workflow = !!workflow.meta?.workflowId;
  const dnaNodes = isV2Workflow ? extractDNANodes(workflow) : [];
  
  // Normalize status to lowercase for comparison
  const normalizedStatus = workflow.status?.toLowerCase() || 'pending';
  const currentStageIndex = stages.findIndex((s) => normalizedStatus === s.key);
  
  // Use progress_percentage if available, otherwise calculate from stage
  const progress = workflow.progress_percentage ?? (currentStageIndex >= 0 ? stages[currentStageIndex].progress : 0);

  // Extract RAG metadata if available
  const ragMetadata = workflow.metadata?.rag_metadata;

  // Use DNA node progress for v2 workflows, otherwise use legacy stages
  if (isV2Workflow && dnaNodes.length > 0) {
    return (
      <DNANodeProgress 
        nodes={dnaNodes}
        currentStatus={workflow.status}
        logs={workflow.logs}
        meta={workflow.meta}
      />
    );
  }

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

