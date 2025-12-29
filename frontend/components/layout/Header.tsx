'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';
import { Menu, X, Sparkles } from 'lucide-react';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Solutions' },
    { href: '/', label: 'Enterprise' },
    { href: '/', label: 'Pricing' },
    { href: '/', label: 'Community' },
    { href: '/templates', label: 'Discover' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-[1440px] mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#ff3b30] rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">
                HyperAgent
              </span>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[14px] font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right side CTA */}
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" className="text-[14px] font-medium px-4 h-9">
                Log in
              </Button>
            </Link>
            <Link href="/workflows/create">
              <Button className="bg-gray-900 hover:bg-gray-800 text-white text-[14px] font-medium px-4 h-9 rounded-md">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
