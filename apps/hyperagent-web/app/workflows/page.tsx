/**
 * Workflows Page
 * Displays list of all workflows with filtering and real-time updates
 * Uses real data from backend with error handling
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { LoadingState, TableSkeleton } from '@/components/ui/LoadingState';
import { ErrorAlert, EmptyState } from '@/components/ui/ErrorAlert';
import { WorkflowsHeader } from '@/components/pages/workflows/page-header';
import { WorkflowsToolbar } from '@/components/pages/workflows/toolbar';
import { WorkflowsTable } from '@/components/pages/workflows/workflow-stable';
import { useWorkflows } from '@/hooks/useWorkflows';

export default function WorkflowsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Fetch workflows with real-time updates
  const { 
    workflows, 
    loading, 
    error, 
    refetch, 
    isEmpty,
    total
  } = useWorkflows({
    autoRefresh: true,
    refreshInterval: 15000, // 15 seconds for faster updates
    filters: {
      status: statusFilter === 'all' ? undefined : statusFilter,
    },
  });

  // Client-side search filter
  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = searchTerm === '' || 
      workflow.nlp_input?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workflow.workflow_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  // Error state
  if (error) {
    return (
      <ErrorBoundary>
        <div className="space-y-8">
          <WorkflowsHeader />
          <ErrorAlert
            title="Failed to load workflows"
            message={error}
            severity="error"
            action={{
              label: 'Retry',
              onClick: refetch,
            }}
          />
        </div>
      </ErrorBoundary>
    );
  }

  // Initial loading state
  if (loading && workflows.length === 0) {
    return (
      <ErrorBoundary>
        <div className="space-y-8">
          <WorkflowsHeader />
          <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl p-6">
            <TableSkeleton rows={10} />
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Empty state
  if (isEmpty && !loading) {
    return (
      <ErrorBoundary>
        <div className="space-y-8">
          <WorkflowsHeader />
          <EmptyState
            title="No workflows yet"
            message="Create your first workflow to get started with smart contract development."
            action={{
              label: 'Create Workflow',
              onClick: () => window.location.href = '/workflows/create',
            }}
          />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-8">
        <WorkflowsHeader />

        {/* Toolbar with filters and actions */}
        <WorkflowsToolbar
          searchQuery={searchTerm}
          onSearchChange={setSearchTerm}
          selectedStatus={statusFilter}
          onStatusChange={setStatusFilter}
          selectedProject="All"
          onProjectChange={() => {}}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Workflows Table */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden">
          {loading && workflows.length > 0 && (
            <div className="p-3 bg-violet-500/10 border-b border-violet-500/20 flex items-center gap-2 text-sm text-violet-400">
              <LoadingState variant="minimal" message="Refreshing..." />
            </div>
          )}

          <WorkflowsTable 
            workflows={filteredWorkflows}
            onRefresh={refetch}
          />

          {filteredWorkflows.length === 0 && !loading && (
            <div className="p-12 text-center">
              <p className="text-slate-400">
                No workflows match your filters.
              </p>
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setSearchTerm('');
                }}
                className="mt-4 text-violet-400 hover:text-violet-300 text-sm font-medium"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Create New Workflow Button - Fixed position */}
        <Link
          href="/workflows/create"
          className="fixed bottom-8 right-8 px-6 py-3 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white rounded-xl font-medium shadow-lg hover:shadow-xl hover:shadow-violet-500/25 transition-all duration-200 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Workflow
        </Link>
      </div>
    </ErrorBoundary>
  );
}
