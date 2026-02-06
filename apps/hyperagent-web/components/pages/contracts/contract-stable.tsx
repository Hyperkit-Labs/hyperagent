import React, { useState, useEffect } from 'react';
import { ContractTableHeader } from '@/components/pages/contracts/tale-header';
import { ContractTableRow } from '@/components/pages/contracts/table-row';
import { ContractTablePagination } from '@/components/pages/contracts/table-pagination';
import { useContracts } from '@/hooks/useContracts';
import { formatDistanceToNow } from 'date-fns';

export interface Contract {
  id: string;
  name: string;
  address: string;
  icon: string;
  iconColor: string;
  network: {
    name: string;
    color: string;
  };
  verification: 'verified' | 'unverified' | 'deprecated';
  balance: {
    amount: string;
    usd?: string;
  };
  lastActivity: {
    time: string;
    action: string;
  };
  isDeprecated?: boolean;
}

const getNetworkColor = (network: string): string => {
  const colors: Record<string, string> = {
    'mantle': '#000000',
    'mantle-testnet': '#000000',
    'avalanche': '#E84142',
    'avalanche-fuji': '#E84142',
    'arbitrum': '#28A0F0',
    'arbitrum-sepolia': '#28A0F0',
    'base': '#0052FF',
    'base-sepolia': '#0052FF',
    'bnb': '#F0B90B',
    'bnb-testnet': '#F0B90B',
    'ethereum': '#627EEA',
    'sepolia': '#627EEA',
  };
  return colors[network.toLowerCase()] || '#94a3b8';
};

const getContractIcon = (intent: string): string => {
  if (intent.toLowerCase().includes('nft') || intent.toLowerCase().includes('erc721')) return 'image';
  if (intent.toLowerCase().includes('token') || intent.toLowerCase().includes('erc20')) return 'coins';
  if (intent.toLowerCase().includes('stake') || intent.toLowerCase().includes('vault')) return 'lock';
  if (intent.toLowerCase().includes('dao') || intent.toLowerCase().includes('governance')) return 'users';
  return 'file-code';
};

const getIconColor = (network: string): string => {
  const colors: Record<string, string> = {
    'mantle': 'from-slate-900/50 to-slate-800/30 border-slate-500/20 text-slate-400',
    'avalanche': 'from-red-900/50 to-red-800/30 border-red-500/20 text-red-400',
    'arbitrum': 'from-blue-900/50 to-blue-800/30 border-blue-500/20 text-blue-400',
    'base': 'from-blue-900/50 to-indigo-900/30 border-blue-500/20 text-blue-400',
    'bnb': 'from-yellow-900/50 to-yellow-800/30 border-yellow-500/20 text-yellow-400',
    'ethereum': 'from-indigo-900/50 to-indigo-800/30 border-indigo-500/20 text-indigo-400',
  };
  const baseNetwork = network.toLowerCase().split('-')[0];
  return colors[baseNetwork] || 'from-slate-800 to-slate-700 border-white/10 text-slate-400';
};

export const ContractsTable: React.FC = () => {
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const resultsPerPage = 10;

  const { contracts: contractData, loading: contractsLoading } = useContracts({ autoRefresh: true });

  useEffect(() => {
    if (!contractsLoading && contractData) {
      const contractsData: Contract[] = contractData.map((c) => ({
        id: c.id,
        name: c.name,
        address: c.address ? 
          `${c.address.substring(0, 5)}...${c.address.slice(-4)}` : 
          '0x...',
        icon: getContractIcon(c.name),
        iconColor: getIconColor(c.network),
        network: {
          name: c.network,
          color: getNetworkColor(c.network),
        },
        verification: c.verified ? 'verified' : 'unverified',
        balance: {
          amount: `${c.network?.includes('testnet') ? 'Testnet' : '0.00'} ${c.network?.includes('avalanche') ? 'AVAX' : c.network?.includes('bnb') ? 'BNB' : c.network?.includes('mantle') ? 'MNT' : 'ETH'}`,
          usd: c.network?.includes('testnet') ? 'Testnet' : '$0.00',
        },
        lastActivity: {
          time: c.deployedAt ? formatDistanceToNow(new Date(c.deployedAt), { addSuffix: true }) : 'Unknown',
          action: 'Deploy()',
        },
      }));
      setContracts(contractsData);
      setLoading(false);
    }
  }, [contractsLoading, contractData]);

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedContracts(new Set());
    } else {
      setSelectedContracts(new Set(contracts.map((c) => c.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectContract = (id: string) => {
    const newSelected = new Set(selectedContracts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedContracts(newSelected);
    setSelectAll(newSelected.size === contracts.length);
  };

  // Pagination
  const totalPages = Math.ceil(contracts.length / resultsPerPage);
  const startIndex = (currentPage - 1) * resultsPerPage;
  const endIndex = startIndex + resultsPerPage;
  const currentContracts = contracts.slice(startIndex, endIndex);

  return (
    <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
      <ContractTableHeader selectAll={selectAll} onSelectAll={handleSelectAll} />

      {/* List Items */}
      <div className="divide-y divide-white/5 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Loading contracts...</p>
            </div>
          </div>
        ) : contracts.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-slate-400 mb-2">No deployed contracts found</p>
              <p className="text-sm text-slate-500">Deploy your first contract to see it here</p>
            </div>
          </div>
        ) : (
          currentContracts.map((contract) => (
            <ContractTableRow
              key={contract.id}
              contract={contract}
              isSelected={selectedContracts.has(contract.id)}
              onSelect={() => handleSelectContract(contract.id)}
            />
          ))
        )}
      </div>

      {!loading && contracts.length > 0 && (
        <ContractTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalResults={contracts.length}
          resultsPerPage={resultsPerPage}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};