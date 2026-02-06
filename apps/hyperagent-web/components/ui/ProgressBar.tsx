'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  className?: string;
  animated?: boolean;
}

export function ProgressBar({ 
  progress, 
  label, 
  showPercentage = true, 
  className,
  animated = true,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-gray-300">{label}</span>
          {showPercentage && (
            <span className="text-sm font-bold text-white">{Math.round(clampedProgress)}%</span>
          )}
        </div>
      )}
      <div className="w-full bg-gray-800/50 rounded-full h-2.5 overflow-hidden shadow-inner border border-white/5">
        <motion.div
          initial={animated ? { width: 0 } : false}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn(
            'h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500',
            'shadow-lg shadow-blue-500/50',
            'relative overflow-hidden'
          )}
        >
          <motion.div
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
            }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          />
        </motion.div>
      </div>
    </div>
  );
}
