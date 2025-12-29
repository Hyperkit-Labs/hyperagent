'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';
import { Menu, X, Sparkles, Shield, Zap } from 'lucide-react';
import { CompactWalletButton } from '@/components/wallet/WalletConnect';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/deployments', label: 'Deployments' },
    { href: '/contracts', label: 'Contracts' },
    { href: '/monitoring', label: 'Analytics' },
    { href: '/templates', label: 'Templates' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
      <div className="max-w-[1440px] mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-10">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 tracking-tight">
                HyperAgent
              </span>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[14px] font-semibold text-gray-500 hover:text-blue-600 transition-colors relative group"
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full" />
                </Link>
              ))}
            </nav>
          </div>

          {/* Right side CTA */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <CompactWalletButton />
            </div>
            
            <Link href="/workflows/create">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-semibold px-5 h-10 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                Launch App
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
