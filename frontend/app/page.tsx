'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getNetworks } from '@/lib/api';
import { useHealth } from '@/hooks/useHealth';
import Link from 'next/link';
import type { Network } from '@/lib/types';
import {
  Sparkles,
  Zap,
  Shield,
  Network as NetworkIcon,
  Rocket,
  Code,
  FileText,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';

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

export default function Home() {
  const { health, loading: healthLoading } = useHealth();
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNetworks()
      .then(setNetworks)
      .catch((error) => {
        console.error('Failed to fetch networks:', error);
        setNetworks([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const quickActions = [
    {
      icon: Sparkles,
      label: 'Create Workflow',
      href: '/workflows/create',
      description: 'Generate smart contracts with AI',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: FileText,
      label: 'Browse Templates',
      href: '/templates',
      description: 'Explore contract templates',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: Activity,
      label: 'View Workflows',
      href: '/workflows',
      description: 'Monitor your workflows',
      gradient: 'from-indigo-500 to-blue-500',
    },
    {
      icon: Shield,
      label: 'Monitoring',
      href: '/monitoring',
      description: 'System health & metrics',
      gradient: 'from-green-500 to-emerald-500',
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Hero Section */}
      <motion.div variants={itemVariants} className="text-center md:text-left">
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-full border border-blue-100"
        >
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700">AI-Powered Smart Contract Platform</span>
        </motion.div>
        
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-4">
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            HyperAgent
          </span>
          <br />
          <span className="text-gray-900">Dashboard</span>
        </h1>
        
        <p className="text-xl text-gray-800 max-w-2xl leading-relaxed font-medium">
          Transform natural language into production-ready smart contracts. 
          Generate, audit, test, and deploy across multiple blockchains with AI assistance.
        </p>
      </motion.div>

      {/* System Health Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <Card hover gradient className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full blur-2xl" />
            <div className="relative space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                  <Activity className="w-4 h-4 text-gray-700" />
                  System Status
                </h3>
                {getStatusIcon(health?.status)}
              </div>
              {healthLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full shadow-lg animate-pulse ${
                      health?.status === 'healthy'
                        ? 'bg-green-500 ring-4 ring-green-200/50'
                        : health?.status === 'degraded'
                        ? 'bg-yellow-500 ring-4 ring-yellow-200/50'
                        : 'bg-red-500 ring-4 ring-red-200/50'
                    }`}
                  />
                  <span className="text-3xl font-bold capitalize text-gray-900">
                    {health?.status || 'Unknown'}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <Card hover gradient className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-400/20 to-transparent rounded-full blur-2xl" />
            <div className="relative space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <NetworkIcon className="w-4 h-4 text-gray-700" />
                Supported Networks
              </h3>
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-gray-900">{networks.length}</span>
                  <span className="text-sm text-gray-700 font-medium">networks</span>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <Card hover gradient className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-transparent rounded-full blur-2xl" />
            <div className="relative space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <Code className="w-4 h-4 text-gray-700" />
                Version
              </h3>
              <span className="text-3xl font-bold text-gray-900">{health?.version || 'N/A'}</span>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants}>
        <Card gradient className="relative overflow-hidden border-0 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-indigo-50/30 to-purple-50/50" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Quick Actions
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <motion.div
                    key={action.href}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link href={action.href}>
                      <div className="group relative p-6 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/50 hover:border-blue-300 transition-all duration-300 hover:shadow-lg">
                        <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-5 rounded-xl transition-opacity`} />
                        <div className="relative flex items-start gap-4">
                          <div className={`p-3 bg-gradient-to-br ${action.gradient} rounded-lg shadow-lg group-hover:scale-110 transition-transform`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                              {action.label}
                            </h3>
                            <p className="text-sm text-gray-700 font-medium">{action.description}</p>
                          </div>
                          <Rocket className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Network Info */}
      {networks.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card gradient className="relative overflow-hidden border-0 shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-blue-50/30 to-purple-50/50" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg">
                  <NetworkIcon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Supported Networks
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {networks.map((network, index) => (
                  <motion.div
                    key={network.network}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.02, y: -4 }}
                    className={`group relative p-5 rounded-xl border transition-all duration-300 ${
                      network.status === 'coming_soon'
                        ? 'border-gray-300 bg-gray-50/50 opacity-75'
                        : 'border-gray-200/50 bg-white/80 backdrop-blur-sm hover:border-indigo-300 hover:shadow-lg'
                    }`}
                  >
                    {network.status !== 'coming_soon' && (
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity" />
                    )}
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-lg text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {network.network.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </h3>
                        {network.status === 'coming_soon' ? (
                          <span className="px-3 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full border border-yellow-200">
                            Coming Soon
                          </span>
                        ) : (
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-semibold text-gray-800">Chain ID:</span>
                          <span className="text-gray-700 font-mono font-semibold">{network.chain_id || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-semibold text-gray-800">Currency:</span>
                          <span className="text-gray-700 font-semibold">{network.currency || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
