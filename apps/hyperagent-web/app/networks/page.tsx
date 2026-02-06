'use client';

import React, { useState } from 'react';
import { NetworksHeader } from '@/components/pages/networks/page-header';
import { NetworksStats } from '@/components/pages/networks/networks-stats';
import { NetworksToolbar } from '@/components/pages/networks/toolbar';
import { NetworksTable } from '@/components/pages/networks/networks-table';

export const NetworksPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedHealth, setSelectedHealth] = useState('All');

  return (
    <>
      <NetworksHeader />
      
      <NetworksStats />
      
      <NetworksToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedHealth={selectedHealth}
        onHealthChange={setSelectedHealth}
      />
      
      <NetworksTable />
    </>
  );
};

export default NetworksPage;