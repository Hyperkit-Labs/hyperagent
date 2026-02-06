'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import Shield from 'lucide-react/dist/esm/icons/shield'
import Zap from 'lucide-react/dist/esm/icons/zap'

interface DeploymentModeSelectorProps {
  onSelect: (mode: 'server-wallet' | 'erc4337') => void;
  isSmartAccount: boolean;
}

export function DeploymentModeSelector({ onSelect, isSmartAccount }: DeploymentModeSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Choose Deployment Method</h3>
        <p className="text-sm text-gray-600">
          {isSmartAccount 
            ? 'Your wallet is a Smart Account. You can choose between server-sponsored or self-signed deployment.' 
            : 'Select how you want to deploy your contract.'}
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card 
          hover 
          onClick={() => onSelect('server-wallet')}
          className="cursor-pointer p-6 border-2 border-gray-200 hover:border-blue-500 transition-all"
        >
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Deploy for Me</h4>
              <p className="text-sm text-gray-600 mb-3">
                Fastest option. HyperAgent server handles everything. No wallet pop-ups.
              </p>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  <span>Zero wallet pop-ups</span>
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  <span>10-30 second deployment</span>
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />
                  <span>You own the contract</span>
                </div>
              </div>
              
              <Badge className="bg-green-100 text-green-800 border-green-200">
                Recommended
              </Badge>
            </div>
          </div>
        </Card>
        
        <Card 
          hover 
          onClick={() => isSmartAccount ? onSelect('erc4337') : null}
          className={`cursor-pointer p-6 border-2 transition-all ${
            isSmartAccount 
              ? 'border-gray-200 hover:border-purple-500' 
              : 'border-gray-100 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className="flex items-start space-x-4">
            <div className={`p-2 rounded-lg ${isSmartAccount ? 'bg-purple-100' : 'bg-gray-100'}`}>
              <Shield className={`w-6 h-6 ${isSmartAccount ? 'text-purple-600' : 'text-gray-400'}`} />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">I'll Sign It</h4>
              <p className="text-sm text-gray-600 mb-3">
                Maximum security. You sign the deployment transaction. Full decentralization.
              </p>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle2 className={`w-4 h-4 mr-2 ${isSmartAccount ? 'text-green-500' : 'text-gray-400'}`} />
                  <span>You sign transaction</span>
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle2 className={`w-4 h-4 mr-2 ${isSmartAccount ? 'text-green-500' : 'text-gray-400'}`} />
                  <span>Non-custodial deployment</span>
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <CheckCircle2 className={`w-4 h-4 mr-2 ${isSmartAccount ? 'text-green-500' : 'text-gray-400'}`} />
                  <span>Gas sponsored by HyperAgent</span>
                </div>
              </div>
              
              {isSmartAccount ? (
                <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
                  ERC-4337 Smart Account
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">
                  Requires Smart Account
                </Badge>
              )}
            </div>
          </div>
        </Card>
      </div>
      
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Both methods are gasless!</strong> You pay 0.10 USDC service fee. 
          HyperAgent pays the network gas (AVAX, ETH, etc.). No need to buy gas tokens.
        </p>
      </div>
    </div>
  );
}

