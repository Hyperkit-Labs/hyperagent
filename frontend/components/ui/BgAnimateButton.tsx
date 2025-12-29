"use client";

import { motion } from 'framer-motion';
import { Sparkles, CreditCard, Loader2, CheckCircle2 } from 'lucide-react';

interface BgAnimateButtonProps {
  onClick: () => void;
  state: 'idle' | 'payment_required' | 'processing' | 'success';
  price?: number;
  disabled?: boolean;
}

export function BgAnimateButton({ 
  onClick, 
  state, 
  price = 0.01,
  disabled 
}: BgAnimateButtonProps) {
  const buttonConfig = {
    idle: {
      label: "Generate with AI",
      gradient: "from-blue-500 to-purple-500",
      icon: Sparkles
    },
    payment_required: {
      label: `Pay ${price} USDC`,
      gradient: "from-green-500 to-emerald-500",
      icon: CreditCard
    },
    processing: {
      label: "Processing...",
      gradient: "from-yellow-500 to-orange-500",
      icon: Loader2
    },
    success: {
      label: "Complete!",
      gradient: "from-indigo-500 to-purple-500",
      icon: CheckCircle2
    }
  };
  
  const config = buttonConfig[state];
  const Icon = config.icon;
  
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || state === 'processing'}
      className="relative px-8 py-4 rounded-lg font-semibold text-white overflow-hidden"
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
    >
      <motion.div
        className={`absolute inset-0 bg-gradient-to-r ${config.gradient}`}
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "linear"
        }}
        style={{ backgroundSize: '200% 200%' }}
      />
      
      <span className="relative flex items-center gap-2 justify-center">
        <Icon className={`w-5 h-5 ${state === 'processing' ? 'animate-spin' : ''}`} />
        <span>{config.label}</span>
      </span>
    </motion.button>
  );
}

