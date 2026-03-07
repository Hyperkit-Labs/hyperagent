"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import {
  createWorkflow,
  DEFAULT_NETWORK,
  requireLLMKeys,
  LLM_KEYS_REQUIRED_MESSAGE,
  handleApiError,
  isByokStorageOrMigrationError,
  BYOK_SAVE_AGAIN_HINT,
} from "@/lib/api";

export default function NewAppPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [intent, setIntent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = intent.trim() || (name.trim() ? `Build ${name.trim()}` : "Build a simple dApp");
    setLoading(true);
    setError(null);
    try {
      const { ok } = await requireLLMKeys();
      if (!ok) {
        setError(LLM_KEYS_REQUIRED_MESSAGE);
        setLoading(false);
        return;
      }
      const { workflow_id } = await createWorkflow({
        nlp_input: prompt,
        network: DEFAULT_NETWORK,
      });
      router.push(ROUTES.WORKFLOW_ID(workflow_id));
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
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
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)] tracking-tight">New app</h1>
            <p className="text-sm text-[var(--color-text-tertiary)]">Describe your app to create a workflow.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="glass-panel rounded-xl p-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
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
            <label htmlFor="intent" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
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
              <p className="text-sm text-[var(--color-semantic-error)]">{error}</p>
              {isByokStorageOrMigrationError(error) && (
                <p className="text-xs text-[var(--color-text-muted)]">
                  {BYOK_SAVE_AGAIN_HINT}{" "}
                  <Link href={ROUTES.SETTINGS} className="text-[var(--color-primary-light)] hover:underline">
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
  );
}
