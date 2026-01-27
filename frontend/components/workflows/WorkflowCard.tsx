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
      <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-blue-500/50 transition-all h-full flex flex-col">
        <div className="space-y-4 flex-1">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-1">
                {workflow.name || workflow.intent?.slice(0, 50) || `Workflow ${workflow.workflow_id.slice(0, 8)}`}
              </h3>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <div className="flex items-center gap-1">
                  <FileCode className="w-4 h-4" />
                  <span>{workflow.contract_type || 'Custom'}</span>
                </div>
                <span>•</span>
                <span className="font-medium">{workflow.network?.replace(/_/g, ' ') || 'Unknown'}</span>
              </div>
            </div>
            <StatusBadge status={workflow.status} />
          </div>

          <ProgressBar progress={workflow.progress_percentage ?? 0} />

          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Clock className="w-4 h-4" />
              <span>{formatRelativeTime(workflow.created_at || workflow.meta?.createdAt)}</span>
            </div>
            {(workflow.contracts && workflow.contracts.length > 0) || workflow.contract || workflow.meta?.contracts?.items?.length > 0 ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="font-medium">
                  {workflow.contracts?.length || workflow.meta?.contracts?.items?.length || 1} contract(s)
                </span>
              </div>
            ) : null}
          </div>

          <Link href={`/workflows/${workflow.workflow_id}`}>
            <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl group">
              View Details
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
