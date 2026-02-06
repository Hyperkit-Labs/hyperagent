'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/Header';

export function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Route configuration mapping
  const routeConfig: Record<string, { name: string; section: string }> = {
    '/': { name: 'Dashboard', section: 'Overview' },
    '/workflows': { name: 'Workflows', section: 'Overview' },
    '/contracts': { name: 'Contracts', section: 'Overview' },
    '/deployments': { name: 'Deployments', section: 'Overview' },
    '/networks': { name: 'Networks', section: 'Overview' },
    '/agents': { name: 'Agents', section: 'Overview' },
    '/security': { name: 'Security', section: 'Overview' },
    '/analytics': { name: 'Analytics', section: 'Observability' },
    '/logs': { name: 'Logs', section: 'Observability' },
    '/docs': { name: 'Documentation', section: 'Resources' },
    '/settings': { name: 'Settings', section: 'Resources' },
  };

  const currentPageConfig = routeConfig[pathname] || { name: 'Dashboard', section: 'Overview' };

  return (
    <div className="bg-[#05050A] text-slate-300 antialiased overflow-hidden h-screen selection:bg-violet-500/30 selection:text-violet-200">
      {/* Ambient Spotlights */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-96 bg-violet-600/20 blur-[120px] rounded-full pointer-events-none z-0 mix-blend-screen" />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none z-0" />

      {/* Mobile Sidebar Overlay */}
      <div
        id="mobile-overlay"
        onClick={() => setIsSidebarOpen(false)}
        className={`fixed z-40 transition-opacity md:hidden ${
          isSidebarOpen ? 'block' : 'hidden'
        }`}
      />

      <div className="relative z-10 flex h-full bg-grid">
        <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Main Content Wrapper */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#05050A]/50 transition-all">
          <Header 
            onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
            currentPage={currentPageConfig.name}
            currentSection={currentPageConfig.section}
          />

          {/* Dashboard Content Scrollable Area - Scrollbar Hidden */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-10 space-y-8 scroll-smooth scrollbar-hide">
            {children}
          </div>
        </main>
      </div>

      <style jsx>{`
        .bg-grid {
          background-size: 40px 40px;
          background-image: linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
        }
        
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}