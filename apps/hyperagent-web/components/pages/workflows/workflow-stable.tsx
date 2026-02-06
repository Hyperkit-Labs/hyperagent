import React, { useState } from 'react';
import { WorkflowTableHeader } from '@/components/pages/workflows/table-header';
import { WorkflowTableRow } from '@/components/pages/workflows/table-row';
import { WorkflowTablePagination } from '@/components/pages/workflows/table-pagination';
import type { Workflow as BackendWorkflow } from '@/lib/types';

export interface Workflow {
  id: string;
  name: string;
  category: string;
  categoryIcon: string;
  runId: string;
  status: 'running' | 'success' | 'failed' | 'queued';
  triggeredBy?: {
    type: 'user' | 'system';
    name: string;
    avatar?: string;
  };
  duration: string;
  progress?: number;
}

// Mock data for fallback/demo purposes
const mockWorkflowsData: Workflow[] = [
  {
    id: '1',
    name: 'Batch Contract Audit',
    category: 'Security',
    categoryIcon: 'shield',
    runId: '#run_942a',
    status: 'running',
    triggeredBy: { type: 'system', name: 'GitHub Action', avatar: 'CI' },
    duration: '2m 14s',
    progress: 60,
  },
  {
    id: '2',
    name: 'Deploy LP Staking',
    category: 'Deployment',
    categoryIcon: 'upload-cloud',
    runId: '#run_941b',
    status: 'success',
    triggeredBy: { type: 'user', name: 'jason.s', avatar: 'JS' },
    duration: '45s',
  },
  {
    id: '3',
    name: 'Integration Test Suite',
    category: 'Testing',
    categoryIcon: 'flask-conical',
    runId: '#run_940x',
    status: 'failed',
    triggeredBy: { type: 'system', name: 'Scheduled' },
    duration: '12s',
  },
  {
    id: '4',
    name: 'Generate ERC721 Assets',
    category: 'AI Generation',
    categoryIcon: 'bot',
    runId: '#run_939a',
    status: 'success',
    triggeredBy: { type: 'user', name: 'jason.s', avatar: 'JS' },
    duration: '4m 02s',
  },
  {
    id: '5',
    name: 'Cross-Chain Bridge',
    category: 'Transaction',
    categoryIcon: 'arrow-right-left',
    runId: '#run_938z',
    status: 'queued',
    triggeredBy: { type: 'system', name: 'GitHub Action', avatar: 'CI' },
    duration: '--',
  },
  {
    id: '6',
    name: 'Update Registry',
    category: 'Storage',
    categoryIcon: 'database',
    runId: '#run_938y',
    status: 'success',
    triggeredBy: { type: 'user', name: 'jason.s', avatar: 'JS' },
    duration: '8s',
  },
];

interface WorkflowsTableProps {
  workflows?: Workflow[] | BackendWorkflow[];
  loading?: boolean;
  onRefresh?: () => void;
}

// Transform backend workflow to table format
function transformBackendWorkflow(workflow: BackendWorkflow): Workflow {
  const statusMap: Record<string, 'running' | 'success' | 'failed' | 'queued'> = {
    'generating': 'running',
    'compiling': 'running',
    'auditing': 'running',
    'testing': 'running',
    'deploying': 'running',
    'processing': 'running',
    'PROCESSING': 'running',
    'completed': 'success',
    'COMPLETED': 'success',
    'success': 'success',
    'failed': 'failed',
    'FAILED': 'failed',
    'created': 'queued',
    'PENDING': 'queued',
  };

  return {
    id: workflow.workflow_id || workflow.meta?.workflowId || '',
    name: workflow.nlp_input || workflow.intent || 'Unnamed Workflow',
    category: workflow.contract_type || 'Contract',
    categoryIcon: 'file-code',
    runId: `#${workflow.workflow_id?.slice(0, 8) || 'unknown'}`,
    status: statusMap[workflow.status] || 'queued',
    triggeredBy: { type: 'user', name: 'user', avatar: 'U' },
    duration: workflow.completed_at && workflow.created_at 
      ? calculateDuration(workflow.created_at, workflow.completed_at)
      : '--',
    progress: workflow.progress_percentage,
  };
}

function calculateDuration(start: string, end: string): string {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export const WorkflowsTable: React.FC<WorkflowsTableProps> = ({ workflows, loading = false, onRefresh }) => {
  const [selectedWorkflows, setSelectedWorkflows] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const resultsPerPage = 10;
  
  // Transform backend workflows to table format
  const transformedWorkflows = workflows && workflows.length > 0
    ? workflows.map(w => {
        // Check if it's already in table format (has 'runId' property)
        if ('runId' in w) return w as Workflow;
        // Otherwise transform from backend format
        return transformBackendWorkflow(w as BackendWorkflow);
      })
    : mockWorkflowsData;
  
  // Use transformed workflows
  const workflowsData = transformedWorkflows;

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedWorkflows(new Set());
    } else {
      setSelectedWorkflows(new Set(workflowsData.map((w) => w.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectWorkflow = (id: string) => {
    const newSelected = new Set(selectedWorkflows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedWorkflows(newSelected);
    setSelectAll(newSelected.size === workflowsData.length);
  };

  // Pagination calculations
  const totalResults = workflowsData.length;
  const totalPages = Math.ceil(totalResults / resultsPerPage);
  const startIndex = (currentPage - 1) * resultsPerPage;
  const endIndex = startIndex + resultsPerPage;
  const paginatedWorkflows = workflowsData.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden flex items-center justify-center min-h-[500px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading workflows...</p>
        </div>
      </div>
    );
  }

  if (workflowsData.length === 0) {
    return (
      <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden flex items-center justify-center min-h-[500px]">
        <div className="text-center text-gray-400">
          <p className="font-semibold mb-2">No workflows found</p>
          <p className="text-sm">Create your first workflow to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
      <WorkflowTableHeader selectAll={selectAll} onSelectAll={handleSelectAll} />

      {/* List Items */}
      <div className="divide-y divide-white/5">
        {paginatedWorkflows.map((workflow) => (
          <WorkflowTableRow
            key={workflow.id}
            workflow={workflow}
            isSelected={selectedWorkflows.has(workflow.id)}
            onSelect={() => handleSelectWorkflow(workflow.id)}
          />
        ))}
      </div>

      <WorkflowTablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalResults={totalResults}
        resultsPerPage={resultsPerPage}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};