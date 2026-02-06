'use client';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

/**
 * DNA Blueprint Node Types (7 nodes)
 * These match the spec-locked orchestrator nodes
 */
export type DNANodeType = 
  | 'policy'      // Intent validation and compliance
  | 'generate'    // LLM-based contract generation
  | 'audit'       // Security analysis (Slither + LLM)
  | 'validate'    // Schema validation and routing
  | 'deploy'      // Thirdweb deployment
  | 'eigenda'     // IPFS proof storage
  | 'monitor';    // Event monitoring + memory save

export interface DNANodeStatus {
  node: DNANodeType;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  message?: string;
  details?: any;
  timestamp?: string;
}

interface DNANodeProgressProps {
  nodes: DNANodeStatus[];
  currentStatus?: string;
  logs?: string[];
  meta?: {
    workflowId?: string;
    ipfsCid?: string;
    chains?: { selected: string; requested: string[] };
  };
}

const DNA_NODES: Array<{ key: DNANodeType; label: string; description: string; icon: string }> = [
  { 
    key: 'policy', 
    label: 'Policy', 
    description: 'Intent validation and compliance checking',
    icon: '🛡️'
  },
  { 
    key: 'generate', 
    label: 'Generate', 
    description: 'LLM-based contract code generation',
    icon: '✨'
  },
  { 
    key: 'audit', 
    label: 'Audit', 
    description: 'Security analysis with Slither and LLM',
    icon: '🔍'
  },
  { 
    key: 'validate', 
    label: 'Validate', 
    description: 'Schema validation and routing decision',
    icon: '✅'
  },
  { 
    key: 'deploy', 
    label: 'Deploy', 
    description: 'Thirdweb smart contract deployment',
    icon: '🚀'
  },
  { 
    key: 'eigenda', 
    label: 'EigenDA', 
    description: 'IPFS proof storage and commitment',
    icon: '🔗'
  },
  { 
    key: 'monitor', 
    label: 'Monitor', 
    description: 'Event monitoring and memory storage',
    icon: '📊'
  },
];

export function DNANodeProgress({ nodes, currentStatus, logs, meta }: DNANodeProgressProps) {
  // Create a map of node statuses
  const nodeStatusMap = new Map(nodes.map(n => [n.node, n]));
  
  // Calculate overall progress
  const completedNodes = nodes.filter(n => n.status === 'completed').length;
  const totalNodes = DNA_NODES.length;
  const progress = Math.round((completedNodes / totalNodes) * 100);

  // Determine current node from status or logs
  const getCurrentNode = (): DNANodeType | null => {
    if (currentStatus) {
      const statusLower = currentStatus.toLowerCase();
      if (statusLower.includes('policy')) return 'policy';
      if (statusLower.includes('generat')) return 'generate';
      if (statusLower.includes('audit')) return 'audit';
      if (statusLower.includes('validat')) return 'validate';
      if (statusLower.includes('deploy')) return 'deploy';
      if (statusLower.includes('eigenda')) return 'eigenda';
      if (statusLower.includes('monitor')) return 'monitor';
    }
    
    // Try to infer from logs
    if (logs && logs.length > 0) {
      const lastLog = logs[logs.length - 1].toLowerCase();
      if (lastLog.includes('[policy]')) return 'policy';
      if (lastLog.includes('[generate]')) return 'generate';
      if (lastLog.includes('[audit]')) return 'audit';
      if (lastLog.includes('[validate]')) return 'validate';
      if (lastLog.includes('[deploy]')) return 'deploy';
      if (lastLog.includes('[eigenda]')) return 'eigenda';
      if (lastLog.includes('[monitor]')) return 'monitor';
    }
    
    return null;
  };

  const currentNode = getCurrentNode();
  const currentIndex = currentNode ? DNA_NODES.findIndex(n => n.key === currentNode) : -1;

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">DNA Blueprint Progress</h3>
            <p className="text-xs text-gray-400 mt-1">Spec-locked orchestrator nodes</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-400">{progress}%</div>
            <div className="text-xs text-gray-400">{completedNodes}/{totalNodes} nodes</div>
          </div>
        </div>

        <ProgressBar progress={progress} />

        {/* IPFS CID Display (EigenDA node) */}
        {meta?.ipfsCid && (
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-purple-400">🔗 IPFS CID:</span>
              <code className="text-xs text-purple-300 font-mono">{meta.ipfsCid}</code>
              <a
                href={`https://ipfs.io/ipfs/${meta.ipfsCid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-400 hover:text-purple-300 underline ml-auto"
              >
                View on IPFS
              </a>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {DNA_NODES.map((nodeDef, index) => {
            const nodeStatus = nodeStatusMap.get(nodeDef.key);
            const isCompleted = nodeStatus?.status === 'completed' || 
                              (currentIndex > index && !nodeStatus);
            const isCurrent = currentNode === nodeDef.key || 
                             (currentIndex === index && !isCompleted);
            const isFailed = nodeStatus?.status === 'failed';
            const isSkipped = nodeStatus?.status === 'skipped';

            return (
              <div
                key={nodeDef.key}
                className={`flex items-start gap-3 p-3 rounded-xl transition-all duration-200 ${
                  isCurrent 
                    ? 'bg-blue-500/10 border border-blue-500/20' 
                    : isCompleted 
                    ? 'bg-green-500/10 border border-green-500/20' 
                    : isFailed
                    ? 'bg-red-500/10 border border-red-500/20'
                    : isSkipped
                    ? 'bg-gray-500/10 border border-gray-500/20 opacity-50'
                    : 'bg-white/5 border border-white/10'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all flex-shrink-0 ${
                    isCompleted
                      ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                      : isFailed
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                      : isCurrent
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 animate-pulse'
                      : isSkipped
                      ? 'bg-gray-600 text-gray-400'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {isCompleted ? '✓' : isFailed ? '✗' : nodeDef.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${
                      isCurrent 
                        ? 'text-blue-400' 
                        : isCompleted 
                        ? 'text-green-400' 
                        : isFailed
                        ? 'text-red-400'
                        : isSkipped
                        ? 'text-gray-500'
                        : 'text-gray-400'
                    }`}>
                      {nodeDef.label}
                    </span>
                    {nodeStatus?.status && (
                      <Badge 
                        variant={
                          nodeStatus.status === 'completed' ? 'success' :
                          nodeStatus.status === 'failed' ? 'danger' :
                          nodeStatus.status === 'processing' ? 'info' :
                          'default'
                        }
                        className="text-xs"
                      >
                        {nodeStatus.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{nodeDef.description}</p>
                  
                  {/* Node-specific details */}
                  {nodeStatus?.message && (
                    <p className={`text-xs mt-1 ${
                      isFailed ? 'text-red-300' : 'text-gray-400'
                    }`}>
                      {nodeStatus.message}
                    </p>
                  )}
                  
                  {/* Policy node: Show validation results */}
                  {nodeDef.key === 'policy' && nodeStatus?.details?.violations && (
                    <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs">
                      <span className="text-yellow-400 font-medium">Policy Violations:</span>
                      <ul className="list-disc list-inside mt-1 text-yellow-300">
                        {nodeStatus.details.violations.map((v: string, i: number) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Validate node: Show validation results */}
                  {nodeDef.key === 'validate' && nodeStatus?.details?.errors && (
                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs">
                      <span className="text-red-400 font-medium">Validation Errors:</span>
                      <ul className="list-disc list-inside mt-1 text-red-300">
                        {nodeStatus.details.errors.map((e: string, i: number) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Audit node: Show findings */}
                  {nodeDef.key === 'audit' && nodeStatus?.details?.findings && (
                    <div className="mt-2 p-2 bg-orange-500/10 border border-orange-500/20 rounded text-xs">
                      <span className="text-orange-400 font-medium">Audit Findings:</span>
                      <span className="ml-2 text-orange-300">
                        {nodeStatus.details.findings.length} issue(s) found
                      </span>
                    </div>
                  )}
                  
                  {/* Monitor node: Show storage confirmation */}
                  {nodeDef.key === 'monitor' && nodeStatus?.details?.storage && (
                    <div className="mt-2 p-2 bg-green-500/10 border border-green-500/20 rounded text-xs">
                      <span className="text-green-400 font-medium">Storage:</span>
                      <span className="ml-2 text-green-300">
                        {nodeStatus.details.storage.chroma ? '✓ Chroma' : ''}
                        {nodeStatus.details.storage.ipfs ? ' ✓ IPFS' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Logs */}
        {logs && logs.length > 0 && (
          <div className="mt-4 p-3 bg-gray-800/50 border border-gray-700/50 rounded-xl">
            <h4 className="text-xs font-semibold text-gray-400 mb-2">Recent Logs</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {logs.slice(-5).map((log, idx) => (
                <div key={idx} className="text-xs text-gray-500 font-mono">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

