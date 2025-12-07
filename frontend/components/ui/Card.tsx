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
          ? 'bg-white/80 backdrop-blur-xl border-white/30 shadow-xl shadow-blue-500/10'
          : 'bg-white border-gray-200/70 shadow-sm',
        hover && !glassmorphism && 'hover:shadow-xl hover:shadow-blue-500/10',
        gradient && !glassmorphism && 'bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/20',
        className
      )}
    >
      {header && (
        <div className="px-6 py-4 border-b border-gray-200/50 bg-gradient-to-r from-gray-50/50 to-transparent rounded-t-2xl">
          {header}
        </div>
      )}
      <div className={cn('px-6 py-4', !header && 'pt-6', !footer && 'pb-6')}>
        {children}
      </div>
      {footer && (
        <div className="px-6 py-4 border-t border-gray-200/50 bg-gradient-to-r from-gray-50/50 to-transparent rounded-b-2xl">
          {footer}
        </div>
      )}
    </CardWrapper>
  );
}
