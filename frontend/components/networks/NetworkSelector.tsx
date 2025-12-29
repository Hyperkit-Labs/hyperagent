'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface Network {
  network: string;
  name: string;
  chain_id?: number;
  rpc_url?: string;
  explorer?: string;
  currency?: string;
  features?: Record<string, boolean>;
  supports_x402?: boolean;
  is_testnet?: boolean;
}

interface NetworkSelectorProps {
  value: string;
  onChange: (network: string) => void;
  showFeatures?: boolean;
  testnetOnly?: boolean;
  mainnetOnly?: boolean;
  x402Only?: boolean;
}

export function NetworkSelector({
  value,
  onChange,
  showFeatures = true,
  testnetOnly = false,
  mainnetOnly = false,
  x402Only = false,
}: NetworkSelectorProps) {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const limit = 50;

  // Fetch networks with pagination and filters
  useEffect(() => {
    const fetchNetworks = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });

        if (searchQuery) {
          params.append('search', searchQuery);
        }

        if (testnetOnly) {
          params.append('testnet_only', 'true');
        } else if (mainnetOnly) {
          params.append('mainnet_only', 'true');
        }

        if (x402Only) {
          params.append('x402_enabled', 'true');
        }

        const response = await fetch(`${API_BASE_URL}/networks?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Failed to fetch networks');
        }

        const data = await response.json();
        setNetworks(data.networks || []);
        setHasMore(data.has_next || false);
        setTotal(data.total || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load networks');
      } finally {
        setLoading(false);
      }
    };

    fetchNetworks();
  }, [page, searchQuery, testnetOnly, mainnetOnly, x402Only]);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page on search
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter networks by search query
  const filteredNetworks = useMemo(() => {
    if (!debouncedSearch) return networks;

    const query = debouncedSearch.toLowerCase();
    return networks.filter(
      (net) =>
        net.network.toLowerCase().includes(query) ||
        net.name.toLowerCase().includes(query) ||
        net.currency?.toLowerCase().includes(query) ||
        net.chain_id?.toString().includes(query)
    );
  }, [networks, debouncedSearch]);

  // Group networks by mainnet/testnet
  const groupedNetworks = useMemo(() => {
    const mainnets: Network[] = [];
    const testnets: Network[] = [];

    filteredNetworks.forEach((net) => {
      if (net.is_testnet) {
        testnets.push(net);
      } else {
        mainnets.push(net);
      }
    });

    return { mainnets, testnets };
  }, [filteredNetworks]);

  const getFeatureBadges = (network: Network) => {
    if (!showFeatures || !network.features) return null;

    const badges: Array<{ label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'gradient' }> = [];
    if (network.features.pef) badges.push({ label: 'PEF', variant: 'info' });
    if (network.features.metisvm) badges.push({ label: 'MetisVM', variant: 'gradient' });
    if (network.features.eigenda) badges.push({ label: 'EigenDA', variant: 'success' });
    if (network.supports_x402) badges.push({ label: 'x402', variant: 'warning' });
    if (network.features.batch_deployment) badges.push({ label: 'Batch', variant: 'default' });

    return badges;
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          Select Network *
        </label>
        <Input
          type="text"
          placeholder="Search networks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mb-3"
        />
        {total > 0 && (
          <p className="text-xs text-gray-500 mb-3">
            Showing {filteredNetworks.length} of {total} networks
          </p>
        )}
      </div>

      {loading && (
        <div className="text-center py-8 text-gray-500">Loading networks...</div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {groupedNetworks.mainnets.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Mainnets</h3>
              <div className="space-y-2">
                {groupedNetworks.mainnets.map((network) => {
                  const badges = getFeatureBadges(network);
                  const isSelected = value === network.network;

                  return (
                    <button
                      key={network.network}
                      type="button"
                      onClick={() => onChange(network.network)}
                      className={`w-full text-left p-3 border rounded-lg transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {network.name || network.network}
                            </span>
                            {badges && badges.length > 0 && (
                              <div className="flex gap-1">
                                {badges.map((badge, idx) => (
                                  <Badge key={idx} variant={badge.variant}>
                                    {badge.label}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {network.chain_id && `Chain ID: ${network.chain_id}`}
                            {network.currency && ` • ${network.currency}`}
                          </div>
                        </div>
                        {isSelected && (
                          <svg
                            className="w-5 h-5 text-blue-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {groupedNetworks.testnets.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Testnets</h3>
              <div className="space-y-2">
                {groupedNetworks.testnets.map((network) => {
                  const badges = getFeatureBadges(network);
                  const isSelected = value === network.network;

                  return (
                    <button
                      key={network.network}
                      type="button"
                      onClick={() => onChange(network.network)}
                      className={`w-full text-left p-3 border rounded-lg transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {network.name || network.network}
                            </span>
                            {badges && badges.length > 0 && (
                              <div className="flex gap-1">
                                {badges.map((badge, idx) => (
                                  <Badge key={idx} variant={badge.variant}>
                                    {badge.label}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {network.chain_id && `Chain ID: ${network.chain_id}`}
                            {network.currency && ` • ${network.currency}`}
                          </div>
                        </div>
                        {isSelected && (
                          <svg
                            className="w-5 h-5 text-blue-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {filteredNetworks.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              No networks found matching your search.
            </div>
          )}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50"
        >
          Load More Networks
        </button>
      )}
    </div>
  );
}

