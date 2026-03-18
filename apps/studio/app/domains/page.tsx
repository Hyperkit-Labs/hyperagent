"use client";

import { useState } from "react";
import useSWR from "swr";
import { RequireApiSession } from "@/components/auth/RequireApiSession";
import { Server, Globe, Shield, Container, Settings, Loader2, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { PageTitle } from "@/components/layout/PageTitle";
import { listDomains, addDomain, type DomainRecord } from "@/lib/api";
import { toast } from "sonner";

type InfraTab = "domains" | "certificates" | "deployments";

const TABS: { id: InfraTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "domains", label: "Domains", icon: Globe },
  { id: "certificates", label: "Certificates", icon: Shield },
  { id: "deployments", label: "Deployments", icon: Container },
];

export default function DomainsPage() {
  const [tab, setTab] = useState<InfraTab>("domains");
  const [domainInput, setDomainInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const { data: domains = [], isLoading, mutate } = useSWR<DomainRecord[]>(
    tab === "domains" ? "domains" : null,
    () => listDomains()
  );

  const handleAddDomain = async () => {
    const domain = domainInput.trim().toLowerCase();
    if (!domain) return;
    setAdding(true);
    try {
      await addDomain(domain);
      setDomainInput("");
      setAddModalOpen(false);
      mutate();
      toast.success("Domain added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add domain");
    } finally {
      setAdding(false);
    }
  };

  return (
    <RequireApiSession>
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6 animate-enter">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Server className="w-5 h-5 text-blue-400" />
          </div>
          <PageTitle title="Infrastructure" subtitle="Manage domains, certificates, and deployment infrastructure" />
        </div>
        <button
          type="button"
          className="btn-primary-gradient text-xs px-4 py-2 rounded-lg flex items-center gap-2"
          title="Configure infrastructure"
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Custom domains</h3>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="btn-primary-gradient text-xs px-4 py-1.5 rounded-lg flex items-center gap-2"
              title="Add custom domain"
            >
              <Plus className="w-3.5 h-3.5" />
              Add domain
            </button>
          </div>
          {addModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setAddModalOpen(false)}>
              <div className="glass-panel rounded-xl p-6 max-w-md w-full border border-[var(--color-border-subtle)] shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Add custom domain</h3>
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="example.com"
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleAddDomain}
                    disabled={adding || !domainInput.trim()}
                    className="btn-primary-gradient text-xs px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          {isLoading && domains.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
            </div>
          ) : domains.length === 0 ? (
            <EmptyState
              icon={<Globe className="w-8 h-8 text-[var(--color-text-muted)]" />}
              title="No custom domains"
              description="Custom domains allow users to access your deployed dApps at a branded URL. Deploy a dApp first, then configure a domain."
              action={
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  className="btn-primary-gradient text-xs px-4 py-1.5 rounded-lg"
                  title="Add custom domain"
                >
                  Add domain
                </button>
              }
            />
          ) : (
            <div className="space-y-2">
              {domains.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-3 px-4 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{d.domain}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    d.status === "verified" ? "bg-emerald-500/10 text-emerald-400" :
                    d.status === "failed" ? "bg-red-500/10 text-red-400" :
                    "bg-amber-500/10 text-amber-400"
                  }`}>
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          )}
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
                { name: "Docker", status: "requires setup", desc: "Container deployments for backend services" },
                { name: "Custom Server", status: "requires setup", desc: "Deploy to your own infrastructure" },
              ].map((target) => (
                <div key={target.name} className="glass-panel glass-panel-hover rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{target.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      target.status === "available"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : target.status === "requires setup"
                          ? "bg-amber-500/10 text-amber-400"
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
    </RequireApiSession>
  );
}
