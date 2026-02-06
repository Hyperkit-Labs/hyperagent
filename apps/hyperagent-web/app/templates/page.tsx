'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getTemplates, searchTemplates } from '@/lib/api';
import type { Template } from '@/lib/types';
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Search from 'lucide-react/dist/esm/icons/search'
import Code from 'lucide-react/dist/esm/icons/code'
import Tag from 'lucide-react/dist/esm/icons/tag'
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right'
import Link from 'next/link';

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

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchTemplates();
      return;
    }

    setSearching(true);
    try {
      const data = await searchTemplates({ query: searchQuery });
      setTemplates(data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0B14] text-white">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-[1440px] mx-auto px-6 py-12 space-y-12"
      >
        {/* Header */}
        <div className="relative">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
          <motion.div variants={itemVariants}>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 flex items-center gap-4">
              <div className="p-3 bg-blue-600/20 rounded-2xl border border-blue-500/30">
                <FileText className="w-8 h-8 text-blue-400" />
              </div>
              Blueprints
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl">
              Launch pre-configured Web3 applications and smart contracts using our verified blueprints.
            </p>
          </motion.div>
        </div>

        {/* Search */}
        <motion.div variants={itemVariants}>
          <Card className="bg-[#161721] border-white/5 p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                <Input
                  placeholder="Search blueprints by name, type, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-12 bg-[#0A0B14] border-white/10 text-white h-12 rounded-xl focus:ring-blue-500/50"
                />
              </div>
              <Button 
                onClick={handleSearch} 
                disabled={searching}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-12 rounded-xl font-bold transition-all"
              >
                {searching ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search Blueprints
                  </>
                )}
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Templates Grid */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading blueprints..." />
          </div>
        ) : templates.length === 0 ? (
          <Card className="bg-[#161721] border-white/5">
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto mb-6 bg-white/5 rounded-2xl flex items-center justify-center">
                <FileText className="w-10 h-10 text-gray-500" />
              </div>
              <p className="text-xl font-bold text-white mb-2">No blueprints found</p>
              <p className="text-gray-400">
                {searchQuery ? 'Try a different search query' : 'No blueprints available'}
              </p>
            </div>
          </Card>
        ) : (
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {templates.map((template) => (
              <motion.div key={template.id} variants={itemVariants}>
                <Link href={`/workflows/create?prompt=${encodeURIComponent(template.description || '')}`}>
                  <Card hover className="h-full bg-[#161721] border-white/5 hover:border-blue-500/30 p-6 transition-all group">
                    <div className="space-y-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold text-xl text-white mb-2 group-hover:text-blue-400 transition-colors">
                            {template.name}
                          </h3>
                          {template.description && (
                            <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">
                              {template.description}
                            </p>
                          )}
                        </div>
                        <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                          <Code className="w-5 h-5 text-blue-400" />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
                        {template.contract_type && (
                          <Badge className="bg-blue-500/10 text-blue-400 border-none hover:bg-blue-500/20">
                            {template.contract_type}
                          </Badge>
                        )}
                        {template.tags && template.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} className="bg-white/5 text-gray-400 border-none hover:bg-white/10">
                            <Tag className="w-3 h-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
