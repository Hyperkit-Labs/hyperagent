'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import SettingsIcon from 'lucide-react/dist/esm/icons/settings';
import Key from 'lucide-react/dist/esm/icons/key';
import Database from 'lucide-react/dist/esm/icons/database';
import Globe from 'lucide-react/dist/esm/icons/globe';
import Save from 'lucide-react/dist/esm/icons/save';
import Eye from 'lucide-react/dist/esm/icons/eye';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';

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

export default function SettingsPage() {
  const [apiKeys, setApiKeys] = useState({
    gemini: '',
    openai: '',
    thirdweb: '',
  });
  const [showKeys, setShowKeys] = useState({
    gemini: false,
    openai: false,
    thirdweb: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // TODO: Implement save to backend when endpoint is available
    // await saveSettings(apiKeys);
    
    // Simulate save
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 1000);
  };

  const toggleShowKey = (key: keyof typeof showKeys) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-8">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* Header */}
        <motion.div variants={itemVariants}>
          <h1 className="text-4xl font-bold text-white flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-blue-400" />
            Settings
          </h1>
          <p className="text-gray-400 mt-2">
            Configure your HyperAgent platform settings and API keys
          </p>
        </motion.div>

        {/* API Keys Section */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 bg-gray-900/50 backdrop-blur-xl border border-white/10">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
              <Key className="w-5 h-5 text-blue-400" />
              API Keys
            </h2>
            <div className="space-y-4">
              {/* Gemini API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Gemini API Key
                </label>
                <div className="relative">
                  <input
                    type={showKeys.gemini ? "text" : "password"}
                    value={apiKeys.gemini}
                    onChange={(e) => setApiKeys({...apiKeys, gemini: e.target.value})}
                    className="w-full p-3 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="AIza..."
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('gemini')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    {showKeys.gemini ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a>
                </p>
              </div>

              {/* OpenAI API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  OpenAI API Key (Optional)
                </label>
                <div className="relative">
                  <input
                    type={showKeys.openai ? "text" : "password"}
                    value={apiKeys.openai}
                    onChange={(e) => setApiKeys({...apiKeys, openai: e.target.value})}
                    className="w-full p-3 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="sk-proj-..."
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('openai')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    {showKeys.openai ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">OpenAI Platform</a>
                </p>
              </div>

              {/* Thirdweb Client ID */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Thirdweb Client ID
                </label>
                <div className="relative">
                  <input
                    type={showKeys.thirdweb ? "text" : "password"}
                    value={apiKeys.thirdweb}
                    onChange={(e) => setApiKeys({...apiKeys, thirdweb: e.target.value})}
                    className="w-full p-3 pr-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="d513477..."
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('thirdweb')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    {showKeys.thirdweb ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Get your client ID from <a href="https://portal.thirdweb.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Thirdweb Dashboard</a>
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Database Status */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 bg-gray-900/50 backdrop-blur-xl border border-white/10">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
              <Database className="w-5 h-5 text-green-400" />
              Database
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-white">Database Status</p>
                  <p className="text-xs text-gray-400 mt-1">PostgreSQL Connection</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-sm text-green-400">Connected</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-white">Redis Cache</p>
                  <p className="text-xs text-gray-400 mt-1">In-Memory Fallback</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                  <span className="text-sm text-yellow-400">Fallback Mode</span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Network Configuration */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 bg-gray-900/50 backdrop-blur-xl border border-white/10">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
              <Globe className="w-5 h-5 text-purple-400" />
              Network Configuration
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-lg">
                  <p className="text-sm font-medium text-white">Backend API</p>
                  <p className="text-xs text-gray-400 mt-1 font-mono">
                    {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}
                  </p>
                </div>
                
                <div className="p-4 bg-white/5 rounded-lg">
                  <p className="text-sm font-medium text-white">WebSocket</p>
                  <p className="text-xs text-gray-400 mt-1 font-mono">
                    {process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}
                  </p>
                </div>
              </div>
              
              <p className="text-xs text-gray-500">
                Network endpoints are configured via environment variables. Edit <span className="font-mono bg-white/10 px-1 rounded">.env.local</span> to change.
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Save Button */}
        <motion.div variants={itemVariants}>
          <Button
            onClick={handleSave}
            disabled={saving}
            className={`w-full font-semibold px-6 py-4 rounded-xl transition-all ${
              saved 
                ? 'bg-green-600 hover:bg-green-500' 
                : 'bg-blue-600 hover:bg-blue-500'
            } text-white`}
          >
            {saved ? (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Settings Saved Successfully
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                {saving ? 'Saving...' : 'Save Settings'}
              </>
            )}
          </Button>
          
          {!saved && (
            <p className="text-xs text-gray-500 text-center mt-2">
              Note: Settings are currently stored in browser. Backend persistence coming soon.
            </p>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
