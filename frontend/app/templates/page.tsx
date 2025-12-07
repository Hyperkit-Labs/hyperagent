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
import { FileText, Search, Code, Tag } from 'lucide-react';

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
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-600" />
          Contract Templates
        </h1>
        <p className="text-gray-600 mt-2">Browse and search contract templates</p>
      </motion.div>

      {/* Search */}
      <motion.div variants={itemVariants}>
        <Card>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search templates by name, type, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? (
                <>
                  <LoadingSpinner size="sm" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" text="Loading templates..." />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 font-semibold mb-2">No templates found</p>
            <p className="text-sm text-gray-500">
              {searchQuery ? 'Try a different search query' : 'No templates available'}
            </p>
          </div>
        </Card>
      ) : (
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {templates.map((template) => (
            <motion.div key={template.id} variants={itemVariants}>
              <Card hover className="h-full">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900 mb-1">{template.name}</h3>
                      {template.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{template.description}</p>
                      )}
                    </div>
                    <Code className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {template.contract_type && (
                      <Badge variant="info" size="sm">
                        {template.contract_type}
                      </Badge>
                    )}
                    {template.tags && template.tags.length > 0 && (
                      <>
                        {template.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="default" size="sm">
                            <Tag className="w-3 h-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                        {template.tags.length > 3 && (
                          <Badge variant="default" size="sm">
                            +{template.tags.length - 3} more
                          </Badge>
                        )}
                      </>
                    )}
                  </div>

                  {template.version && (
                    <div className="text-xs text-gray-500">
                      Version: {template.version}
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
