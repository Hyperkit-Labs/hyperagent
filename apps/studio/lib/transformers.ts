/**
 * Transform API workflow data to deployment and contract views.
 */

import type { Workflow } from '@/lib/types';

export interface Deployment {
  id: string;
  workflowId: string;
  status: 'success' | 'failed' | 'pending';
  network?: string;
  contractAddress?: string;
  transactionHash?: string;
  duration?: number;
  gasUsed?: number;
  createdAt?: string;
}

export interface Contract {
  id: string;
  workflowId: string;
  network?: string;
  address?: string;
  verified?: boolean;
  transactionHash?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export function transformWorkflowToDeployment(w: Workflow): Deployment | Deployment[] | null {
  const deploymentsList = w.deployments;
  if (Array.isArray(deploymentsList) && deploymentsList.length > 0) {
    return deploymentsList.map((d, i) => ({
      id: `${w.workflow_id}-${i}`,
      workflowId: w.workflow_id,
      status: (w.status === 'completed' ? 'success' : w.status === 'failed' ? 'failed' : 'pending') as 'success' | 'failed' | 'pending',
      network: d.network ?? w.network,
      contractAddress: d.contract_address,
      transactionHash: d.transaction_hash,
      createdAt: d.created_at ?? w.updated_at ?? w.created_at,
    }));
  }
  const meta = (w as { deployment_address?: string; deploymentAddress?: string; meta?: { deployment_address?: string }; transaction_hash?: string }) as Workflow & {
    deployment_address?: string;
    deploymentAddress?: string;
    meta?: { deployment_address?: string };
    transaction_hash?: string;
  };
  const addr = meta.deployment_address ?? meta.deploymentAddress ?? meta.meta?.deployment_address;
  if (!addr && w.status !== 'completed' && w.status !== 'failed' && w.status !== 'deploying') return null;
  return {
    id: w.workflow_id,
    workflowId: w.workflow_id,
    status: w.status === 'completed' ? 'success' : w.status === 'failed' ? 'failed' : 'pending',
    network: w.network,
    contractAddress: addr,
    transactionHash: meta.transaction_hash,
    createdAt: w.updated_at ?? w.created_at,
  };
}

export function transformWorkflowToContract(w: Workflow): Contract | Contract[] | null {
  const deploymentsList = w.deployments;
  if (Array.isArray(deploymentsList) && deploymentsList.length > 0) {
    return deploymentsList.map((d, i) => ({
      id: `${w.workflow_id}-${i}`,
      workflowId: w.workflow_id,
      network: d.network ?? w.network,
      address: d.contract_address,
      verified: w.status === 'completed',
      transactionHash: d.transaction_hash,
      createdAt: d.created_at ?? w.updated_at ?? w.created_at,
    }));
  }
  const meta = (w as { deployment_address?: string; deploymentAddress?: string; transaction_hash?: string }) as Workflow & { deployment_address?: string; deploymentAddress?: string; transaction_hash?: string };
  const addr = meta.deployment_address ?? meta.deploymentAddress;
  if (!addr && w.status !== 'completed') return null;
  return {
    id: w.workflow_id,
    workflowId: w.workflow_id,
    network: w.network,
    address: addr,
    verified: w.status === 'completed',
    transactionHash: meta.transaction_hash,
    createdAt: w.updated_at ?? w.created_at,
  };
}
