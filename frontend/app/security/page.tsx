"use client";

import React, { useState } from 'react';
import { SecurityHeader } from '@/components/pages/security/page-header';
import { SecurityStats } from '@/components/pages/security/security-stats';
import { SecurityToolbar } from '@/components/pages/security/toolbar';
import { SecurityAlertsTable } from '@/components/pages/security/security-table';

export const SecurityPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('All');
  const [selectedScope, setSelectedScope] = useState('Mainnet');

  return (
    <>
      <SecurityHeader />
      
      <SecurityStats />
      
      <SecurityToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedSeverity={selectedSeverity}
        onSeverityChange={setSelectedSeverity}
        selectedScope={selectedScope}
        onScopeChange={setSelectedScope}
      />
      
      <SecurityAlertsTable />
    </>
  );
};

export default SecurityPage;