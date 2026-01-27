'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  pulse?: boolean;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className,
  pulse = false,
}: BadgeProps) {
  const variants = {
    default: 'bg-white/10 text-gray-300 border-white/20',
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    gradient: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-transparent shadow-lg shadow-blue-500/20',
  };

  const sizes_map = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const BadgeWrapper = pulse ? motion.span : 'span';

  const pulseProps = pulse
    ? {
        animate: { scale: [1, 1.05, 1] },
        transition: { duration: 2, repeat: Infinity },
      }
    : {};

  return (
    <BadgeWrapper
      {...pulseProps}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold border',
        variants[variant],
        sizes_map[size],
        className
      )}
    >
      {children}
    </BadgeWrapper>
  );
}
