'use client';

import { cn, getStatusColor } from '@/lib/utils';
import { motion } from 'framer-motion';

interface StatusBadgeProps {
  status: string;
  className?: string;
  pulse?: boolean;
}

export function StatusBadge({ status, className, pulse = false }: StatusBadgeProps) {
  const BadgeWrapper = pulse ? motion.span : 'span';
  const pulseProps = pulse
    ? {
        animate: { scale: [1, 1.1, 1] },
        transition: { duration: 2, repeat: Infinity },
      }
    : {};

  return (
    <BadgeWrapper
      {...pulseProps}
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border shadow-sm',
        getStatusColor(status),
        className
      )}
    >
      <span className="relative flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    </BadgeWrapper>
  );
}
