'use client';

import React, { useState } from 'react';
import { AnalyticsHeader } from '@/components/pages/analytics/page-header';
import { AnalyticsStats } from '@/components/pages/analytics/analytics-stats';
import { AnalyticsToolbar } from '@/components/pages/analytics/toolbar';
import { AnalyticsChart } from '@/components/pages/analytics/analytics-chart';
import { AnalyticsAgentsTable } from '@/components/pages/analytics/agent-table';
import { AnalyticsNetworkDistribution } from '@/components/pages/analytics/network-distribution';

export const AnalyticsPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedNetwork, setSelectedNetwork] = useState('All');
  const [viewMode, setViewMode] = useState<'overview' | 'detailed'>('overview');

  return (
    <>
      <AnalyticsHeader />

      <AnalyticsToolbar
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        selectedNetwork={selectedNetwork}
        onNetworkChange={setSelectedNetwork}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* KPI Grid */}
      <AnalyticsStats />

      {/* Main Chart */}
      <AnalyticsChart />

      {/* Lower Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AnalyticsAgentsTable />
        <AnalyticsNetworkDistribution />
      </div>
    </>
  );
};

export default AnalyticsPage;
