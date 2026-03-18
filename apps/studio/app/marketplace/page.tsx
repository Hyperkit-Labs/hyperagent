"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { RequireApiSession } from "@/components/auth/RequireApiSession";
import { LayoutTemplate, Loader2, Rocket } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { createWorkflow, DEFAULT_NETWORK, requireLLMKeys, LLM_KEYS_REQUIRED_MESSAGE, handleApiError, isCreditsError } from "@/lib/api";
import { useTemplatesData } from "@/hooks/useTemplatesData";
import { useSelectedNetwork } from "@/components/providers/SelectedNetworkProvider";
import { ShimmerGrid } from "@/components/ai-elements";
import { PageTitle } from "@/components/layout/PageTitle";

export default function MarketplacePage() {
  const router = useRouter();
  const { templates, loading, error, refetch } = useTemplatesData();
  const { selectedNetworkId } = useSelectedNetwork();
  const networkId = selectedNetworkId || DEFAULT_NETWORK;
  const [deployingId, setDeployingId] = useState<string | null>(null);

  async function handleOneClickDeploy(templateId: string, templateName: string) {
    const { ok } = await requireLLMKeys();
    if (!ok) {
      toast.error(LLM_KEYS_REQUIRED_MESSAGE);
      return;
    }
    setDeployingId(templateId);
    try {
      const { workflow_id } = await createWorkflow({
        nlp_input: `Deploy template: ${templateName}`,
        network: networkId,
        template_id: templateId,
      });
      router.push(ROUTES.WORKFLOW_ID(workflow_id));
      toast.success("Workflow created. Review and approve spec to continue.");
    } catch (err) {
      const msg = handleApiError(err);
      toast.error(msg);
      if (isCreditsError(err)) {
        router.push(ROUTES.PAYMENTS);
      }
    } finally {
      setDeployingId(null);
    }
  }

  return (
    <RequireApiSession>
      <div className="p-6 lg:p-8">
        <div className="max-w-[1200px] mx-auto space-y-6 animate-enter">
          <div className="flex items-center justify-between">
            <PageTitle
              title="Marketplace"
              subtitle="One-click deploy from templates. Human approval required before deployment."
            />
            <Link
              href={ROUTES.TEMPLATES}
              className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-primary-light)]"
            >
              Browse all templates
            </Link>
          </div>

          {error && (
            <div className="glass-panel rounded-xl p-6 flex items-center justify-between">
              <p className="text-xs text-[var(--color-semantic-error)]">{error}</p>
              <button type="button" onClick={() => void refetch()} className="text-xs text-[var(--color-primary-light)] underline">
                Retry
              </button>
            </div>
          )}

          {loading && <ShimmerGrid count={6} />}

          {!loading && templates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((item) => {
                const isDeploying = deployingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="glass-panel rounded-xl p-5 transition-all hover:border-[var(--color-primary-alpha-30)]"
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                        <LayoutTemplate className="w-5 h-5 text-[var(--color-primary-light)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-white truncate text-sm">{item.name || item.id}</h3>
                        {item.source && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] bg-[var(--color-bg-hover)]">
                            {item.source}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-[var(--color-text-tertiary)] line-clamp-2 h-8 mb-4">
                      {item.description || "No description"}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleOneClickDeploy(item.id, item.name || item.id)}
                      disabled={isDeploying}
                      className="w-full btn-primary-gradient text-xs py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isDeploying ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Rocket className="w-3.5 h-3.5" />
                      )}
                      One-Click Deploy
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && templates.length === 0 && !error && (
            <div className="glass-panel rounded-xl p-12 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
              <LayoutTemplate className="w-12 h-12 text-[var(--color-text-muted)] mb-4" />
              <p className="text-[var(--color-text-secondary)] text-sm font-medium mb-1">No templates available</p>
              <p className="text-[var(--color-text-tertiary)] text-xs mb-5">
                Templates come from the registry. Start from a prompt to generate a contract.
              </p>
              <Link href={ROUTES.HOME} className="btn-primary-gradient text-xs px-4 py-2 rounded-lg">
                Create from prompt
              </Link>
            </div>
          )}
        </div>
      </div>
    </RequireApiSession>
  );
}
