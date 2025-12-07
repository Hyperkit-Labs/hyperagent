'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';
import { Menu, X, Sparkles } from 'lucide-react';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/workflows', label: 'Workflows' },
    { href: '/contracts', label: 'Contracts' },
    { href: '/deployments', label: 'Deployments' },
    { href: '/templates', label: 'Templates' },
    { href: '/monitoring', label: 'Monitoring' },
    { href: '/architecture', label: 'Architecture' },
    { href: '/avax/analytics', label: 'Analytics' },
    { href: '/avax/studio', label: 'Avalanche Studio', highlight: true },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200/80 shadow-sm">
      <div className="max-w-[1920px] mx-auto px-6 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0">
            <Link 
              href="/" 
              className="flex items-center gap-3 group"
            >
              <div className="w-11 h-11 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 transition-transform group-hover:scale-105">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent tracking-tight">
                HyperAgent
              </span>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center ml-20 gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    link.highlight
                      ? 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-4">
            <Link href="/workflows/create">
              <Button variant="gradient" className="px-5 py-2.5 text-sm font-semibold">
                <Sparkles className="w-4 h-4 mr-2" />
                Create Workflow
              </Button>
            </Link>
          </div>

          {/* Mobile/Tablet Menu Button */}
          <button
            className="lg:hidden p-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile/Tablet Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <nav className="flex flex-col py-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-6 py-3 text-base font-medium transition-colors ${
                    link.highlight
                      ? 'text-blue-700 bg-blue-50 border-l-4 border-blue-600'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 px-6 py-4 border-t border-gray-200">
                <Link
                  href="/workflows/create"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button variant="gradient" className="w-full py-3 text-base font-semibold">
                    <Sparkles className="w-5 h-5 mr-2" />
                    Create Workflow
                  </Button>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
