'use client';

import React, { useState } from 'react';
import { DeploymentsHeader } from '@/components/pages/deployments/page-header';
import { DeploymentsStats } from '@/components/pages/deployments/deployments-stats';
import { DeploymentsToolbar } from '@/components/pages/deployments/toolbar';
import { DeploymentsTable } from '@/components/pages/deployments/deployments-stable';

export const DeploymentsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEnv, setSelectedEnv] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  return (
    <>
      <DeploymentsHeader />
      
      <DeploymentsStats />
      
      <DeploymentsToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedEnv={selectedEnv}
        onEnvChange={setSelectedEnv}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
      />
      
      <DeploymentsTable />
    </>
  );
};

export default DeploymentsPage;