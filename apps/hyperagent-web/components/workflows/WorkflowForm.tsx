'use client';

import { useState, FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { getNetworks } from '@/lib/api';
import type { Network } from '@/lib/types';
import { useEffect } from 'react';
import { useActiveWallet, useActiveAccount, ConnectButton } from 'thirdweb/react';
import { createWallet } from 'thirdweb/wallets';
import { thirdwebClient, isThirdwebConfigured } from '@/lib/thirdwebClient';
import { TaskSelector, type TaskCostBreakdown } from '@/components/workflows/TaskSelector';

interface WorkflowFormProps {
  onSubmit: (data: {
    nlp_input: string;
    network: string;
    contract_type?: string;
    name?: string;
    selected_tasks?: string[];
    wallet_address: string;
    use_gasless?: boolean;
    cost_breakdown?: TaskCostBreakdown;
  }) => void;
  loading?: boolean;
  onCostUpdate?: (cost: TaskCostBreakdown | null) => void;
  initialPrompt?: string;
}

export function WorkflowForm({ onSubmit, loading = false, onCostUpdate, initialPrompt = '' }: WorkflowFormProps) {
  const account = useActiveAccount();
  const [nlpInput, setNlpInput] = useState(initialPrompt);
  const [network, setNetwork] = useState('');
  const [contractType, setContractType] = useState('Custom');
  const [name, setName] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>(['generation', 'audit', 'testing', 'deployment']);
  const [costBreakdown, setCostBreakdown] = useState<TaskCostBreakdown | null>(null);
  const [useGasless, setUseGasless] = useState(false);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [thirdwebConfigured, setThirdwebConfigured] = useState(() => isThirdwebConfigured());
  const [useV2API, setUseV2API] = useState(false);

  useEffect(() => {
    getNetworks()
      .then(setNetworks)
      .catch((err) => setError(err.message));
  }, []);


  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!nlpInput.trim()) {
      setError('Please provide a contract description');
      return;
    }

    if (useV2API) {
      onSubmit({
        nlp_input: nlpInput,
        network: network || 'avalanche',
        intent: nlpInput,
        wallet_address: account?.address || '',
        use_v2_api: true,
      } as any);
      return;
    }

    if (!network) {
      setError('Please select a network');
      return;
    }

    if (!account) {
      setError('Please connect your wallet to create a workflow');
      return;
    }

    onSubmit({
      nlp_input: nlpInput,
      network,
      contract_type: contractType,
      name: name || undefined,
      selected_tasks: selectedTasks,
      wallet_address: account.address,
      use_gasless: useGasless,
      cost_breakdown: costBreakdown,
      use_v2_api: false,
    } as any);
  };

  // Filter supported networks (selectable)
  const supportedNetworks = networks.filter((n) => n.status === 'supported' || !n.status);
  const networkOptions = supportedNetworks.map((n) => ({
    value: n.network,
    label: `${n.network} (${n.chain_id || 'N/A'})`,
  }));

  // Coming soon networks (for display only, disabled)
  const comingSoonNetworks = networks.filter((n) => n.status === 'coming_soon');
  const comingSoonOptions = comingSoonNetworks.map((n) => ({
    value: n.network,
    label: `${n.network} (Coming Soon)`,
    disabled: true,
  }));

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* API Version Selector */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-gray-300">API Version</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUseV2API(false)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  !useV2API
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/5'
                }`}
              >
                v1 (Python)
              </button>
              <button
                type="button"
                onClick={() => setUseV2API(true)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  useV2API
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/5'
                }`}
              >
                v2 (Spec-Locked)
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {useV2API 
              ? 'Using spec-locked orchestrator with deterministic state machine'
              : 'Using Python backend with full feature set'}
          </p>
        </div>

        {/* Wallet Connection Section */}
        {!useV2API && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-300">Wallet Connection *</label>
              {thirdwebClient && (
                <ConnectButton
                  client={thirdwebClient}
                  wallets={[
                    createWallet("io.metamask"),
                    createWallet("okx.wallet"),
                    createWallet("com.coinbase.wallet"),
                    createWallet("com.trustwallet.app"),
                    createWallet("io.rabby"),
                    createWallet("me.rainbow"),
                  ]}
                />
              )}
            </div>
            {!account ? (
                <p className="text-sm text-gray-400">
                  Please connect your wallet to create a workflow. All deployments require a connected wallet.
                </p>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm text-green-400">
                    Connected Wallet: {account.address.slice(0, 6)}...{account.address.slice(-4)}
                  </p>
                </div>
              )}
          </div>
        )}

        <Textarea
          label="Contract Description *"
          placeholder="Describe the smart contract you want to create (e.g., 'Create an ERC20 token named TestToken with symbol TST and initial supply 1000000')"
          value={nlpInput}
          onChange={(e) => setNlpInput(e.target.value)}
          rows={4}
          required
        />

        <Select
          label="Network *"
          options={[
            { value: '', label: 'Select a network...' },
            ...networkOptions,
            ...comingSoonOptions,
          ]}
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
          required
        />

        <Input
          label="Contract Type"
          value={contractType}
          onChange={(e) => setContractType(e.target.value)}
          placeholder="Custom"
        />

        <Input
          label="Workflow Name (Optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Workflow"
        />

        {network && !useV2API && (
          <TaskSelector
            selectedTasks={selectedTasks}
            onTasksChange={setSelectedTasks}
            network={network}
            model="gemini-2.5-flash"
            contractComplexity="standard"
            promptLength={nlpInput.length}
            onCostUpdate={(cost) => {
              setCostBreakdown(cost);
              onCostUpdate?.(cost);
            }}
          />
        )}

        {!useV2API && (
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-300">Advanced Options</label>
            <div className="space-y-2">
              <label className="flex items-center text-gray-400">
                <input
                  type="checkbox"
                  checked={useGasless}
                  onChange={(e) => setUseGasless(e.target.checked)}
                  className="mr-2 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Use Gasless Deployment (via facilitator)</span>
              </label>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            {error}
          </div>
        )}

        <Button 
          type="submit" 
          disabled={loading || (!useV2API && (!account || !thirdwebConfigured))} 
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl h-11 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading 
            ? 'Creating Workflow...' 
            : (!useV2API && !account) 
              ? 'Connect Wallet to Continue' 
              : 'Create Workflow'
          }
        </Button>
      </form>
    </div>
  );
}

