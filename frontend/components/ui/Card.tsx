'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface CardProps {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
  hover?: boolean;
  gradient?: boolean;
  glassmorphism?: boolean;
}

export function Card({ 
  children, 
  className, 
  header, 
  footer, 
  hover = false,
  gradient = false,
  glassmorphism = false,
}: CardProps) {
  const CardWrapper = hover ? motion.div : 'div';
  const hoverProps = hover ? {
    whileHover: { scale: 1.01, y: -2 },
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  } : {};

  return (
    <CardWrapper
      {...hoverProps}
      className={cn(
        'rounded-2xl border transition-all duration-300',
        glassmorphism
          ? 'bg-gray-900/50 backdrop-blur-xl border-white/10 shadow-xl shadow-blue-500/10'
          : 'bg-gray-900/50 border-white/10 shadow-sm backdrop-blur-sm',
        hover && !glassmorphism && 'hover:shadow-xl hover:shadow-blue-500/20 hover:border-white/20',
        gradient && !glassmorphism && 'bg-gradient-to-br from-gray-900/60 via-blue-900/20 to-indigo-900/20',
        className
      )}
    >
      {header && (
        <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent rounded-t-2xl">
          {header}
        </div>
      )}
      <div className={cn('px-6 py-4', !header && 'pt-6', !footer && 'pb-6')}>
        {children}
      </div>
      {footer && (
        <div className="px-6 py-4 border-t border-white/10 bg-gradient-to-r from-white/5 to-transparent rounded-b-2xl">
          {footer}
        </div>
      )}
    </CardWrapper>
  );
}
