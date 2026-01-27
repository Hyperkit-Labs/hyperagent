'use client';

import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { copyToClipboard } from '@/lib/utils';
import { Copy, Check, Download } from 'lucide-react';

interface ContractViewerProps {
  contractCode: string;
  abi?: any[];
  contractName?: string;
}

export function ContractViewer({ contractCode, abi, contractName }: ContractViewerProps) {
  const [copied, setCopied] = useState(false);
  const [showABI, setShowABI] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(contractCode);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([contractCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${contractName || 'contract'}.sol`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Contract Code</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} className="border-white/20 hover:bg-white/10">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} className="border-white/20 hover:bg-white/10">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden border border-white/10 bg-gray-900/80">
          <SyntaxHighlighter
            language="solidity"
            style={vscDarkPlus}
            customStyle={{ margin: 0, borderRadius: 0, background: 'transparent' }}
            showLineNumbers
          >
            {contractCode}
          </SyntaxHighlighter>
        </div>

        {abi && abi.length > 0 && (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setShowABI(!showABI)} className="text-gray-400 hover:text-white">
              {showABI ? 'Hide' : 'Show'} ABI
            </Button>
            {showABI && (
              <div className="mt-2 rounded-xl overflow-hidden border border-white/10 bg-gray-900/80">
                <SyntaxHighlighter
                  language="json"
                  style={vscDarkPlus}
                  customStyle={{ margin: 0, borderRadius: 0, background: 'transparent' }}
                >
                  {JSON.stringify(abi, null, 2)}
                </SyntaxHighlighter>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

