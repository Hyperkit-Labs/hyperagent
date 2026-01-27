'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost' | 'gradient';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    children: ReactNode;
    loading?: boolean;
  }
  
  export function Button({
    variant = 'primary',
    size = 'md',
    className,
    children,
    disabled,
    loading = false,
    ...props
  }: ButtonProps) {
    const baseStyles = 'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed relative overflow-hidden';
    
    const variants = {
      primary: 'bg-blue-600 text-white hover:bg-blue-500 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 active:scale-95',
      secondary: 'bg-white/10 text-white hover:bg-white/20 focus:ring-white/50 border border-white/10 shadow-sm hover:shadow-md backdrop-blur-sm',
      danger: 'bg-red-600 text-white hover:bg-red-500 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900 shadow-lg shadow-red-500/20 hover:shadow-xl hover:shadow-red-500/30 active:scale-95',
      outline: 'border-2 border-white/20 text-white hover:bg-white/10 hover:border-white/30 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-gray-900 bg-transparent backdrop-blur-sm',
      ghost: 'text-gray-400 hover:text-white hover:bg-white/5 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-gray-900',
      gradient: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 active:scale-95',
    };
  
    const sizes = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-5 py-2.5 text-base',
      lg: 'px-6 py-3 text-lg',
      icon: 'h-10 w-10 p-0',
    };

  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </span>
      )}
      <span className={loading ? 'opacity-0' : ''}>{children}</span>
    </motion.button>
  );
}
