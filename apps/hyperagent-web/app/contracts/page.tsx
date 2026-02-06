'use client';

import React, { useState } from 'react';
import { ContractsHeader } from '@/components/pages/contracts/page-header';
import { ContractsToolbar } from '@/components/pages/contracts/toolbar';
import { ContractsTable } from '@/components/pages/contracts/contract-stable';

export const ContractsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('Verified');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  return (
    <>
      <ContractsHeader />
      
      <ContractsToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedNetwork={selectedNetwork}
        onNetworkChange={setSelectedNetwork}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
      
      <ContractsTable />
    </>
  );
};

export default ContractsPage;