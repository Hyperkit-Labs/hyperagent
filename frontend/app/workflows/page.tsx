'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { WorkflowCard } from '@/components/workflows/WorkflowCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { getWorkflows } from '@/lib/api';
import type { Workflow } from '@/lib/types';
import { FileCode, Plus, Filter, RefreshCw } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
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

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchWorkflows();
  }, [filter]);

  const fetchWorkflows = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWorkflows({
        status: filter !== 'all' ? filter : undefined,
        limit: 100,
      });
      setWorkflows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
      console.error('Failed to fetch workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkflows = workflows;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileCode className="w-8 h-8 text-blue-600" />
            Workflows
          </h1>
          <p className="text-gray-600 mt-2">View and manage your smart contract workflows</p>
        </div>
        <Link href="/workflows/create">
          <Button variant="gradient">
            <Plus className="w-4 h-4 mr-2" />
            Create Workflow
          </Button>
        </Link>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants}>
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Filter className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-semibold text-gray-700">Filter by Status:</span>
              <div className="flex gap-2">
                {['all', 'completed', 'generating', 'compiling', 'auditing', 'testing', 'deploying', 'failed'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      filter === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={fetchWorkflows}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </Card>
      </motion.div>

      {/* Workflows Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" text="Loading workflows..." />
        </div>
      ) : error ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-red-600 font-semibold mb-2">Error loading workflows</p>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchWorkflows} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </Card>
      ) : filteredWorkflows.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FileCode className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 font-semibold mb-2">No workflows found</p>
            <p className="text-sm text-gray-500 mb-6">
              {filter !== 'all' ? `No workflows with status "${filter}"` : 'Get started by creating your first workflow'}
            </p>
            <Link href="/workflows/create">
              <Button variant="gradient">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Workflow
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredWorkflows.map((workflow) => (
            <motion.div key={workflow.workflow_id} variants={itemVariants}>
              <WorkflowCard workflow={workflow} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
