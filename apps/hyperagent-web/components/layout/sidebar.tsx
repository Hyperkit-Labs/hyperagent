'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Zap from 'lucide-react/dist/esm/icons/zap';
import ChevronsUpDown from 'lucide-react/dist/esm/icons/chevrons-up-down';
import X from 'lucide-react/dist/esm/icons/x';
import LayoutDashboard from 'lucide-react/dist/esm/icons/layout-dashboard';
import GitBranch from 'lucide-react/dist/esm/icons/git-branch';
import FileCode from 'lucide-react/dist/esm/icons/file-code';
import Rocket from 'lucide-react/dist/esm/icons/rocket';
import Globe from 'lucide-react/dist/esm/icons/globe';
import Bot from 'lucide-react/dist/esm/icons/bot';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check';
import FlaskConical from 'lucide-react/dist/esm/icons/flask-conical';
import BarChart2 from 'lucide-react/dist/esm/icons/bar-chart-2';
import ScrollText from 'lucide-react/dist/esm/icons/scroll-text';
import Book from 'lucide-react/dist/esm/icons/book';
import Settings from 'lucide-react/dist/esm/icons/settings';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigationItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, href: '/', section: 'Overview' },
  { id: 'workflows', label: 'Workflows', icon: GitBranch, href: '/workflows', section: 'Overview' },
  { id: 'contracts', label: 'Contracts', icon: FileCode, href: '/contracts', section: 'Overview' },
  { id: 'deployments', label: 'Deployments', icon: Rocket, href: '/deployments', section: 'Overview' },
  { id: 'networks', label: 'Networks', icon: Globe, href: '/networks', section: 'Overview' },
  { id: 'agents', label: 'Agents', icon: Bot, href: '/agents', section: 'Overview' },
  { id: 'security', label: 'Security', icon: ShieldCheck, href: '/security', section: 'Overview' }
];

const observabilityItems = [
  { id: 'analytics', label: 'Analytics', icon: BarChart2, href: '/analytics', section: 'Observability' },
  { id: 'logs', label: 'Logs', icon: ScrollText, href: '/logs', section: 'Observability' },
];

const utilityItems = [
  { id: 'docs', label: 'Docs', icon: Book, href: '/docs', section: 'Resources' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings', section: 'Resources' },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-white/5 bg-[#08080C] md:bg-[#08080C]/80 backdrop-blur-xl transition-transform duration-300 transform ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 md:static`}
    >
      {/* App Logo & Workspace */}
      <div className="h-14 flex items-center px-4 border-b border-white/5 gap-3 shrink-0">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.3)]">
          <Zap className="text-white w-4 h-4 fill-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white tracking-tight">HyperAgent</span>
          <span className="text-[10px] text-slate-500 font-medium">Workspace A</span>
        </div>
        {/* Desktop Workspace Switcher */}
        <button className="hidden md:flex ml-auto text-slate-500 hover:text-white transition-colors">
          <ChevronsUpDown className="w-4 h-4" />
        </button>
        {/* Mobile Close Button */}
        <button
          onClick={onClose}
          className="md:hidden ml-auto text-slate-500 hover:text-white transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5 scrollbar-hide">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all group ${
                active
                  ? 'text-white bg-white/5 border border-white/5 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 ${
                active 
                  ? 'text-violet-400' 
                  : 'text-slate-500 group-hover:text-slate-300'
              }`} />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4 pb-2 px-3 text-[10px] uppercase tracking-wider text-slate-600 font-semibold">
          Observability
        </div>

        {observabilityItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all group ${
                active
                  ? 'text-white bg-white/5 border border-white/5 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 ${
                active 
                  ? 'text-violet-400' 
                  : 'text-slate-500 group-hover:text-slate-300'
              }`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Utilities */}
      <div className="p-4 border-t border-white/5 space-y-3 shrink-0 bg-[#08080C] md:bg-transparent">
        {utilityItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all group ${
                active
                  ? 'text-white bg-white/5'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
              {item.label}
            </Link>
          );
        })}

        <div className="flex items-center justify-between pt-2">
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
            Devnet
          </span>
          <button className="text-xs text-slate-500 hover:text-violet-400 transition-colors">
            Help ?
          </button>
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </aside>
  );
};