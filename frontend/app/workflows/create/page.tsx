'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { createWorkflow, getNetworks } from '@/lib/api';
import type { Network } from '@/lib/types';
import { useActiveAccount } from 'thirdweb/react';
import { toast } from 'sonner';
import FileCode from 'lucide-react/dist/esm/icons/file-code';
import Wand2 from 'lucide-react/dist/esm/icons/wand-2';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import NetworkIcon from 'lucide-react/dist/esm/icons/network';
import Settings from 'lucide-react/dist/esm/icons/settings';
import Wallet from 'lucide-react/dist/esm/icons/wallet';
import Zap from 'lucide-react/dist/esm/icons/zap';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left';
import Link from 'next/link';

// Contract templates for quick selection
const QUICK_TEMPLATES = [
  {
    id: 'erc20',
    name: 'ERC20 Token',
    description: 'Create a fungible token with customizable supply',
    prompt: 'Create an ERC20 token with name {name}, symbol {symbol}, and total supply of {supply}',
    icon: '🪙',
  },
  {
    id: 'erc721',
    name: 'NFT Collection',
    description: 'Create a non-fungible token collection',
    prompt: 'Create an ERC721 NFT collection with name {name}, symbol {symbol}, and base URI {baseURI}',
    icon: '🎨',
  },
  {
    id: 'simple_storage',
    name: 'Simple Storage',
    description: 'Basic storage contract for data persistence',
    prompt: 'Create a simple storage contract that can store and retrieve uint256 values',
    icon: '💾',
  },
  {
    id: 'custom',
    name: 'Custom Contract',
    description: 'Describe your own contract requirements',
    prompt: '',
    icon: '⚡',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
  },
};

export default function CreateWorkflowPage() {
  const router = useRouter();
  const account = useActiveAccount();
  
  const [selectedTemplate, setSelectedTemplate] = useState<string>('custom');
  const [nlpInput, setNlpInput] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('mantle_testnet');
  const [walletAddress, setWalletAddress] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([
    'generation',
    'compilation',
    'audit',
    'testing',
    'deployment',
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loadingNetworks, setLoadingNetworks] = useState(true);

  useEffect(() => {
    if (account?.address) {
      setWalletAddress(account.address);
    } else {
      setWalletAddress('');
    }
  }, [account?.address]);

  // Available workflow tasks - All are required for end-to-end workflow
  const WORKFLOW_TASKS = [
    { id: 'generation', name: 'Code Generation', required: true },
    { id: 'compilation', name: 'Compilation', required: true },
    { id: 'audit', name: 'Security Audit', required: true },
    { id: 'testing', name: 'Testing', required: true },
    { id: 'deployment', name: 'Deployment', required: true },
  ];

  useEffect(() => {
    fetchNetworks();
  }, []);

  const fetchNetworks = async () => {
    try {
      const data = await getNetworks();
      setNetworks(data);
      
      // Find Mantle testnet or default to first network
      const mantleTestnet = data.find((n) => n.network_id === 'mantle_testnet');
      if (mantleTestnet) {
        setSelectedNetwork(mantleTestnet.network_id);
      } else if (data.length > 0) {
        setSelectedNetwork(data[0].network_id);
      }
    } catch (err) {
      console.error('Failed to fetch networks:', err);
      // Use default networks if API fails
      setNetworks([
        { network_id: 'mantle_testnet', name: 'Mantle Sepolia', chain_id: 5003, currency: 'MNT' },
        { network_id: 'mantle_mainnet', name: 'Mantle Mainnet', chain_id: 5000, currency: 'MNT' },
        { network_id: 'avalanche_fuji', name: 'Avalanche Fuji', chain_id: 43113, currency: 'AVAX' },
      ]);
    } finally {
      setLoadingNetworks(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = QUICK_TEMPLATES.find((t) => t.id === templateId);
    if (template && template.prompt) {
      setNlpInput(template.prompt);
    } else {
      setNlpInput('');
    }
  };

  const handleTaskToggle = (taskId: string) => {
    const task = WORKFLOW_TASKS.find((t) => t.id === taskId);
    if (task?.required) {
      toast.info('All workflow steps are required for end-to-end deployment');
      return; // Can't toggle required tasks
    }

    setSelectedTasks((prev) =>
      prev.includes(taskId) ? prev.filter((t) => t !== taskId) : [...prev, taskId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate inputs
      if (!nlpInput.trim()) {
        throw new Error('Please provide a contract description');
      }

      if (!selectedNetwork) {
        throw new Error('Please select a target network');
      }

      if (!account?.address) {
        throw new Error('Please connect your Smart Wallet to create a workflow');
      }

      const requiredTasks = WORKFLOW_TASKS.filter(t => t.required).map(t => t.id);
      const missingTasks = requiredTasks.filter(t => !selectedTasks.includes(t));
      if (missingTasks.length > 0) {
        throw new Error(`All workflow steps are required. Missing: ${missingTasks.join(', ')}`);
      }

      const result = await createWorkflow({
        nlp_input: nlpInput,
        network: selectedNetwork,
        selected_tasks: selectedTasks,
        wallet_address: account.address,
      });

      toast.success('Workflow created successfully!');

      // Redirect to workflow details page
      router.push(`/workflows/${result.workflow_id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create workflow';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Workflow creation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full bg-[#030712] text-white min-h-screen">
      <div className="max-w-[1200px] mx-auto px-6 py-12">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="flex items-center gap-4">
            <Link href="/workflows">
              <Button variant="ghost" className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Workflows
              </Button>
            </Link>
          </motion.div>

          <motion.div variants={itemVariants}>
            <h1 className="text-4xl font-bold text-white flex items-center gap-3 mb-2">
              <Wand2 className="w-8 h-8 text-blue-400" />
              Create New Workflow
            </h1>
            <p className="text-gray-400 mt-2">
              Generate, audit, test, and deploy smart contracts with AI assistance
            </p>
          </motion.div>

          {/* Quick Templates */}
          <motion.div variants={itemVariants}>
            <h2 className="text-xl font-bold text-white mb-4">Choose a Template</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {QUICK_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  className={`p-6 rounded-xl border-2 transition-all hover:scale-105 active:scale-95 text-left ${
                    selectedTemplate === template.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-white/10 bg-gray-900/50 hover:border-white/20'
                  }`}
                >
                  <div className="text-4xl mb-3">{template.icon}</div>
                  <h3 className="font-bold text-white mb-2">{template.name}</h3>
                  <p className="text-sm text-gray-400">{template.description}</p>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Main Form */}
          <motion.div variants={itemVariants}>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Contract Description */}
              <Card className="p-6 bg-gray-900/50 backdrop-blur-xl border border-white/10">
                <label className="block mb-3">
                  <span className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                    <FileCode className="w-4 h-4" />
                    Contract Description
                  </span>
                  <textarea
                    value={nlpInput}
                    onChange={(e) => setNlpInput(e.target.value)}
                    placeholder="Describe your smart contract in natural language..."
                    className="w-full mt-2 p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors min-h-[150px]"
                    required
                  />
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  Example: Create an ERC20 token with 1 million supply, mintable by owner
                </p>
              </Card>

              {/* Network Selection */}
              <Card className="p-6 bg-gray-900/50 backdrop-blur-xl border border-white/10">
                <label className="block mb-3">
                  <span className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                    <NetworkIcon className="w-4 h-4" />
                    Target Network
                  </span>
                  {loadingNetworks ? (
                    <div className="mt-2 p-4 bg-white/5 border border-white/10 rounded-xl">
                      <LoadingSpinner size="sm" text="Loading networks..." />
                    </div>
                  ) : (
                    <select
                      value={selectedNetwork}
                      onChange={(e) => setSelectedNetwork(e.target.value)}
                      className="w-full mt-2 p-4 bg-slate-800/80 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors appearance-none cursor-pointer hover:bg-slate-800 hover:border-white/20"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 1rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.5em 1.5em',
                        paddingRight: '3rem',
                      }}
                      required
                    >
                      {networks.map((network) => (
                        <option 
                          key={network.network_id} 
                          value={network.network_id}
                          className="bg-slate-900 text-white py-2"
                        >
                          {network.name} ({network.currency})
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  Select the blockchain network for deployment
                </p>
              </Card>

              {/* Workflow Tasks */}
              <Card className="p-6 bg-gray-900/50 backdrop-blur-xl border border-white/10">
                <span className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-4">
                  <Settings className="w-4 h-4" />
                  Workflow Steps
                </span>
                <div className="space-y-3">
                  {WORKFLOW_TASKS.map((task) => (
                    <label
                      key={task.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        selectedTasks.includes(task.id)
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-white/10 bg-white/5'
                      } ${task.required ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-white/20'}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTasks.includes(task.id)}
                        onChange={() => handleTaskToggle(task.id)}
                        disabled={task.required}
                        className="w-4 h-4 rounded border-white/20 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                      />
                      <span className="text-sm font-medium text-white">
                        {task.name}
                        {task.required && <span className="text-xs text-gray-500 ml-2">(Required)</span>}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Customize which steps to execute in your workflow
                </p>
              </Card>

              {/* Wallet Configuration */}
              <Card className="p-6 bg-gray-900/50 backdrop-blur-xl border border-white/10">
                <span className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-4">
                  <Wallet className="w-4 h-4" />
                  Wallet Configuration
                </span>
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Wallet className="w-4 h-4" />
                      Wallet Address
                      <span className="text-xs text-red-400">(Required)</span>
                    </span>
                    {account?.address ? (
                      <div className="mt-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <code className="text-sm text-green-400 font-mono break-all">
                              {account.address}
                            </code>
                          </div>
                          <span className="text-xs text-green-400">Connected</span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-yellow-400 mb-1">
                              Wallet Not Connected
                            </p>
                            <p className="text-xs text-gray-300">
                              Please connect your wallet to create a workflow. Wallet address is required for deployment.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Your connected wallet will be used for contract deployment. All transactions require your signature.
                      Gas fees are automatically sponsored by paymaster for supported networks.
                    </p>
                  </label>
                </div>
              </Card>

              {/* Error Display */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-400">Error Creating Workflow</p>
                    <p className="text-xs text-red-300 mt-1">{error}</p>
                  </div>
                </motion.div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || !nlpInput.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-4 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Creating Workflow...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Create Workflow
                  </>
                )}
              </Button>
            </form>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
