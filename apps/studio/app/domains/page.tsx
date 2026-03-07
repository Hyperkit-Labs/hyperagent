"use client";

import { useState } from "react";
import { Server, Globe, Shield, Container, Settings } from "lucide-react";
import { EmptyState } from "@/components/ui";

type InfraTab = "domains" | "certificates" | "deployments";

const TABS: { id: InfraTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "domains", label: "Domains", icon: Globe },
  { id: "certificates", label: "Certificates", icon: Shield },
  { id: "deployments", label: "Deployments", icon: Container },
];

export default function DomainsPage() {
  const [tab, setTab] = useState<InfraTab>("domains");

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6 animate-enter">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Server className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Infrastructure</h1>
            <p className="text-xs text-[var(--color-text-tertiary)]">Manage domains, certificates, and deployment infrastructure</p>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary-gradient text-xs px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Settings className="w-3.5 h-3.5" />
          Configure
        </button>
      </div>

      <div className="flex gap-1 border-b border-[var(--color-border-subtle)]">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-[var(--color-primary-light)] text-[var(--color-text-primary)]"
                  : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              }`}
              aria-selected={tab === t.id}
              role="tab"
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "domains" && (
        <div className="glass-panel rounded-xl p-6">
          <EmptyState
            icon={<Globe className="w-8 h-8 text-[var(--color-text-muted)]" />}
            title="No custom domains"
            description="Custom domains allow users to access your deployed dApps at a branded URL. Deploy a dApp first, then configure a domain."
            action={
              <button type="button" className="btn-primary-gradient text-xs px-4 py-1.5 rounded-lg">
                Add domain
              </button>
            }
          />
        </div>
      )}

      {tab === "certificates" && (
        <div className="glass-panel rounded-xl p-6">
          <EmptyState
            icon={<Shield className="w-8 h-8 text-[var(--color-text-muted)]" />}
            title="No SSL certificates"
            description="SSL certificates are auto-provisioned when you add a custom domain. Add a domain to get started."
          />
        </div>
      )}

      {tab === "deployments" && (
        <div className="glass-panel rounded-xl p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Deployment targets</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { name: "Vercel", status: "available", desc: "Frontend hosting for Next.js dApps" },
                { name: "IPFS / Pinata", status: "available", desc: "Decentralized hosting for static dApps" },
                { name: "Docker", status: "coming soon", desc: "Container deployments for backend services" },
                { name: "Custom Server", status: "coming soon", desc: "Deploy to your own infrastructure" },
              ].map((target) => (
                <div key={target.name} className="glass-panel glass-panel-hover rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{target.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      target.status === "available"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-[var(--color-bg-panel)] text-[var(--color-text-muted)]"
                    }`}>
                      {target.status}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{target.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
