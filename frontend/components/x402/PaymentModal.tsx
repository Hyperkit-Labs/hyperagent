'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import type { PaymentInfo } from '@/lib/x402Client';
import { createPaymentWallet, createFetchWithPayment, getAvalancheChain } from '@/lib/thirdwebClient';

interface PaymentModalProps {
  paymentInfo: PaymentInfo;
  onPaymentComplete: (paymentData: string) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export function PaymentModal({
  paymentInfo,
  onPaymentComplete,
  onCancel,
  isOpen,
}: PaymentModalProps) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStatus('idle');
      setError(null);
    }
  }, [isOpen]);

  const handlePayment = async () => {
    setStatus('pending');
    setError(null);

    try {
      // Create wallet and fetch wrapper with x402 payment handling
      const wallet = await createPaymentWallet();
      
      // Connect wallet (user will approve connection)
      const account = await wallet.connect();

      if (!account) {
        throw new Error('Wallet connection failed. Please ensure your wallet is unlocked and try again.');
      }

      // Create fetch wrapper that handles x402 payments automatically
      const fetchWithPayment = createFetchWithPayment(wallet);

      // Build the resource URL for payment
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
      const resourceUrl = `${API_BASE_URL}${paymentInfo.endpoint}`;

      // Use wrapFetchWithPayment to make request
      // This automatically:
      // 1. Makes the request
      // 2. If 402, prompts user to approve payment via wallet
      // 3. Executes payment transaction on-chain
      // 4. Retries request with payment data in x-payment header
      const response = await fetchWithPayment(resourceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Include original request body if needed
        }),
      });

      if (response.ok) {
        // Payment successful - the payment data is automatically handled
        const responseData = await response.json();
        
        setStatus('success');
        setTimeout(() => {
          onPaymentComplete('payment_completed');
        }, 1000);
      } else {
        // Handle specific error codes
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = 'Payment failed';

        if (response.status === 402) {
          errorMessage = 'Payment required. Please approve the transaction in your wallet.';
        } else if (response.status === 403) {
          errorMessage = errorData.message || 'Spending limit exceeded or payment not allowed.';
        } else if (response.status === 502 || response.status === 503 || response.status === 504) {
          errorMessage = 'Payment service temporarily unavailable. Please try again in a few moments.';
        } else if (response.status === 400) {
          errorMessage = errorData.detail || errorData.message || 'Invalid payment request.';
        } else {
          errorMessage = errorData.detail || errorData.message || `Payment failed: ${response.statusText}`;
        }

        throw new Error(errorMessage);
      }
    } catch (err) {
      setStatus('failed');
      let errorMessage = 'Payment failed';
      
      if (err instanceof Error) {
        errorMessage = err.message;
        
        // Provide helpful fallback instructions
        if (errorMessage.includes('connection') || errorMessage.includes('network')) {
          errorMessage += '\n\nPlease check your internet connection and ensure your wallet is connected.';
        } else if (errorMessage.includes('limit') || errorMessage.includes('exceeded')) {
          errorMessage += '\n\nYou can adjust your spending limits in the settings or wait for the limit period to reset.';
        } else if (errorMessage.includes('wallet')) {
          errorMessage += '\n\nMake sure your wallet is unlocked and you have sufficient USDC balance.';
        } else if (errorMessage.includes('unavailable') || errorMessage.includes('502') || errorMessage.includes('503')) {
          errorMessage += '\n\nThe payment service is temporarily down. Please try again in a few minutes.';
        }
      }
      
      setError(errorMessage);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Payment Required</h2>
        
        <div className="space-y-4 mb-6">
          <div>
            <p className="text-sm text-gray-600">Endpoint</p>
            <p className="font-mono text-sm">{paymentInfo.endpoint}</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-600">Price</p>
            <p className="text-2xl font-bold">${paymentInfo.price_usdc} {paymentInfo.currency}</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-600">Network</p>
            <p className="font-medium">{paymentInfo.network}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-red-800 mb-1">Payment Error</h4>
                <p className="text-red-700 text-sm whitespace-pre-line">{error}</p>
              </div>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
            Payment successful!
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={status === 'pending' || status === 'success'}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handlePayment}
            disabled={status === 'pending' || status === 'success'}
            className="flex-1"
          >
            {status === 'pending' && 'Processing...'}
            {status === 'idle' && 'Pay with Wallet'}
            {status === 'success' && 'Success!'}
            {status === 'failed' && 'Retry'}
          </Button>
        </div>
      </div>
    </div>
  );
}

