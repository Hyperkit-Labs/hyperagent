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
import { thirdwebClient, isThirdwebConfigured } from '@/lib/thirdwebClient';
import { TaskSelector, type TaskCostBreakdown } from '@/components/workflows/TaskSelector';

interface WorkflowFormProps {
  onSubmit: (data: {
    nlp_input: string;
    network: string;
    contract_type?: string;
    name?: string;
    selected_tasks?: string[];  // NEW: Selected tasks
    skip_audit?: boolean;  // Deprecated: kept for backward compatibility
    skip_deployment?: boolean;  // Deprecated: kept for backward compatibility
    optimize_for_metisvm?: boolean;
    enable_floating_point?: boolean;
    enable_ai_inference?: boolean;
    wallet_address: string;  // REQUIRED: User wallet address
    use_gasless?: boolean;  // Use facilitator for gasless deployment
    cost_breakdown?: TaskCostBreakdown;  // NEW: Cost breakdown for payment
  }) => void;
  loading?: boolean;
  onCostUpdate?: (cost: TaskCostBreakdown | null) => void;  // NEW: Cost update callback
  initialPrompt?: string; // NEW: Initial prompt from landing page
}

export function WorkflowForm({ onSubmit, loading = false, onCostUpdate, initialPrompt = '' }: WorkflowFormProps) {
  const wallet = useActiveWallet();
  const account = useActiveAccount();
  const [nlpInput, setNlpInput] = useState(initialPrompt);
  const [network, setNetwork] = useState('');
  const [contractType, setContractType] = useState('Custom');
  const [name, setName] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>(['generation', 'audit', 'testing', 'deployment']);
  const [costBreakdown, setCostBreakdown] = useState<TaskCostBreakdown | null>(null);
  const [skipAudit, setSkipAudit] = useState(false);  // Deprecated: kept for backward compatibility
  const [skipDeployment, setSkipDeployment] = useState(false);  // Deprecated: kept for backward compatibility
  const [optimizeForMetisVM, setOptimizeForMetisVM] = useState(false);
  const [enableFloatingPoint, setEnableFloatingPoint] = useState(false);
  const [enableAIInference, setEnableAIInference] = useState(false);
  const [useGasless, setUseGasless] = useState(false);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [thirdwebConfigured, setThirdwebConfigured] = useState(() => isThirdwebConfigured());
  const [walletChainId, setWalletChainId] = useState<number | null>(null);

  useEffect(() => {
    getNetworks()
      .then(setNetworks)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (wallet) {
      wallet.getChain?.()?.then((chain: any) => {
        setWalletChainId(chain?.id || null);
      }).catch(() => setWalletChainId(null));
    } else {
      setWalletChainId(null);
    }
  }, [wallet]);

  const isAvalancheFuji = walletChainId === 43113;
  const isX402Network = network.toLowerCase().includes('avalanche') || network.toLowerCase().includes('fuji');
  const needsNetworkSwitch = isX402Network && !isAvalancheFuji && walletChainId !== null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!nlpInput.trim() || !network) {
      setError('Please fill in all required fields');
      return;
    }

    // Require wallet connection
    if (!wallet || !account) {
      setError('Please connect your wallet to create a workflow');
      return;
    }

    if (needsNetworkSwitch) {
      setError('Please switch your wallet to Avalanche Fuji network to continue');
      return;
    }

    onSubmit({
      nlp_input: nlpInput,
      network,
      contract_type: contractType,
      name: name || undefined,
      selected_tasks: selectedTasks,  // NEW: Pass selected tasks
      skip_audit: skipAudit,  // Deprecated: kept for backward compatibility
      skip_deployment: skipDeployment,  // Deprecated: kept for backward compatibility
      optimize_for_metisvm: optimizeForMetisVM,
      enable_floating_point: enableFloatingPoint,
      enable_ai_inference: enableAIInference,
      wallet_address: account.address,  // REQUIRED: Pass wallet address from connected account
      use_gasless: useGasless,  // Pass gasless option
      cost_breakdown: costBreakdown,  // NEW: Pass cost breakdown for payment
    });
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
    <Card>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Wallet Connection Section */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Wallet Connection *</label>
            {thirdwebClient && <ConnectButton client={thirdwebClient} />}
          </div>
          {!wallet || !account ? (
              <p className="text-sm text-gray-600">
                Please connect your wallet to create a workflow. All deployments require a connected wallet.
              </p>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-green-600">
                  Connected: {account.address.slice(0, 6)}...{account.address.slice(-4)}
                </p>
                {isX402Network && !isAvalancheFuji && walletChainId && (
                  <p className="text-sm text-amber-600 font-medium">
                    ⚠️ Please switch to Avalanche Fuji (Chain ID: 43113) for x402 payments
                  </p>
                )}
                {isX402Network && (
                  <p className="text-xs text-gray-500">
                    x402 payments require USDC on Avalanche Fuji. Get test USDC from{' '}
                    <a href="https://core.app/tools/testnet-faucet/?subnet=c&token=usdc" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                      core.app faucet
                    </a>
                  </p>
                )}
              </div>
            )}
        </div>

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

        {network && (
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

        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">Advanced Options</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={skipAudit}
                onChange={(e) => setSkipAudit(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">Skip Security Audit</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={skipDeployment}
                onChange={(e) => setSkipDeployment(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">Skip Deployment (Generate Only)</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={optimizeForMetisVM}
                onChange={(e) => setOptimizeForMetisVM(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">Optimize for MetisVM</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={enableFloatingPoint}
                onChange={(e) => setEnableFloatingPoint(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">Enable Floating Point Operations</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={enableAIInference}
                onChange={(e) => setEnableAIInference(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">Enable AI Inference</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={useGasless}
                onChange={(e) => setUseGasless(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">Use Gasless Deployment (via facilitator)</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <Button 
          type="submit" 
          disabled={loading || !wallet || !account || !thirdwebConfigured} 
          className="w-full"
        >
          {loading 
            ? 'Creating Workflow...' 
            : (!wallet || !account) 
              ? 'Connect Wallet to Continue' 
              : 'Create Workflow'
          }
        </Button>
      </form>
    </Card>
  );
}

