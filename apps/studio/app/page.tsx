"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveAccountFromContext } from "@/components/providers/ActiveAccountContext";
import { useAppChat, hasActiveByokKey } from "@/hooks/useAppChat";
import { useWorkflowProgress } from "@/hooks/useWorkflowProgress";
import { createWorkflow, DEFAULT_NETWORK, getErrorMessage, requireLLMKeys, LLM_KEYS_REQUIRED_MESSAGE, isByokStorageOrMigrationError, BYOK_SAVE_AGAIN_HINT, isCreditsError } from "@/lib/api";
import { workflowCreateFailureMessage } from "@/lib/sadPathCopy";
import {
  clearHomeWorkflowDraft,
  loadHomeWorkflowDraft,
  saveHomeWorkflowDraft,
} from "@/lib/workflowDraftStorage";
import { getSessionOnlyLLMKey, SESSION_LLM_PASS_THROUGH_UPDATED_EVENT } from "@/lib/session-store";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { StarterGrid } from "@/components/chat/StarterGrid";
import { NumberTicker, ConfettiBurst, ShinyText } from "@/components/ui";
import { PipelineStepper } from "@/components/chat/PipelineStepper";
import { ChatCommandBar } from "@/components/chat/ChatCommandBar";
import { WorkflowActivityList } from "@/components/chat/WorkflowActivityList";
import { ContractViewer } from "@/components/contracts/ContractViewer";
import { WorkflowStages } from "@/app/workflows/[id]/WorkflowStages";
import { CodeBlockShimmer } from "@/components/ai-elements";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { ROUTES } from "@/constants/routes";
import type { ChatMessage, ToolInvocation } from "@/components/chat/ChatMessageList";
import { needsSpecApproval, needsDeployApproval, hasAuditOrSimFailure } from "@/lib/types";
import type { Workflow } from "@/lib/types";
import { useNetworks } from "@/hooks/useNetworks";
import { useSelectedNetwork } from "@/components/providers/SelectedNetworkProvider";
import { useWorkflows } from "@/hooks/useWorkflows";
import {
  LayoutGrid,
  Code2,
  Database,
  Bot,
  Plus,
  Clock,
  ChevronRight,
  ChevronLeft,
  FileCode,
  Loader2,
  Settings,
  X,
  Check,
} from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { LLMKeysCard } from "@/components/settings/LLMKeysCard";
import { ConnectWalletNav } from "@/components/wallet/ConnectWalletNav";
import { RequireApiSession } from "@/components/auth/RequireApiSession";
import { useSession } from "@/hooks/useSession";

type ShellView = "code" | "data" | "agents";

function DeployApprovalPanel({ workflow, onApproved, onError }: { workflow: Workflow; onApproved: () => void; onError: (msg: string) => void }) {
  const [sending, setSending] = useState(false);
  return (
    <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
      <p className="text-sm font-medium text-emerald-400">Deploy approval required</p>
      <p className="text-xs text-[var(--color-text-tertiary)]">
        Guardian passed. Approve to continue and create deploy plans.
      </p>
      <button
        type="button"
        disabled={sending}
        onClick={async () => {
          setSending(true);
          try {
            const { approveDeploy } = await import("@/lib/api");
            await approveDeploy(workflow.workflow_id);
            onApproved();
          } catch (err) {
            onError(err instanceof Error ? err.message : "Deploy approval failed");
          } finally {
            setSending(false);
          }
        }}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        Approve and continue
      </button>
    </div>
  );
}

function SpecReviewPanel({ workflow, onApproved, onError }: { workflow: Workflow; onApproved: () => void; onError: (msg: string) => void }) {
  const [clarification, setClarification] = useState("");
  const [sending, setSending] = useState(false);

  return (
    <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
      <p className="text-sm font-medium text-amber-400">Spec review required</p>
      <p className="text-xs text-[var(--color-text-tertiary)]">
        The pipeline is paused. Review the spec, approve, or request changes.
      </p>
      {workflow.spec ? (
        <pre className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-base)] rounded-md p-3 max-h-48 overflow-y-auto font-mono whitespace-pre-wrap">
          {typeof workflow.spec === "string" ? workflow.spec : JSON.stringify(workflow.spec, null, 2)}
        </pre>
      ) : null}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={sending}
            onClick={async () => {
              setSending(true);
              try {
                const { approveSpec } = await import("@/lib/api");
                await approveSpec(workflow.workflow_id);
                onApproved();
              } catch (err) {
                onError(err instanceof Error ? err.message : "Spec approval failed");
              } finally {
                setSending(false);
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Approve and continue
          </button>
        </div>
        <div className="flex gap-2 items-end">
          <input
            type="text"
            value={clarification}
            onChange={(e) => setClarification(e.target.value)}
            placeholder="Request changes or ask questions..."
            className="flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
          />
          <button
            type="button"
            disabled={sending || !clarification.trim()}
            onClick={async () => {
              if (!clarification.trim()) return;
              setSending(true);
              try {
                const { submitClarification } = await import("@/lib/api");
                await submitClarification(workflow.workflow_id, { message: clarification.trim() });
                setClarification("");
                onApproved();
              } catch (err) {
                onError(err instanceof Error ? err.message : "Clarification failed");
              } finally {
                setSending(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
          >
            Send feedback
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const account = useActiveAccountFromContext();
  const { hasSession } = useSession();
  const [shellView, setShellView] = useState<ShellView>("code");
  const [workflowsSidebarOpen, setWorkflowsSidebarOpen] = useState(true);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(
    searchParams.get("workflow") || null
  );
  const [selectedContractIndex, setSelectedContractIndex] = useState<number>(0);
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const lastCreateErrorRef = useRef<unknown>(null);
  const [systemMessages, setSystemMessages] = useState<ChatMessage[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationShownRef = useRef(false);
  const [llmPassThrough, setLlmPassThrough] = useState<{ provider: "openai" | "google" | "anthropic"; apiKey: string } | null>(null);
  const prefillAppliedRef = useRef(false);

  useEffect(() => {
    setLlmPassThrough(getSessionOnlyLLMKey());
  }, []);
  useEffect(() => {
    const onUpdate = () => setLlmPassThrough(getSessionOnlyLLMKey());
    window.addEventListener(SESSION_LLM_PASS_THROUGH_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(SESSION_LLM_PASS_THROUGH_UPDATED_EVENT, onUpdate);
  }, []);
  useEffect(() => {
    const onFocus = () => setLlmPassThrough(getSessionOnlyLLMKey());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const { networks } = useNetworks();
  const { selectedNetworkId: buildNetwork, setSelectedNetworkId: setBuildNetwork } = useSelectedNetwork();
  const testnets = (networks ?? []).filter((n) => n.is_mainnet === false);
  const defaultNetwork = testnets[0]?.id ?? DEFAULT_NETWORK;

  const {
    messages: sdkMessages,
    input,
    setInput,
    handleSubmit: rawHandleSubmit,
    setMessages,
    isLoading,
    error,
    reload,
  } = useAppChat({
    network: buildNetwork || defaultNetwork,
  });

  const handleSubmit = (e?: React.FormEvent | { preventDefault?: () => void }) => {
    e?.preventDefault?.();
    if (!input.trim()) return;
    if (!hasActiveByokKey()) {
      setSettingsOpen(true);
      return;
    }
    rawHandleSubmit(e as React.FormEvent);
  };

  const {
    workflow,
    contracts,
    loading: workflowLoading,
    error: workflowError,
    contractData,
    contractCode,
    fetchWorkflow,
    discussionEvents,
  } = useWorkflowProgress(selectedWorkflowId);

  const loadingContracts = selectedWorkflowId && workflowLoading && contracts.length === 0;

  const { workflows, loading: workflowsLoading } = useWorkflows({ filters: { limit: 10 } });

  const workflowQuery = searchParams.get("workflow");
  const walletAddress = account?.address;

  useEffect(() => {
    if (hasSession) return;
    if (account !== undefined && !walletAddress) {
      const next = workflowQuery
        ? `${ROUTES.HOME}?workflow=${encodeURIComponent(workflowQuery)}`
        : ROUTES.HOME;
      void router.replace(`${ROUTES.LOGIN}?next=${encodeURIComponent(next)}`);
    }
  }, [hasSession, account, router, workflowQuery, walletAddress]);

  useEffect(() => {
    if (prefillAppliedRef.current) return;
    const q = searchParams.get("q");
    const templateId = searchParams.get("template");
    if (q && typeof q === "string") {
      prefillAppliedRef.current = true;
      setInput(decodeURIComponent(q));
      return;
    }
    if (templateId && typeof templateId === "string") {
      prefillAppliedRef.current = true;
      const decoded = decodeURIComponent(templateId);
      setInput(decoded ? `Build a ${decoded.replace(/-/g, " ")}` : "");
      return;
    }
    const draft = loadHomeWorkflowDraft();
    if (draft?.input?.trim()) {
      prefillAppliedRef.current = true;
      setInput(draft.input);
      if (draft.networkId?.trim()) {
        setBuildNetwork(draft.networkId);
      }
    }
  }, [searchParams, setInput, setBuildNetwork]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!input.trim()) {
        clearHomeWorkflowDraft();
        return;
      }
      saveHomeWorkflowDraft({ input, networkId: buildNetwork || null });
    }, 500);
    return () => window.clearTimeout(t);
  }, [input, buildNetwork]);

  useEffect(() => {
    const workflowIdFromMessage = sdkMessages
      .flatMap((m) => {
        const raw = m as {
          toolInvocations?: Array<{ result?: { workflow_id?: string } }>;
        };
        return raw.toolInvocations || [];
      })
      .find((inv) => inv.result?.workflow_id)?.result?.workflow_id;

    if (workflowIdFromMessage && !selectedWorkflowId) {
      setSelectedWorkflowId(workflowIdFromMessage);
      router.replace(`${ROUTES.HOME}?workflow=${workflowIdFromMessage}`, { scroll: false });
    }
  }, [sdkMessages, selectedWorkflowId, router]);

  useEffect(() => {
    if (contracts.length > 0 && selectedContractIndex >= contracts.length) {
      setSelectedContractIndex(0);
    }
  }, [contracts.length, selectedContractIndex]);

  function messageContent(raw: unknown): string {
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw)) {
      const t = (raw as Array<{ type?: string; text?: unknown }>).find((p) => p.type === "text");
      const val = t?.text;
      if (val == null) return "";
      return typeof val === "string" ? val : String(val);
    }
    return "";
  }

  const messages: ChatMessage[] = sdkMessages.map((m) => {
    const raw = m as {
      id: string;
      role: string;
      content: string | unknown;
      toolInvocations?: ToolInvocation[];
    };
    return {
      id: raw.id,
      role: raw.role as ChatMessage["role"],
      content: messageContent(raw.content),
      toolInvocations: raw.toolInvocations,
    };
  });

  const allMessages: ChatMessage[] = [...messages, ...systemMessages];

  const lastMsg = sdkMessages[sdkMessages.length - 1] as { role?: string; content?: unknown } | undefined;
  const streamingContent =
    isLoading && lastMsg?.role === "assistant"
      ? messageContent(lastMsg?.content)
      : undefined;

  const selectedContract = contracts[selectedContractIndex];
  const displayCode = contractCode || selectedContract?.source_code || "";

  useEffect(() => {
    if (displayCode && !celebrationShownRef.current) {
      const FIRST_CONTRACT_KEY = "hyperagent_first_contract_seen";
      if (typeof window !== "undefined" && !localStorage.getItem(FIRST_CONTRACT_KEY)) {
        localStorage.setItem(FIRST_CONTRACT_KEY, "1");
        celebrationShownRef.current = true;
        setShowCelebration(true);
        const timer = setTimeout(() => setShowCelebration(false), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [displayCode]);

  const lastUserPromptFromHistory = (() => {
    const reversed = [...sdkMessages].reverse();
    const found = reversed.find((m) => (m as { role?: string }).role === "user");
    const content = found ? messageContent((found as { content?: unknown }).content) : "";
    return content.trim();
  })();

  const canCreateWorkflow = !creatingWorkflow && !!(lastUserPromptFromHistory || input.trim());

  const handleCreateWorkflowFromChat = async () => {
    const promptForWorkflow = lastUserPromptFromHistory || input.trim();
    if (!promptForWorkflow) return;
    const networkId = buildNetwork || defaultNetwork;
    setCreatingWorkflow(true);
    setCreateError(null);
    try {
      const { ok } = await requireLLMKeys();
      if (!ok) {
        setCreateError(LLM_KEYS_REQUIRED_MESSAGE);
        setSettingsOpen(true);
        return;
      }
      const body: Parameters<typeof createWorkflow>[0] = {
        nlp_input: promptForWorkflow,
        network: networkId,
      };
      const { workflow_id } = await createWorkflow(body);
      clearHomeWorkflowDraft();
      setSelectedWorkflowId(workflow_id);
      setSystemMessages((prev) => [
        ...prev,
        {
          id: `workflow-created-${workflow_id}`,
          role: "assistant",
          content: `Created workflow ${workflow_id} on ${networkId}. Running pipeline now.`,
          toolInvocations: [],
        },
      ]);
      router.replace(`${ROUTES.HOME}?workflow=${workflow_id}`, { scroll: false });
    } catch (e) {
      lastCreateErrorRef.current = e;
      const msg = getErrorMessage(e);
      if (isByokStorageOrMigrationError(msg)) {
        setCreateError(`${msg} ${BYOK_SAVE_AGAIN_HINT}`.trim());
      } else {
        setCreateError(workflowCreateFailureMessage(e));
      }
    } finally {
      setCreatingWorkflow(false);
    }
  };

  return (
    <div className="bg-[var(--color-bg-base)] text-[var(--color-text-primary)] h-screen w-full flex flex-col overflow-hidden text-[13px] selection:bg-indigo-500/30">
      <ConfettiBurst active={showCelebration} onComplete={() => setShowCelebration(false)} />
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} className="relative z-[100]">
        <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="mx-auto w-full max-w-lg rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] shadow-xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <DialogTitle className="text-lg font-semibold text-[var(--color-text-primary)]">
                API keys for chat
              </DialogTitle>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <LLMKeysCard />
            <p className="mt-4 pt-4 border-t border-[var(--color-border-subtle)]">
              <Link
                href={ROUTES.SETTINGS}
                className="text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-primary-light)]"
                onClick={() => setSettingsOpen(false)}
              >
                Open full Settings
              </Link>
            </p>
          </DialogPanel>
        </div>
      </Dialog>
      <header className="h-12 border-b border-[var(--color-border-subtle)] flex items-center justify-between px-4 bg-[var(--color-bg-base)] shrink-0 z-50">
        <div className="flex items-center gap-4">
          <Link href={ROUTES.HOME} className="flex items-center gap-2 shrink-0">
            <Image
              src="/hyperkit-header-white.svg"
              alt="Hyperkit"
              width={140}
              height={47}
              className="h-8 w-auto object-contain"
            />
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
            title="Settings (LLM API keys)"
            aria-label="Open settings (LLM API keys)"
          >
            <Settings className="w-4 h-4" />
          </button>
          {account && (
            <div className="flex items-center gap-2 px-2 py-1 bg-[var(--color-bg-panel)] border border-[var(--color-border-subtle)] rounded-full">
              <span className="text-[11px] text-[var(--color-text-tertiary)]">Target network</span>
              <select
                value={buildNetwork}
                onChange={(e) => setBuildNetwork(e.target.value)}
                className="bg-transparent border-none text-[11px] text-[var(--color-text-primary)] focus:outline-none"
              >
                {testnets.length === 0 && (
                  <option value={defaultNetwork}>Default</option>
                )}
                {testnets.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name ?? n.id}
                  </option>
                ))}
              </select>
            </div>
          )}
          <ConnectWalletNav />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <aside className="w-64 bg-[var(--color-bg-elevated)] border-r border-[var(--color-border-subtle)] flex flex-col shrink-0">
          <nav className="p-2 space-y-0.5 border-b border-[var(--color-border-subtle)]">
            <Link
              href={ROUTES.DASHBOARD}
              className="flex items-center gap-2 px-2 py-1.5 w-full text-left rounded-md transition-colors text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)]"
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Overview</span>
            </Link>
            <button
              type="button"
              onClick={() => setShellView("code")}
              className={`flex items-center gap-2 px-2 py-1.5 w-full text-left rounded-md transition-colors ${
                shellView === "code"
                  ? "text-[var(--color-text-primary)] bg-[var(--color-bg-panel)]"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)]"
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>Code</span>
            </button>
            <button
              type="button"
              onClick={() => setShellView("data")}
              className={`flex items-center gap-2 px-2 py-1.5 w-full text-left rounded-md transition-colors ${
                shellView === "data"
                  ? "text-[var(--color-text-primary)] bg-[var(--color-bg-panel)]"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)]"
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Database</span>
            </button>
            <Link
              href={ROUTES.AGENTS}
              className="flex items-center gap-2 px-2 py-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)] rounded-md transition-colors"
            >
              <Bot className="w-4 h-4" />
              <span>Agents</span>
            </Link>
          </nav>

          {selectedWorkflowId && (
            <div className="flex-1 overflow-y-auto p-2 border-t border-[var(--color-border-subtle)]">
              <div className="px-2 py-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Files
              </div>
              {loadingContracts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 text-[var(--color-text-muted)] animate-spin" />
                </div>
              ) : contracts.length === 0 ? (
                <div className="text-[11px] text-[var(--color-text-muted)] px-2 py-4 text-center">
                  No contracts yet
                </div>
              ) : (
                <div className="space-y-0.5">
                  {contracts.map((contract, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedContractIndex(idx)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-md transition-colors text-[12px] ${
                        selectedContractIndex === idx
                          ? "text-[var(--color-text-primary)] bg-[var(--color-bg-panel)]"
                          : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)]"
                      }`}
                    >
                      <FileCode className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {String(contract.name ?? `Contract ${idx + 1}`)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden bg-[var(--color-bg-base)] min-w-0">
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="px-6 py-4">
              <ChatMessageList
                messages={allMessages}
                isLoading={isLoading}
                streamingContent={streamingContent}
                discussionEvents={discussionEvents}
                workflowIdForApproval={selectedWorkflowId}
                onApproveSpec={
                  selectedWorkflowId && fetchWorkflow
                    ? async () => {
                        const { approveSpec } = await import("@/lib/api");
                        await approveSpec(selectedWorkflowId);
                        await fetchWorkflow();
                      }
                    : undefined
                }
              />
            </div>
            {selectedWorkflowId && workflow && (
              <div className="shrink-0 px-4 pt-2">
                <PipelineStepper
                  workflow={workflow}
                  onErrorClick={(stageName, error) => {
                    setInput(`Explain why the ${stageName} step failed. Error: ${error ?? "unknown"}`);
                  }}
                />
              </div>
            )}
            <div className="p-6">
            <div className="max-w-5xl mx-auto space-y-6">
              {!selectedWorkflowId ? (
                <div className="flex flex-col items-center justify-center py-16 gap-8">
                  <motion.div
                    className="text-center space-y-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--color-primary-alpha-20)] bg-[var(--color-primary-alpha-10)] text-xs font-medium text-[var(--color-primary-light)] mb-2">
                      <Bot className="w-3.5 h-3.5" />
                      HyperAgent Engine Active
                    </div>
                    <h2 className="text-3xl font-semibold text-[var(--color-text-primary)] tracking-tight">
                      <ShinyText text="From idea to production in " className="text-[var(--color-text-primary)]" />
                      <span className="text-[var(--color-primary-light)]"><NumberTicker value={2} /></span> minutes
                    </h2>
                    <p className="text-sm text-[var(--color-text-tertiary)] max-w-lg mx-auto">
                      Describe your smart contract, and I'll generate, audit, and prepare it for deployment on any EVM chain.
                    </p>
                  </motion.div>
                  <StarterGrid
                    onSelect={(prompt) => {
                      if (!hasActiveByokKey()) {
                        setSettingsOpen(true);
                        setInput(prompt);
                        return;
                      }
                      setInput(prompt);
                    }}
                  />
                </div>
              ) : workflowError && !workflow ? (
                <div className="flex flex-col items-center justify-center py-24 text-[var(--color-text-muted)] gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <X className="w-5 h-5 text-amber-400" />
                  </div>
                  <p className="text-sm font-medium text-amber-400">
                    {workflowError.includes("404") || workflowError.includes("not found")
                      ? "Workflow not found"
                      : "Failed to load workflow"}
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)] max-w-md text-center">
                    {workflowError}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => fetchWorkflow()}
                      className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)]"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWorkflowId(null);
                        window.history.replaceState(null, "", ROUTES.HOME);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New workflow
                    </button>
                  </div>
                </div>
              ) : shellView === "code" ? (
                <div className="space-y-4">
                  {selectedWorkflowId && workflow && (workflow.status === "running" || workflow.status === "building" || workflow.status === "spec_review" || workflow.status === "design_review") && (
                    <div className="rounded-xl border border-[var(--color-semantic-warning)]/20 bg-[var(--color-semantic-warning)]/5 px-4 py-3 mb-2">
                      <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Pipeline in progress</p>
                      <WorkflowStages workflow={workflow} contractData={contractData} />
                    </div>
                  )}
                  {showCelebration && workflow && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 mb-4 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                        <Check className="w-4 h-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-emerald-400">Your first contract is ready</p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">Review the code below. Deploy to a testnet or create another workflow.</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href={ROUTES.APPS_ID(workflow.workflow_id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-colors"
                        >
                          Deploy
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedWorkflowId(null);
                            setCreateError(null);
                            window.history.replaceState(null, "", ROUTES.HOME);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          New workflow
                        </button>
                      </div>
                    </div>
                  )}
                  {displayCode ? (
                    <ContractViewer
                      contractCode={displayCode}
                      abi={Array.isArray(selectedContract?.abi) ? (selectedContract.abi as unknown[]) : undefined}
                      contractName={String(selectedContract?.name ?? `Contract ${selectedContractIndex + 1}`)}
                      workflowId={workflow?.workflow_id}
                    />
                  ) : workflow?.status === "failed" ? (
                    <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-muted)] gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                        <X className="w-5 h-5 text-red-400" />
                      </div>
                      <p className="text-sm font-medium text-red-400">Pipeline failed</p>
                      {((workflow.metadata ?? workflow.meta_data) as Record<string, unknown> | undefined)?.error ? (
                        <p className="text-xs text-[var(--color-text-tertiary)] max-w-md text-center break-words font-mono">
                          {String(((workflow.metadata ?? workflow.meta_data) as Record<string, unknown>).error)}
                        </p>
                      ) : (
                        <p className="text-xs text-[var(--color-text-tertiary)] max-w-md text-center">
                          The pipeline encountered an error. Check your API keys in Settings and try creating a new workflow.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWorkflowId(null);
                          setCreateError(null);
                          window.history.replaceState(null, "", ROUTES.HOME);
                        }}
                        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        New workflow
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {workflowLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-muted)] gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <p className="text-sm">Loading contract code...</p>
                        </div>
                      ) : workflow?.status === "running" || workflow?.status === "building" ? (
                        <>
                          <CodeBlockShimmer className="min-h-[200px]" />
                          <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Pipeline is running. Waiting for contracts...
                          </p>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-muted)] gap-2">
                          <FileCode className="w-6 h-6 opacity-40" />
                          <p className="text-sm">Waiting for the pipeline to generate contracts.</p>
                        </div>
                      )}
                    </div>
                  )}
                  {workflow && (workflow.status === "completed" || workflow.status === "success" || workflow.status === "failed" || workflow.status === "cancelled") && (
                    <div className="mt-6">
                      <WorkflowStages workflow={workflow} contractData={contractData} />
                    </div>
                  )}
                  {workflow && needsSpecApproval(workflow) && (
                    <SpecReviewPanel
                      workflow={workflow}
                      onApproved={() => fetchWorkflow()}
                      onError={(msg) => setCreateError(msg)}
                    />
                  )}
                  {workflow && needsDeployApproval(workflow) && (
                    <DeployApprovalPanel
                      workflow={workflow}
                      onApproved={() => fetchWorkflow()}
                      onError={(msg) => setCreateError(msg)}
                    />
                  )}
                </div>
              ) : shellView === "data" ? (
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                    <Database className="w-4 h-4" />
                    <span className="text-sm font-medium">Contract data</span>
                  </div>
                  {contracts.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-tertiary)]">
                      No contracts loaded. Build a smart contract via chat to inspect its ABI and storage.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {contracts.map((c, i) => (
                        <div key={i} className="glass-panel rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white">{String((c as Record<string, unknown>).name || `Contract ${i + 1}`)}</span>
                            {Boolean((c as Record<string, unknown>).abi) && (
                              <span className="text-xs text-[var(--color-text-muted)]">
                                {Array.isArray((c as Record<string, unknown>).abi) ? `${(((c as Record<string, unknown>).abi) as unknown[]).length} ABI entries` : "ABI"}
                              </span>
                            )}
                          </div>
                          {Boolean((c as Record<string, unknown>).abi) && Array.isArray((c as Record<string, unknown>).abi) && (
                            <div className="max-h-64 overflow-y-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-[var(--color-border-subtle)]">
                                    <th className="text-left py-1 pr-2 text-[var(--color-text-muted)]">Type</th>
                                    <th className="text-left py-1 pr-2 text-[var(--color-text-muted)]">Name</th>
                                    <th className="text-left py-1 text-[var(--color-text-muted)]">Inputs</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {((c as { abi: Array<{ type?: string; name?: string; inputs?: Array<{ name?: string; type?: string }> }> }).abi)
                                    .filter((entry) => entry.type === "function" || entry.type === "event")
                                    .map((entry, j) => (
                                      <tr key={j} className="border-b border-[var(--color-border-subtle)] last:border-0">
                                        <td className="py-1 pr-2 text-[var(--color-text-muted)]">{entry.type}</td>
                                        <td className="py-1 pr-2 font-mono text-[var(--color-text-primary)]">{entry.name}</td>
                                        <td className="py-1 text-[var(--color-text-tertiary)]">
                                          {(entry.inputs || []).map((inp) => `${inp.type} ${inp.name}`).join(", ") || "-"}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          </div>
          <div className="shrink-0 flex flex-col items-center gap-3 px-4 pb-4 pt-2">
            <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl shadow-[0_0_40px_rgba(124,58,237,0.08)] focus-within:shadow-[0_0_40px_rgba(124,58,237,0.15)] transition-shadow overflow-hidden">
              <ChatCommandBar
                value={input}
                onChange={setInput}
                onSubmit={handleSubmit}
                disabled={isLoading}
                placeholder={llmPassThrough ? "Ask HyperAgent to build..." : "Add an LLM key in Settings to start chatting..."}
                onCreateWorkflow={handleCreateWorkflowFromChat}
                canCreateWorkflow={canCreateWorkflow}
                creatingWorkflow={creatingWorkflow}
                className="border-t-0 bg-transparent"
                statusIndicator={
                  llmPassThrough ? (
                    <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] text-emerald-400 font-medium">
                        {llmPassThrough.provider === "google" ? "Gemini" : llmPassThrough.provider === "openai" ? "OpenAI" : "Anthropic"} key active
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="flex items-center gap-2 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-colors w-full text-left"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span className="text-[10px] text-amber-400 font-medium">No LLM key set. Click to add one in Settings.</span>
                    </button>
                  )
                }
              />
            </div>
            {createError && (
              <div className="w-full max-w-2xl space-y-2">
                <ApiErrorBanner
                  error={createError}
                  onRetry={isByokStorageOrMigrationError(createError) ? () => { setCreateError(null); setSettingsOpen(true); } : undefined}
                />
                {isCreditsError(lastCreateErrorRef.current) && (
                  <Link href={ROUTES.PAYMENTS} className="text-xs text-[var(--color-primary-light)] hover:underline">
                    Top up credits in Payments
                  </Link>
                )}
                {isByokStorageOrMigrationError(createError) && (
                  <p className="text-[11px] text-[var(--color-text-muted)]">{BYOK_SAVE_AGAIN_HINT} Open Settings (header) to save keys.</p>
                )}
              </div>
            )}
          </div>
          {error && (
            <ApiErrorBanner
              error={getErrorMessage(error, "Chat request failed. Check your API key in Settings and try again.")}
              onRetry={() => { reload(); }}
              className="rounded-none border-t border-x-0 shrink-0 mx-4 mb-4"
            />
          )}
        </main>

        <aside
          className={`border-l border-[var(--color-border-subtle)] flex flex-col shrink-0 bg-[var(--color-bg-elevated)] transition-all duration-300 ${
            workflowsSidebarOpen ? "w-64" : "w-12"
          }`}
        >
          <div className="h-11 border-b border-[var(--color-border-subtle)] flex items-center justify-between px-3 min-w-0">
            {workflowsSidebarOpen ? (
              <>
                <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider truncate">Workflows</span>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setMessages([]);
                      setSelectedWorkflowId(null);
                      setCreateError(null);
                      window.history.replaceState(null, "", ROUTES.HOME);
                    }}
                className="p-1.5 hover:bg-[var(--color-bg-panel)] rounded transition-colors"
                title="New chat"
                aria-label="New chat"
                  >
                    <Plus className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(ROUTES.WORKFLOWS)}
                    className="p-1.5 hover:bg-[var(--color-bg-panel)] rounded transition-colors"
                    title="All workflows"
                    aria-label="All workflows"
                  >
                    <Clock className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkflowsSidebarOpen(false)}
                    className="p-1.5 hover:bg-[var(--color-bg-panel)] rounded transition-colors"
                    title="Collapse workflows"
                    aria-label="Collapse workflows panel"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center w-full py-2 gap-1">
                <button
                  type="button"
                  onClick={() => setWorkflowsSidebarOpen(true)}
                  className="p-1.5 hover:bg-[var(--color-bg-panel)] rounded transition-colors"
                  title="Expand workflows"
                  aria-label="Expand workflows panel"
                >
                  <ChevronLeft className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                </button>
                <button
                  type="button"
                  onClick={() => router.push(ROUTES.WORKFLOWS)}
                  className="p-1.5 hover:bg-[var(--color-bg-panel)] rounded transition-colors"
                  title="All workflows"
                  aria-label="View all workflows"
                >
                  <Plus className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                </button>
              </div>
            )}
          </div>
          {workflowsSidebarOpen && (
            <>
              <OnboardingChecklist
                className="shrink-0 m-2 rounded-lg"
                onByokClick={() => setSettingsOpen(true)}
                onPaymentClick={() => router.push(ROUTES.PAYMENTS)}
                onTryItNowClick={() => router.push(ROUTES.DASHBOARD)}
              />
              <div className="flex-1 overflow-y-auto p-2 min-h-0">
                <WorkflowActivityList
                  workflows={workflows ?? []}
                  selectedWorkflowId={selectedWorkflowId}
                  onSelectWorkflow={(id) => {
                    setSelectedWorkflowId(id);
                    router.replace(`${ROUTES.HOME}?workflow=${id}`, { scroll: false });
                  }}
                  loading={workflowsLoading}
                />
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <RequireApiSession>
      <Suspense
        fallback={
          <div className="bg-[var(--color-bg-base)] text-[var(--color-text-primary)] h-screen w-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[var(--color-text-muted)] animate-spin" />
          </div>
        }
      >
        <ChatPageContent />
      </Suspense>
    </RequireApiSession>
  );
}
