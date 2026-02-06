/**
 * Dashboard Overview Page
 * Main entry point - displays system metrics and recent activity
 * Uses real data from backend with error boundaries and loading states
 */

'use client';

import React from 'react';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageHeader } from '@/components/pages/overview/page-header';
import { KPIGrid } from '@/components/pages/overview/kpi-grid';
import { RecentWorkflows } from '@/components/pages/overview/recent-workflows';
import { SecurityStatus } from '@/components/pages/overview/security-status';
import { RecentDeployments } from '@/components/pages/overview/recent-deployments';
import { TestCoverage } from '@/components/pages/overview/test-coverage';
import { useMetrics } from '@/hooks/useMetrics';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useDeployments } from '@/hooks/useDeployments';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

export default function DashboardPage() {
  // Fetch real-time metrics
  const { metrics, loading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useMetrics({
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
  });

  // Fetch recent workflows
  const { 
    workflows, 
    loading: workflowsLoading, 
    error: workflowsError,
    refetch: refetchWorkflows 
  } = useWorkflows({
    autoRefresh: true,
    refreshInterval: 30000,
    filters: { limit: 5 },
  });

  // Fetch recent deployments
  const { 
    deployments, 
    loading: deploymentsLoading, 
    error: deploymentsError,
    refetch: refetchDeployments 
  } = useDeployments({
    autoRefresh: true,
    refreshInterval: 45000,
  });

  const recentDeployments = deployments.slice(0, 5);

  // Handle global errors
  if (metricsError || workflowsError || deploymentsError) {
    return (
      <div className="space-y-8">
        <PageHeader />
        <div className="space-y-4">
          {metricsError && (
            <ErrorAlert
              title="Failed to load metrics"
              message={metricsError}
              severity="error"
              action={{
                label: 'Retry',
                onClick: refetchMetrics,
              }}
            />
          )}
          {workflowsError && (
            <ErrorAlert
              title="Failed to load workflows"
              message={workflowsError}
              severity="error"
              action={{
                label: 'Retry',
                onClick: refetchWorkflows,
              }}
            />
          )}
          {deploymentsError && (
            <ErrorAlert
              title="Failed to load deployments"
              message={deploymentsError}
              severity="error"
              action={{
                label: 'Retry',
                onClick: refetchDeployments,
              }}
            />
          )}
        </div>
      </div>
    );
  }

  // Loading state
  const isLoading = metricsLoading || workflowsLoading || deploymentsLoading;

  if (isLoading && !metrics) {
    return (
      <div className="space-y-8">
        <PageHeader />
        <LoadingState 
          variant="skeleton" 
          message="Loading dashboard..."
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-8">
        <PageHeader />
        
        {/* KPI Grid with real metrics */}
        <ErrorBoundary fallback={<ErrorAlert message="Failed to load KPI metrics" severity="warning" />}>
          <KPIGrid metrics={metrics} />
        </ErrorBoundary>

        {/* Test Coverage and Security Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Test Coverage */}
          <ErrorBoundary fallback={<ErrorAlert message="Failed to load test coverage" severity="warning" />}>
            <TestCoverage />
          </ErrorBoundary>

          {/* Security Status */}
          <ErrorBoundary fallback={<ErrorAlert message="Failed to load security status" severity="warning" />}>
            <SecurityStatus 
              metrics={metrics}
              loading={metricsLoading}
            />
          </ErrorBoundary>
        </div>

        {/* Recent Workflows and Recent Deployments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Workflows */}
          <ErrorBoundary fallback={<ErrorAlert message="Failed to load workflows" severity="warning" />}>
            <RecentWorkflows 
              workflows={workflows}
              loading={workflowsLoading}
            />
          </ErrorBoundary>

          {/* Recent Deployments */}
          <ErrorBoundary fallback={<ErrorAlert message="Failed to load deployments" severity="warning" />}>
            <RecentDeployments 
              deployments={recentDeployments}
              loading={deploymentsLoading}
            />
          </ErrorBoundary>
        </div>
      </div>
    </ErrorBoundary>
  );
}
