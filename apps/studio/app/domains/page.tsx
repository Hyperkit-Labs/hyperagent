"use client";

import { useState } from "react";
import useSWR from "swr";
import { RequireApiSession } from "@/components/auth/RequireApiSession";
import { Server, Globe, Loader2, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { PageTitle } from "@/components/layout/PageTitle";
import { listDomains, addDomain, type DomainRecord } from "@/lib/api";
import {
  normalizeDomainInput,
  validateDomainInput,
} from "@/lib/domainValidation";
import { toast } from "sonner";

export default function DomainsPage() {
  const [domainInput, setDomainInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);

  const {
    data: domains = [],
    isLoading,
    mutate,
  } = useSWR<DomainRecord[]>("domains", () => listDomains());

  const handleAddDomain = async () => {
    const domain = normalizeDomainInput(domainInput);
    const validationError = validateDomainInput(domain);
    if (validationError) {
      setDomainError(validationError);
      return;
    }
    if (domains.some((entry) => entry.domain.toLowerCase() === domain)) {
      setDomainError("This domain has already been added.");
      return;
    }
    setAdding(true);
    setDomainError(null);
    try {
      await addDomain(domain);
      setDomainInput("");
      setAddModalOpen(false);
      await mutate();
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Server className="w-5 h-5 text-blue-400" />
          </div>
          <PageTitle
            title="Domains"
            subtitle="Manage the custom domains that are persisted for your workspace."
          />
        </div>

        <div className="glass-panel rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Custom domains
            </h3>
            <button
              type="button"
              onClick={() => {
                setDomainError(null);
                setAddModalOpen(true);
              }}
              className="btn-primary-gradient text-xs px-4 py-1.5 rounded-lg flex items-center gap-2"
              title="Add custom domain"
            >
              <Plus className="w-3.5 h-3.5" />
              Add domain
            </button>
          </div>
          {addModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setAddModalOpen(false)}
            >
              <div
                className="glass-panel rounded-xl p-6 max-w-md w-full border border-[var(--color-border-subtle)] shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
                  Add custom domain
                </h3>
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => {
                    setDomainInput(e.target.value);
                    if (domainError) {
                      setDomainError(validateDomainInput(e.target.value));
                    }
                  }}
                  placeholder="example.com"
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
                {domainError && (
                  <p className="mt-2 text-xs text-red-400">{domainError}</p>
                )}
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleAddDomain}
                    disabled={adding || !domainInput.trim()}
                    className="btn-primary-gradient text-xs px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    {adding ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : null}
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
              icon={
                <Globe className="w-8 h-8 text-[var(--color-text-muted)]" />
              }
              title="No custom domains"
              description="Custom domains appear here after they have been added through the infrastructure API."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setDomainError(null);
                    setAddModalOpen(true);
                  }}
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
                <div
                  key={d.id}
                  className="flex items-center justify-between py-3 px-4 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]"
                >
                  <div>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {d.domain}
                    </span>
                    {d.created_at && (
                      <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                        Added {new Date(d.created_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      d.status === "verified"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : d.status === "failed"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </RequireApiSession>
  );
}
