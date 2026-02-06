'use client';

import { useState, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Network from 'lucide-react/dist/esm/icons/network';
import Database from 'lucide-react/dist/esm/icons/database';
import Zap from 'lucide-react/dist/esm/icons/zap';
import Shield from 'lucide-react/dist/esm/icons/shield';
import Code from 'lucide-react/dist/esm/icons/code';
import Rocket from 'lucide-react/dist/esm/icons/rocket';
import GitBranch from 'lucide-react/dist/esm/icons/git-branch';
import Layers from 'lucide-react/dist/esm/icons/layers';
import Workflow from 'lucide-react/dist/esm/icons/workflow';
import Wallet from 'lucide-react/dist/esm/icons/wallet';
import Server from 'lucide-react/dist/esm/icons/server';
import Cpu from 'lucide-react/dist/esm/icons/cpu';
import FileCode from 'lucide-react/dist/esm/icons/file-code';
import TestTube from 'lucide-react/dist/esm/icons/test-tube';
import Search from 'lucide-react/dist/esm/icons/search';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square';
import Settings from 'lucide-react/dist/esm/icons/settings';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import Lock from 'lucide-react/dist/esm/icons/lock';
import Globe from 'lucide-react/dist/esm/icons/globe';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';

// Lazy load heavy components
const MindMapCanvas = lazy(() => import('@/components/architecture/MindMapCanvas'));
import type { MindMapNode } from '@/components/architecture/MindMapCanvas';

const nodeCategories = {
  architecture: {
    label: 'Architecture',
    color: 'from-blue-500 to-cyan-500',
    icon: Layers,
  },
  services: {
    label: 'Core Services',
    color: 'from-purple-500 to-pink-500',
    icon: Server,
  },
  agents: {
    label: 'AI Agents',
    color: 'from-green-500 to-emerald-500',
    icon: Sparkles,
  },
  flows: {
    label: 'Payment & Deployment Flows',
    color: 'from-orange-500 to-red-500',
    icon: Workflow,
  },
  infrastructure: {
    label: 'Infrastructure',
    color: 'from-indigo-500 to-blue-500',
    icon: Database,
  },
  frontend: {
    label: 'Frontend',
    color: 'from-pink-500 to-rose-500',
    icon: Code,
  },
};

const mindMapNodes: MindMapNode[] = [
  // Architecture Nodes - Top Center Island (15-25% x, 10-30% y)
  {
    id: 'soa',
    label: 'Service-Oriented Architecture',
    category: 'architecture',
    description: 'Centralized service registry for service discovery and lookup',
    icon: Layers,
    color: 'blue',
    position: { x: 20, y: 15 },
    connections: ['service-registry', 'orchestrator'],
    details: {
      implementation: 'hyperagent/architecture/soa.py',
      status: 'Adopted',
    },
  },
  {
    id: 'service-registry',
    label: 'Service Registry',
    category: 'architecture',
    description: 'Central registry for service lookup and metadata',
    icon: Server,
    color: 'blue',
    position: { x: 15, y: 25 },
    connections: ['generation-service', 'compilation-service', 'audit-service', 'testing-service', 'deployment-service'],
  },
  {
    id: 'orchestrator',
    label: 'Workflow Coordinator',
    category: 'architecture',
    description: 'Orchestrates complete workflow pipeline from generation to deployment',
    icon: Workflow,
    color: 'blue',
    position: { x: 25, y: 25 },
    connections: ['event-bus', 'workflow-states'],
    details: {
      implementation: 'hyperagent/core/orchestrator.py',
      status: 'Adopted',
    },
  },
  {
    id: 'event-bus',
    label: 'Event-Driven Architecture',
    category: 'architecture',
    description: 'Redis Streams for event-driven communication between services',
    icon: MessageSquare,
    color: 'blue',
    position: { x: 20, y: 35 },
    connections: ['redis', 'event-types'],
    details: {
      implementation: 'hyperagent/events/event_bus.py',
      status: 'Adopted',
    },
  },
  {
    id: 'event-types',
    label: 'Event Types',
    category: 'architecture',
    description: 'Contract generated, compiled, audited, tested, deployed events',
    icon: GitBranch,
    color: 'blue',
    position: { x: 15, y: 45 },
    connections: [],
  },
  {
    id: 'workflow-states',
    label: 'Workflow States',
    category: 'architecture',
    description: 'PENDING → PROCESSING → COMPLETED/FAILED/CANCELLED',
    icon: Settings,
    color: 'blue',
    position: { x: 25, y: 45 },
    connections: [],
  },

  // Core Services Nodes - Left Island (10-35% x, 55-85% y)
  {
    id: 'generation-service',
    label: 'Generation Service',
    category: 'services',
    description: 'Converts NLP input to Solidity contract code using LLM',
    icon: Sparkles,
    color: 'purple',
    position: { x: 15, y: 60 },
    connections: ['generation-agent', 'llm-provider', 'rag-system'],
    details: {
      implementation: 'hyperagent/core/services/generation_service.py',
      status: 'Adopted',
    },
  },
  {
    id: 'compilation-service',
    label: 'Compilation Service',
    category: 'services',
    description: 'Compiles Solidity code to bytecode and ABI',
    icon: FileCode,
    color: 'purple',
    position: { x: 15, y: 70 },
    connections: ['generation-service'],
    details: {
      implementation: 'hyperagent/core/services/compilation_service.py',
      status: 'Adopted',
    },
  },
  {
    id: 'audit-service',
    label: 'Audit Service',
    category: 'services',
    description: 'Security analysis using Slither, Mythril, Echidna',
    icon: Shield,
    color: 'purple',
    position: { x: 15, y: 80 },
    connections: ['compilation-service', 'security-tools'],
    details: {
      implementation: 'hyperagent/core/services/audit_service.py',
      status: 'Adopted',
    },
  },
  {
    id: 'testing-service',
    label: 'Testing Service',
    category: 'services',
    description: 'Generates and runs unit tests for contracts',
    icon: TestTube,
    color: 'purple',
    position: { x: 25, y: 60 },
    connections: ['compilation-service', 'testing-agent'],
    details: {
      implementation: 'hyperagent/core/services/testing_service.py',
      status: 'Adopted',
    },
  },
  {
    id: 'deployment-service',
    label: 'Deployment Service',
    category: 'services',
    description: 'Deploys contracts to blockchain networks',
    icon: Rocket,
    color: 'purple',
    position: { x: 25, y: 70 },
    connections: ['network-manager', 'x402-middleware', 'erc4337'],
    details: {
      implementation: 'hyperagent/core/services/deployment_service.py',
      status: 'Adopted',
    },
  },
  {
    id: 'llm-provider',
    label: 'LLM Provider',
    category: 'services',
    description: 'Gemini and OpenAI integration for contract generation',
    icon: Cpu,
    color: 'purple',
    position: { x: 25, y: 80 },
    connections: [],
    details: {
      implementation: 'hyperagent/llm/provider.py',
      status: 'Adopted',
    },
  },
  {
    id: 'rag-system',
    label: 'RAG System',
    category: 'services',
    description: 'Retrieval-Augmented Generation with template retrieval',
    icon: Search,
    color: 'purple',
    position: { x: 35, y: 60 },
    connections: ['vector-store', 'template-retriever'],
    details: {
      implementation: 'hyperagent/rag/template_retriever.py',
      status: 'Adopted',
    },
  },
  {
    id: 'template-retriever',
    label: 'Template Retriever',
    category: 'services',
    description: 'Semantic search for contract templates',
    icon: FileCode,
    color: 'purple',
    position: { x: 35, y: 70 },
    connections: [],
  },
  {
    id: 'security-tools',
    label: 'Security Tools',
    category: 'services',
    description: 'Slither, Mythril, Echidna wrappers',
    icon: Shield,
    color: 'purple',
    position: { x: 35, y: 80 },
    connections: [],
    details: {
      implementation: 'hyperagent/security/',
      status: 'Adopted',
    },
  },

  // AI Agents Nodes - Center Island (45-65% x, 50-75% y)
  {
    id: 'generation-agent',
    label: 'Generation Agent',
    category: 'agents',
    description: 'AI agent for contract generation from NLP',
    icon: Sparkles,
    color: 'green',
    position: { x: 50, y: 55 },
    connections: ['llm-provider', 'rag-system'],
    details: {
      implementation: 'hyperagent/agents/generation.py',
      status: 'Adopted',
    },
  },
  {
    id: 'audit-agent',
    label: 'Audit Agent',
    category: 'agents',
    description: 'AI agent for security auditing',
    icon: Shield,
    color: 'green',
    position: { x: 55, y: 55 },
    connections: ['security-tools'],
    details: {
      implementation: 'hyperagent/agents/audit.py',
      status: 'Adopted',
    },
  },
  {
    id: 'testing-agent',
    label: 'Testing Agent',
    category: 'agents',
    description: 'AI agent for test generation',
    icon: TestTube,
    color: 'green',
    position: { x: 50, y: 65 },
    connections: [],
    details: {
      implementation: 'hyperagent/agents/testing.py',
      status: 'Adopted',
    },
  },
  {
    id: 'deployment-agent',
    label: 'Deployment Agent',
    category: 'agents',
    description: 'AI agent for deployment orchestration',
    icon: Rocket,
    color: 'green',
    position: { x: 55, y: 65 },
    connections: ['network-manager'],
    details: {
      implementation: 'hyperagent/agents/deployment.py',
      status: 'Adopted',
    },
  },
  {
    id: 'coordinator-agent',
    label: 'Coordinator Agent',
    category: 'agents',
    description: 'Orchestrates workflow execution',
    icon: Workflow,
    color: 'green',
    position: { x: 60, y: 60 },
    connections: ['orchestrator'],
    details: {
      implementation: 'hyperagent/agents/coordinator.py',
      status: 'Adopted',
    },
  },

  // Payment & Deployment Flows - Bottom Left Island (5-30% x, 50-85% y)
  {
    id: 'x402-flow',
    label: 'x402 Payment Flow',
    category: 'flows',
    description: 'Pay-per-use payment gating for Avalanche networks',
    icon: Wallet,
    color: 'orange',
    position: { x: 10, y: 50 },
    connections: ['x402-middleware', 'thirdweb-client', 'payment-history'],
    details: {
      implementation: 'hyperagent/api/middleware/x402.py',
      status: 'Adopted',
    },
  },
  {
    id: 'x402-middleware',
    label: 'x402 Middleware',
    category: 'flows',
    description: 'Payment verification and spending controls',
    icon: Lock,
    color: 'orange',
    position: { x: 5, y: 60 },
    connections: ['spending-controls', 'payment-history'],
  },
  {
    id: 'erc4337',
    label: 'ERC4337 Deployment',
    category: 'flows',
    description: 'Smart Account deployments with user wallet signing',
    icon: Wallet,
    color: 'orange',
    position: { x: 15, y: 60 },
    connections: ['deployment-service', 'thirdweb-client'],
    details: {
      status: 'Adopted',
    },
  },
  {
    id: 'workflow-execution',
    label: 'Workflow Execution',
    category: 'flows',
    description: 'Complete pipeline: Generation → Compilation → Audit → Testing → Deployment',
    icon: Workflow,
    color: 'orange',
    position: { x: 10, y: 70 },
    connections: ['orchestrator', 'generation-service'],
  },
  {
    id: 'spending-controls',
    label: 'Spending Controls',
    category: 'flows',
    description: 'Daily/monthly limits and merchant whitelisting',
    icon: Settings,
    color: 'orange',
    position: { x: 5, y: 80 },
    connections: [],
  },
  {
    id: 'payment-history',
    label: 'Payment History',
    category: 'flows',
    description: 'Complete payment logging and analytics',
    icon: BarChart3,
    color: 'orange',
    position: { x: 15, y: 80 },
    connections: ['database'],
  },
  {
    id: 'thirdweb-client',
    label: 'Thirdweb Client',
    category: 'flows',
    description: 'x402 payment verification and ERC4337 support',
    icon: Wallet,
    color: 'orange',
    position: { x: 20, y: 80 },
    connections: [],
    details: {
      implementation: 'hyperagent/blockchain/thirdweb_client.py',
      status: 'Adopted',
    },
  },

  // Infrastructure Nodes - Bottom Right Island (70-90% x, 50-85% y)
  {
    id: 'database',
    label: 'PostgreSQL + pgvector',
    category: 'infrastructure',
    description: 'Primary data store with vector embeddings for RAG',
    icon: Database,
    color: 'indigo',
    position: { x: 75, y: 50 },
    connections: ['redis', 'vector-store'],
    details: {
      status: 'Adopted',
    },
  },
  {
    id: 'redis',
    label: 'Redis Streams',
    category: 'infrastructure',
    description: 'Event bus, cache, and state management',
    icon: Zap,
    color: 'indigo',
    position: { x: 75, y: 60 },
    connections: ['event-bus'],
    details: {
      status: 'Adopted',
    },
  },
  {
    id: 'network-manager',
    label: 'Network Manager',
    category: 'infrastructure',
    description: 'Multi-chain support (Avalanche, Mantle)',
    icon: Network,
    color: 'indigo',
    position: { x: 75, y: 70 },
    connections: ['blockchain-clients'],
    details: {
      implementation: 'hyperagent/blockchain/networks.py',
      status: 'Adopted',
    },
  },
  {
    id: 'blockchain-clients',
    label: 'Blockchain Clients',
    category: 'infrastructure',
    description: 'Web3, EigenDA, Thirdweb',
    icon: Globe,
    color: 'indigo',
    position: { x: 85, y: 55 },
    connections: [],
  },
  {
    id: 'vector-store',
    label: 'Vector Store',
    category: 'infrastructure',
    description: 'pgvector for semantic search of contract templates',
    icon: Search,
    color: 'indigo',
    position: { x: 85, y: 65 },
    connections: ['rag-system'],
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    category: 'infrastructure',
    description: 'Prometheus metrics, health checks, logging',
    icon: BarChart3,
    color: 'indigo',
    position: { x: 85, y: 75 },
    connections: [],
    details: {
      status: 'Adopted',
    },
  },

  // Frontend Nodes - Top Right Island (75-90% x, 10-40% y)
  {
    id: 'frontend-api',
    label: 'Frontend API Layer',
    category: 'frontend',
    description: 'React/Next.js API client with x402 payment integration',
    icon: Code,
    color: 'pink',
    position: { x: 80, y: 20 },
    connections: ['x402-flow', 'workflow-execution'],
    details: {
      implementation: 'frontend/lib/api.ts',
      status: 'Adopted',
    },
  },
  {
    id: 'payment-modal',
    label: 'Payment Modal',
    category: 'frontend',
    description: 'x402 payment UI with wallet integration',
    icon: Wallet,
    color: 'pink',
    position: { x: 85, y: 20 },
    connections: ['thirdweb-client'],
    details: {
      implementation: 'frontend/components/x402/PaymentModal.tsx',
      status: 'Adopted',
    },
  },
  {
    id: 'analytics-dashboard',
    label: 'Analytics Dashboard',
    category: 'frontend',
    description: 'Payment history, spending controls, trends',
    icon: BarChart3,
    color: 'pink',
    position: { x: 80, y: 30 },
    connections: ['payment-history'],
    details: {
      implementation: 'frontend/app/avax/analytics/page.tsx',
      status: 'Adopted',
    },
  },
];

export default function ArchitecturePage() {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['architecture']));
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const filteredNodes = useMemo(() => {
    if (!searchQuery) return mindMapNodes;
    const query = searchQuery.toLowerCase();
    return mindMapNodes.filter(
      (node) =>
        node.label.toLowerCase().includes(query) ||
        node.description.toLowerCase().includes(query) ||
        node.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const nodesByCategory = useMemo(() => {
    const grouped: Record<string, MindMapNode[]> = {};
    filteredNodes.forEach((node) => {
      if (!grouped[node.category]) {
        grouped[node.category] = [];
      }
      grouped[node.category].push(node);
    });
    return grouped;
  }, [filteredNodes]);

  const selectedNodeData = useMemo(() => {
    if (!selectedNode) return null;
    return mindMapNodes.find((n) => n.id === selectedNode);
  }, [selectedNode]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-10">
      {/* Background effects */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,#2e1065_0%,transparent_40%)] pointer-events-none" />
      <div className="fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />
      
      <div className="w-full px-6 pt-20 pb-8 relative z-10">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-violet-500/20 rounded-lg border border-violet-500/30">
                  <Layers className="w-6 h-6 text-violet-400" />
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">
                  HyperAgent <span className="text-slate-500 font-light">Architecture</span>
                </h1>
              </div>
              <p className="text-sm text-slate-400 ml-1">
                Interactive system visualization and component hierarchy
              </p>
            </div>
          </div>

          {/* Full-Width Search Bar */}
          <div className="w-full">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="relative group"
            >
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
              <input
                type="text"
                placeholder="Search components or nodes…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-white/10 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-violet-500 focus:border-violet-500/50 transition-all outline-none backdrop-blur-sm"
              />
            </motion.div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-[1920px] mx-auto">
          {/* Left Sidebar - Architecture Components */}
          <div className="lg:col-span-3">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="h-full flex flex-col bg-slate-900/30 backdrop-blur-xl border border-white/5 rounded-xl overflow-hidden"
            >
              <div className="p-6 pb-2 border-b border-white/5">
                <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">Architecture Components</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                {Object.entries(nodeCategories).map(([categoryKey, category], index) => {
                  const nodes = nodesByCategory[categoryKey] || [];
                  const isExpanded = expandedCategories.has(categoryKey);
                  const Icon = category.icon;

                  if (nodes.length === 0) return null;

                  return (
                    <motion.div
                      key={categoryKey}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="group border border-white/5 rounded-xl overflow-hidden transition-all duration-300 hover:border-white/10"
                    >
                      <button
                        onClick={() => toggleCategory(categoryKey)}
                        className="w-full p-3 flex items-center justify-between cursor-pointer bg-slate-900/50 hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`p-1.5 rounded-md bg-gradient-to-br ${category.color} bg-opacity-10 flex-shrink-0`}>
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-sm font-medium text-slate-200 truncate">{category.label}</span>
                          <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">{nodes.length}</span>
                        </div>
                        <motion.div
                          animate={{ rotate: isExpanded ? 0 : -90 }}
                          transition={{ duration: 0.3 }}
                        >
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        </motion.div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden border-t border-white/5"
                          >
                            <div className="p-2 space-y-1 bg-slate-900/20">
                              {nodes.map((node, nodeIndex) => {
                                const NodeIcon = node.icon;
                                const isSelected = selectedNode === node.id;
                                const isHovered = hoveredNodeId === node.id;

                                return (
                                  <motion.button
                                    key={node.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: nodeIndex * 0.02 }}
                                    onClick={() => setSelectedNode(isSelected ? null : node.id)}
                                    onMouseEnter={() => setHoveredNodeId(node.id)}
                                    onMouseLeave={() => setHoveredNodeId(null)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-white/5 flex items-center gap-2 group/btn border border-transparent transition-all ${
                                      isSelected ? 'bg-white/10 border-violet-500/30' : 
                                      isHovered ? 'bg-white/5 border-violet-500/20' : ''
                                    }`}
                                    whileHover={{ scale: 1.02, x: 4 }}
                                    whileTap={{ scale: 0.98 }}
                                  >
                                    <div className={`w-1.5 h-1.5 rounded-full ${
                                      node.color === 'blue' ? 'bg-blue-500' :
                                      node.color === 'purple' ? 'bg-violet-500' :
                                      node.color === 'green' ? 'bg-emerald-500' :
                                      node.color === 'orange' ? 'bg-orange-500' :
                                      node.color === 'indigo' ? 'bg-indigo-500' :
                                      node.color === 'pink' ? 'bg-pink-500' :
                                      'bg-slate-500'
                                    } group-hover/btn:scale-125 transition-transform`}></div>
                                    <span className={`truncate ${
                                      isSelected ? 'text-white font-medium' : 'text-slate-400 group-hover/btn:text-slate-200'
                                    }`}>{node.label}</span>
                                  </motion.button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </div>

          {/* Center - Mind Map Canvas */}
          <div className="lg:col-span-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="h-[900px] relative overflow-hidden bg-slate-950/30 backdrop-blur-xl border border-white/5 rounded-xl"
            >
              <div className="absolute top-0 left-0 right-0 p-6 bg-slate-900/50 backdrop-blur-sm border-b border-white/5 z-10">
                <h2 className="text-xl font-semibold text-white mb-1">System Architecture</h2>
                <p className="text-sm text-slate-400">Interactive mind map visualization</p>
              </div>
              <div className="pt-24 h-full">
                <Suspense fallback={
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
                    <div className="text-center">
                      <div className="relative">
                        <div className="h-12 w-12 rounded-full border-t-2 border-b-2 border-violet-500 animate-spin mx-auto"></div>
                        <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-violet-500/30 blur-sm animate-pulse"></div>
                      </div>
                      <p className="mt-4 text-sm text-violet-300 font-medium animate-pulse">Initializing Neural Grid...</p>
                    </div>
                  </div>
                }>
                  <MindMapCanvas
                    nodes={filteredNodes}
                    selectedNode={selectedNode}
                    onNodeSelect={setSelectedNode}
                    hoveredNodeId={hoveredNodeId}
                    onNodeHover={setHoveredNodeId}
                  />
                </Suspense>
              </div>
            </motion.div>
          </div>

          {/* Right Sidebar - Component Details */}
          <div className="lg:col-span-3">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="sticky top-8 h-fit bg-slate-900/30 backdrop-blur-xl border border-white/5 rounded-xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5">
                <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Component Details</h2>
                <p className="text-xs text-slate-500 mt-1">Select a node to view properties</p>
              </div>
              <div className="p-6">
                <AnimatePresence mode="wait">
                  {selectedNodeData ? (
                    <motion.div
                      key={selectedNodeData.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      {/* Header with gradient */}
                      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br p-6 mb-6" style={{
                        background: nodeCategories[selectedNodeData.category as keyof typeof nodeCategories]?.color || 'from-gray-500 to-gray-600'
                      }}>
                        <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px]"></div>
                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md border border-white/20">
                              <selectedNodeData.icon className="w-6 h-6 text-white" />
                            </div>
                            <span className="px-2 py-1 rounded-full bg-white/20 border border-white/20 text-[10px] font-bold text-white uppercase tracking-wider">
                              {nodeCategories[selectedNodeData.category as keyof typeof nodeCategories]?.label}
                            </span>
                          </div>
                          <h2 className="text-2xl font-bold text-white tracking-tight mb-1">{selectedNodeData.label}</h2>
                          <p className="text-white/70 text-sm font-mono opacity-80">ID: {selectedNodeData.id.toUpperCase()}</p>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <h3 className="text-sm font-medium text-slate-200 mb-2">Description</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">{selectedNodeData.description}</p>
                      </div>

                      {/* Status and Metrics */}
                      {selectedNodeData.details && (
                        <div className="grid grid-cols-2 gap-3">
                          {selectedNodeData.details.status && (
                            <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5">
                              <div className="text-xs text-slate-500 mb-1">Status</div>
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                <span className="text-sm font-medium text-emerald-400">{selectedNodeData.details.status}</span>
                              </div>
                            </div>
                          )}
                          <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5">
                            <div className="text-xs text-slate-500 mb-1">Latency</div>
                            <div className="flex items-center gap-2">
                              <Zap className="w-3 h-3 text-amber-400" />
                              <span className="text-sm font-medium text-amber-400">~24ms</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Connections */}
                      {selectedNodeData.connections.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-slate-200 mb-3">Connections</h3>
                          <div className="space-y-2">
                            {selectedNodeData.connections.map((connId) => {
                              const connNode = mindMapNodes.find((n) => n.id === connId);
                              if (!connNode) return null;
                              const ConnIcon = connNode.icon;
                              return (
                                <motion.button
                                  key={connId}
                                  onClick={() => setSelectedNode(connId)}
                                  className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-white/5 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all group"
                                  whileHover={{ scale: 1.02, x: 4 }}
                                  whileTap={{ scale: 0.98 }}
                                >
                                  <div className="flex items-center gap-3">
                                    <ConnIcon className="w-4 h-4 text-slate-500 group-hover:text-violet-400 transition-colors" />
                                    <span className="text-sm text-slate-400 group-hover:text-slate-200">{connNode.label}</span>
                                  </div>
                                  <motion.div
                                    animate={{ x: [0, 4, 0] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                  >
                                    <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-violet-500" />
                                  </motion.div>
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Implementation */}
                      {selectedNodeData.details?.implementation && (
                        <div>
                          <h3 className="text-sm font-medium text-slate-200 mb-2">Implementation</h3>
                          <div className="p-3 bg-slate-950 rounded-lg border border-white/5 font-mono text-xs text-slate-400 overflow-x-auto">
                            <span className="text-pink-400">import</span> {`{ ${selectedNodeData.label.replace(/\s/g, '')} }`} <span className="text-pink-400">from</span> <span className="text-green-400">&apos;{selectedNodeData.details.implementation}&apos;</span>;
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col items-center justify-center text-center opacity-40"
                    >
                      <div className="p-4 bg-white/5 rounded-full mb-4">
                        <Layers className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-200">No Selection</h3>
                      <p className="text-sm text-slate-500 mt-2 max-w-[200px]">Interact with the mind map to view architectural details.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

