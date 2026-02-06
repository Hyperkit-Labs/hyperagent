/**
 * Workflow Data Adapter
 * 
 * Adapts backend API workflow data format to frontend UI workflow format
 */

import type { Workflow as ApiWorkflow } from '@/lib/types';

// Frontend UI workflow format (from workflow-stable.tsx)
export interface UIWorkflow {
  id: string;
  name: string;
  category: string;
  categoryIcon: string;
  runId: string;
  status: 'running' | 'success' | 'failed' | 'queued';
  triggeredBy: {
    type: 'user' | 'system';
    name: string;
    avatar?: string;
  };
  duration: string;
  progress?: number;
}

/**
 * Maps API workflow status to UI status
 */
function mapStatus(apiStatus: string): UIWorkflow['status'] {
  const statusMap: Record<string, UIWorkflow['status']> = {
    completed: 'success',
    success: 'success',
    failed: 'failed',
    error: 'failed',
    generating: 'running',
    compiling: 'running',
    auditing: 'running',
    testing: 'running',
    deploying: 'running',
    processing: 'running',
    pending: 'queued',
    queued: 'queued',
  };
  
  return statusMap[apiStatus.toLowerCase()] || 'queued';
}

/**
 * Gets workflow category based on current stage or status
 */
function getCategory(workflow: ApiWorkflow): { category: string; icon: string } {
  const stages = workflow.stages || [];
  const currentStage = stages.find(s => s.status === 'running' || s.status === 'pending');
  
  if (currentStage) {
    const stageMap: Record<string, { category: string; icon: string }> = {
      generation: { category: 'Generation', icon: 'bot' },
      compilation: { category: 'Compilation', icon: 'database' },
      audit: { category: 'Security', icon: 'shield' },
      testing: { category: 'Testing', icon: 'flask-conical' },
      deployment: { category: 'Deployment', icon: 'upload-cloud' },
    };
    
    return stageMap[currentStage.stage] || { category: 'Workflow', icon: 'shield' };
  }
  
  if (workflow.status === 'completed' || workflow.status === 'success') {
    return { category: 'Completed', icon: 'upload-cloud' };
  }
  
  if (workflow.status === 'failed' || workflow.status === 'error') {
    return { category: 'Failed', icon: 'shield' };
  }
  
  return { category: 'Workflow', icon: 'shield' };
}

/**
 * Calculates duration from created_at and updated_at timestamps
 */
function calculateDuration(createdAt?: string, updatedAt?: string): string {
  if (!createdAt) return 'N/A';
  
  const start = new Date(createdAt);
  const end = updatedAt ? new Date(updatedAt) : new Date();
  const durationMs = end.getTime() - start.getTime();
  
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Calculates overall workflow progress percentage
 */
function calculateProgress(workflow: ApiWorkflow): number | undefined {
  const stages = workflow.stages || [];
  if (stages.length === 0) return undefined;
  
  const completedStages = stages.filter(s => s.status === 'completed' || s.status === 'success').length;
  const progress = Math.round((completedStages / stages.length) * 100);
  
  return progress;
}

/**
 * Gets triggered by information
 */
function getTriggeredBy(workflow: ApiWorkflow): UIWorkflow['triggeredBy'] {
  // Extract user info from workflow metadata if available
  const walletAddress = workflow.wallet_address;
  
  if (walletAddress) {
    return {
      type: 'user',
      name: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      avatar: walletAddress.slice(2, 4).toUpperCase(),
    };
  }
  
  return {
    type: 'system',
    name: 'HyperAgent',
    avatar: 'HA',
  };
}

/**
 * Converts API workflow to UI workflow format
 */
export function adaptWorkflow(apiWorkflow: ApiWorkflow): UIWorkflow {
  const { category, icon } = getCategory(apiWorkflow);
  const status = mapStatus(apiWorkflow.status);
  const progress = status === 'running' ? calculateProgress(apiWorkflow) : undefined;
  
  return {
    id: apiWorkflow.workflow_id,
    name: apiWorkflow.nlp_input || apiWorkflow.intent || 'Workflow',
    category,
    categoryIcon: icon,
    runId: `#${apiWorkflow.workflow_id?.slice(0, 8) || 'unknown'}`,
    status,
    triggeredBy: getTriggeredBy(apiWorkflow),
    duration: calculateDuration(apiWorkflow.created_at, apiWorkflow.updated_at),
    progress,
  };
}

/**
 * Converts array of API workflows to UI workflows
 */
export function adaptWorkflows(apiWorkflows: ApiWorkflow[]): UIWorkflow[] {
  return apiWorkflows.map(adaptWorkflow);
}

