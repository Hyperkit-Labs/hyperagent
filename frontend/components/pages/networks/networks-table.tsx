import React from 'react';
import { NetworkTableHeader } from '@/components/pages/networks/table-header';
import { NetworkTableRow } from '@/components/pages/networks/table-row';
import { NetworkTableFooter } from '@/components/pages/networks/table-footer';
import { useNetworks } from '@/hooks/useNetworks';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

export interface Network {
  id: string;
  name: string;
  currency: string;
  rpcUrl: string;
  icon: string;
  iconColor: string;
  chainId: string;
  type: 'Mainnet' | 'L2 Rollup' | 'Devnet' | 'Testnet';
  status: 'operational' | 'degraded' | 'disconnected';
  latency: string;
  latencyPercentage: number;
  blockInfo?: string;
  enabled: boolean;
  isDisabled?: boolean;
}

// Transform backend network to frontend format
function transformNetwork(backendNetwork: any, index: number): Network {
  const getNetworkType = (networkId: string): string => {
    if (networkId.includes('testnet') || networkId.includes('fuji') || networkId.includes('sepolia')) {
      return 'Testnet';
    }
    if (networkId.includes('mainnet')) {
      return 'Mainnet';
    }
    return 'L2 Rollup';
  };

  const getIcon = (networkId: string): string => {
    if (networkId.includes('ethereum')) return 'hexagon';
    if (networkId.includes('polygon')) return 'triangle';
    if (networkId.includes('arbitrum')) return 'layers';
    if (networkId.includes('optimism')) return 'zap';
    if (networkId.includes('avalanche') || networkId.includes('avax')) return 'snowflake';
    if (networkId.includes('mantle')) return 'circle';
    return 'network';
  };

  const getIconColor = (networkId: string): string => {
    if (networkId.includes('ethereum')) return '#627EEA';
    if (networkId.includes('polygon')) return '#8247E5';
    if (networkId.includes('arbitrum')) return '#28A0F0';
    if (networkId.includes('optimism')) return '#FF0420';
    if (networkId.includes('avalanche') || networkId.includes('avax')) return '#E84142';
    if (networkId.includes('mantle')) return '#000000';
    return '#94a3b8';
  };

  return {
    id: backendNetwork.network || `network-${index}`,
    name: backendNetwork.network || 'Unknown Network',
    currency: backendNetwork.currency || 'ETH',
    rpcUrl: backendNetwork.rpc_url || '',
    icon: getIcon(backendNetwork.network || ''),
    iconColor: getIconColor(backendNetwork.network || ''),
    chainId: backendNetwork.chain_id?.toString() || '0',
    type: getNetworkType(backendNetwork.network || ''),
    status: backendNetwork.is_supported ? 'operational' : 'degraded',
    latency: '-- latency', // TODO: Get from metrics API
    latencyPercentage: 0, // TODO: Get from metrics API
    blockInfo: undefined, // TODO: Get from RPC
    enabled: backendNetwork.is_supported !== false,
    isDisabled: backendNetwork.is_supported === false,
  };
}

export const NetworksTable: React.FC = () => {
  const { networks, loading, error, refetch, total } = useNetworks({
    autoRefresh: true,
    refreshInterval: 120000, // 2 minutes
  });

  const transformedNetworks = networks.map(transformNetwork);

  if (loading && transformedNetworks.length === 0) {
    return (
      <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
        <NetworkTableHeader />
        <div className="flex-1 flex items-center justify-center">
          <LoadingState message="Loading networks..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
        <NetworkTableHeader />
        <div className="p-4">
          <ErrorAlert message={error} severity="error" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
      <NetworkTableHeader />

      {loading && transformedNetworks.length > 0 && (
        <div className="p-3 bg-violet-500/10 border-b border-violet-500/20 flex items-center gap-2 text-sm text-violet-400">
          <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Refreshing networks...</span>
        </div>
      )}

      {/* List Items */}
      <div className="divide-y divide-white/5">
        {transformedNetworks.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400">No networks found</p>
          </div>
        ) : (
          transformedNetworks.map((network) => (
          <NetworkTableRow key={network.id} network={network} />
          ))
        )}
      </div>

      <NetworkTableFooter totalNetworks={total || transformedNetworks.length} />
    </div>
  );
};