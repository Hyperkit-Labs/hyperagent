'use client';

import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';
import { formatRelativeTime } from '@/lib/utils';
import type { Workflow } from '@/lib/types';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, FileCode, Clock, CheckCircle2 } from 'lucide-react';

interface WorkflowCardProps {
  workflow: Workflow;
}

export function WorkflowCard({ workflow }: WorkflowCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <Card hover glassmorphism className="h-full">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {workflow.name || `Workflow ${workflow.workflow_id.slice(0, 8)}`}
              </h3>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <FileCode className="w-4 h-4" />
                  <span>{workflow.contract_type || 'Custom'}</span>
                </div>
                <span>•</span>
                <span className="font-medium">{workflow.network.replace(/_/g, ' ')}</span>
              </div>
            </div>
            <StatusBadge status={workflow.status} />
          </div>

          <ProgressBar progress={workflow.progress_percentage} />

          <div className="flex items-center justify-between pt-2 border-t border-gray-200/50">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span>{formatRelativeTime(workflow.created_at)}</span>
            </div>
            {workflow.contracts && workflow.contracts.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="font-medium">{workflow.contracts.length} contract(s)</span>
              </div>
            )}
          </div>

          <Link href={`/workflows/${workflow.workflow_id}`}>
            <Button variant="gradient" className="w-full group">
              View Details
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </Card>
    </motion.div>
  );
}
