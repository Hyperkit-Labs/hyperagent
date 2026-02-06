'use client';

import React, { useState } from 'react';
import { AgentsHeader } from '@/components/pages/agents/page-header';
import { AgentsStats } from '@/components/pages/agents/agents-stats';
import { AgentsToolbar } from '@/components/pages/agents/toolbar';
import { AgentsTable } from '@/components/pages/agents/agents-table';

export const AgentsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('Active');

  return (
    <>
      <AgentsHeader />
      
      <AgentsStats />
      
      <AgentsToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
      />
      
      <AgentsTable />
    </>
  );
};

export default AgentsPage;