'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { Rocket, ArrowRight } from 'lucide-react';

export default function DeploymentsPage() {
  return (
    <div className="min-h-screen bg-[#0A0B14] text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[1440px] mx-auto px-6 py-12 space-y-12"
      >
        {/* Header */}
        <div className="relative">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 flex items-center gap-4">
            <div className="p-3 bg-blue-600/20 rounded-2xl border border-blue-500/30">
              <Rocket className="w-8 h-8 text-blue-400" />
            </div>
            Deployments
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            Track and manage your smart contract deployments across all supported Web3 networks.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <Card className="bg-[#161721] border-white/5 p-12 overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 rounded-full blur-[80px] group-hover:bg-green-500/10 transition-colors" />
            
            <div className="text-center relative z-10">
              <div className="w-24 h-24 mx-auto mb-8 bg-green-500/10 rounded-[2rem] border border-green-500/20 flex items-center justify-center rotate-3 group-hover:rotate-6 transition-transform">
                <Rocket className="w-12 h-12 text-green-400 -rotate-3 group-hover:-rotate-6 transition-transform" />
              </div>
              <h2 className="text-3xl font-bold mb-4">No Active Deployments</h2>
              <p className="text-gray-400 mb-8 max-w-lg mx-auto text-lg leading-relaxed">
                Start building your Web3 application using our AI-powered workflows. 
                Deployments will appear here once they are initiated in the Studio.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/workflows/create">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-14 rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02]">
                    Start New Deployment
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/workflows">
                  <Button variant="outline" className="border-white/10 hover:bg-white/5 text-white px-8 h-14 rounded-2xl font-bold text-lg transition-all">
                    View Workflows
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
