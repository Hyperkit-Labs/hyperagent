'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { Rocket, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function DeploymentsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Rocket className="w-8 h-8 text-blue-600" />
          Deployments
        </h1>
        <p className="text-gray-600 mt-2">View all contract deployments</p>
      </div>

      <Card>
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
            <Rocket className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Deployment Information</h2>
          <p className="text-gray-600 mb-2 max-w-md mx-auto">
            Deployment details are available in workflow pages after contracts are deployed.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Each deployment includes contract address, transaction hash, block number, and gas usage.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/workflows">
              <Button variant="gradient">
                View Workflows
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/workflows/create">
              <Button variant="outline">
                Create & Deploy
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
