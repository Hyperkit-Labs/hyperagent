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
    default: 'bg-gray-100 text-gray-800 border-gray-200',
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    gradient: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-transparent',
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
