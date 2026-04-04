"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { RequireApiSession } from "@/components/auth/RequireApiSession";
import { Loader2, ArrowLeft, ExternalLink } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import {
  createWorkflow,
  DEFAULT_NETWORK,
  requireLLMKeys,
  LLM_KEYS_REQUIRED_MESSAGE,
  handleApiError,
  isByokStorageOrMigrationError,
  BYOK_SAVE_AGAIN_HINT,
  isCreditsError,
  workspaceHeaders,
} from "@/lib/api";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useWorkflowSSE } from "@/hooks/useWorkflowSSE";
import { XTermTerminal } from "@/components/chat/XTermTerminal";

export default function NewAppPage() {
  const { activeWorkspaceId, setActiveWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [intent, setIntent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const lastErrorRef = useRef<unknown>(null);

  const { events: discussionEvents } = useWorkflowSSE(workflowId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt =
      intent.trim() ||
      (name.trim() ? `Build ${name.trim()}` : "Build a simple dApp");
    setLoading(true);
    setError(null);
    setWorkflowId(null);
    try {
      const { ok } = await requireLLMKeys(
        activeWorkspaceId !== "default" ? activeWorkspaceId : undefined,
      );
      if (!ok) {
        setError(LLM_KEYS_REQUIRED_MESSAGE);
        setLoading(false);
        return;
      }
      const { workflow_id } = await createWorkflow(
        { nlp_input: prompt, network: DEFAULT_NETWORK },
        {
          headers: workspaceHeaders(
            activeWorkspaceId !== "default" ? activeWorkspaceId : undefined,
          ),
        },
      );
      setActiveWorkspace(workflow_id);
      setWorkflowId(workflow_id);
    } catch (err) {
      lastErrorRef.current = err;
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const building = workflowId !== null;

  if (building) {
    return (
      <RequireApiSession>
        <div className="p-6 lg:p-8">
          <div className="max-w-[800px] mx-auto space-y-6 animate-enter">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href={ROUTES.APPS}
                  className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]"
                  aria-label="Back to apps"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Link>
                <div>
                  <h1 className="text-xl font-semibold text-[var(--color-text-primary)] tracking-tight">
                    Building
                  </h1>
                  <p className="text-sm text-[var(--color-text-tertiary)]">
                    Agent is building your DApp base layer.
                  </p>
                </div>
              </div>
              <Link
                href={ROUTES.WORKFLOW_ID(workflowId)}
                className="px-4 py-2 rounded-lg border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-sm font-medium hover:bg-[var(--color-bg-elevated)] flex items-center gap-2"
              >
                View workflow <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] overflow-hidden">
              {discussionEvents.length > 0 ? (
                <XTermTerminal
                  events={discussionEvents}
                  className="min-h-[280px]"
                />
              ) : (
                <div className="px-4 py-8 animate-pulse text-[var(--color-text-muted)] text-sm text-center">
                  Waiting for agent activity...
                </div>
              )}
            </div>
          </div>
        </div>
      </RequireApiSession>
    );
  }

  return (
    <RequireApiSession>
      <div className="p-6 lg:p-8">
        <div className="max-w-[600px] mx-auto space-y-6 animate-enter">
          <div className="flex items-center gap-4">
            <Link
              href={ROUTES.APPS}
              className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]"
              aria-label="Back to apps"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-[var(--color-text-primary)] tracking-tight">
                New app
              </h1>
              <p className="text-sm text-[var(--color-text-tertiary)]">
                Describe your app to create a workflow.
              </p>
            </div>
          </div>
          <form
            onSubmit={handleSubmit}
            className="glass-panel rounded-xl p-6 space-y-4"
          >
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2"
              >
                Name (optional)
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My dApp"
                className="w-full px-4 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label
                htmlFor="intent"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2"
              >
                What do you want to build?
              </label>
              <textarea
                id="intent"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder="e.g. A mintable ERC20 token with pause and roles"
                rows={4}
                className="w-full px-4 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] resize-none"
              />
            </div>
            {error && (
              <div className="space-y-2">
                <p className="text-sm text-[var(--color-semantic-error)]">
                  {error}
                </p>
                {isCreditsError(lastErrorRef.current) && (
                  <Link
                    href={ROUTES.PAYMENTS}
                    className="text-xs text-[var(--color-primary-light)] hover:underline"
                  >
                    Top up credits in Payments
                  </Link>
                )}
                {isByokStorageOrMigrationError(error) && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {BYOK_SAVE_AGAIN_HINT}{" "}
                    <Link
                      href={ROUTES.SETTINGS}
                      className="text-[var(--color-primary-light)] hover:underline"
                    >
                      Open Settings
                    </Link>
                  </p>
                )}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-lg btn-primary-gradient text-[var(--color-text-primary)] text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Create app
              </button>
              <Link
                href={ROUTES.CHAT}
                className="px-4 py-2 rounded-lg border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-sm font-medium hover:bg-[var(--color-bg-elevated)]"
              >
                Start from Chat instead
              </Link>
            </div>
          </form>
        </div>
      </div>
    </RequireApiSession>
  );
}
