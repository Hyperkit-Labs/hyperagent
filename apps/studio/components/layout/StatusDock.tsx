"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FileText, AlertCircle } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { useConfig } from "@/components/providers/ConfigProvider";
import { useNetworks } from "@/hooks/useNetworks";
import { useWorkflowPolling } from "@/hooks/useWorkflowPolling";
import { hasAuditOrSimFailure } from "@/lib/types";

interface StatusDockProps {
  /** Active workflow run status: idle | running | failed */
  runStatus?: "idle" | "running" | "failed";
  /** Current workflow name when running */
  activeRunName?: string;
  /** Number of issues (e.g. failed audits) */
  issuesCount?: number;
  /** Environment label (e.g. Firecracker VM) */
  environment?: string;
}

function deriveRunStatus(status: string | undefined): "idle" | "running" | "failed" {
  if (!status) return "idle";
  const running = ["running", "building", "generating", "compiling", "auditing", "testing", "deploying", "processing", "spec_review", "design_review", "pending"];
  if (running.includes(status)) return "running";
  if (["failed", "cancelled"].includes(status)) return "failed";
  return "idle";
}

function StatusDockInner({
  runStatus = "idle",
  activeRunName,
  issuesCount = 0,
}: StatusDockProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workflowId = pathname === ROUTES.HOME || pathname === "/" ? searchParams.get("workflow") : null;
  const { workflow } = useWorkflowPolling(workflowId);
  const { defaultNetworkId } = useConfig();
  const { networks, loading: networksLoading } = useNetworks();

  const resolved = workflow
    ? {
        runStatus: deriveRunStatus(workflow.status),
        activeRunName: (workflow.intent || workflow.workflow_id || "").slice(0, 32) || "Workflow",
        issuesCount: workflow.stages && hasAuditOrSimFailure(workflow) ? 1 : 0,
      }
    : { runStatus, activeRunName, issuesCount };
  const currentNetwork = networks?.find(
    (n) => String(n.id) === String(defaultNetworkId) || String(n.network_id) === String(defaultNetworkId)
  );
  const networkLabel = currentNetwork?.name ?? (defaultNetworkId ? `Chain ${defaultNetworkId}` : "No network");
  const networksAvailable = !networksLoading && (networks?.length ?? 0) > 0;

  return (
    <footer className="flex items-center justify-between h-10 px-4 border-t border-white/5 bg-slate-950/80 backdrop-blur shrink-0">
      <Link
        href={ROUTES.MONITORING}
        className="flex items-center gap-2 text-xs text-slate-300 hover:text-slate-100 transition-colors"
      >
          {resolved.runStatus === "running" ? (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{resolved.activeRunName ? `${resolved.activeRunName.slice(0, 24)}...` : "VM running"}</span>
              <span className="text-slate-500">Live logs</span>
            </>
          ) : (
            <>
              <span className={`h-2 w-2 rounded-full ${resolved.runStatus === "failed" ? "bg-red-400" : "bg-slate-500"}`} />
              <span>{resolved.runStatus === "failed" ? "Pipeline failed" : "Idle"}</span>
              <span className="text-slate-500">Logs</span>
            </>
          )}
      </Link>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        {resolved.issuesCount > 0 && (
          <Link
            href={pathname === ROUTES.HOME ? ROUTES.HOME : ROUTES.MONITORING}
            className="flex items-center gap-1.5 text-red-400 hover:text-red-300 transition-colors"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{resolved.issuesCount} issues</span>
          </Link>
        )}
        <span className={!networksAvailable ? "text-amber-400/80" : ""}>
          {networksAvailable ? networkLabel : "Networks unavailable"}
        </span>
        <Link
          href={ROUTES.MONITORING}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>History</span>
        </Link>
      </div>
    </footer>
  );
}

function StatusDockFallback() {
  const pathname = usePathname();
  const { defaultNetworkId } = useConfig();
  const { networks, loading: networksLoading } = useNetworks();
  const currentNetwork = networks?.find(
    (n) => String(n.id) === String(defaultNetworkId) || String(n.network_id) === String(defaultNetworkId)
  );
  const networkLabel = currentNetwork?.name ?? (defaultNetworkId ? `Chain ${defaultNetworkId}` : "No network");
  const networksAvailable = !networksLoading && (networks?.length ?? 0) > 0;
  return (
    <footer className="flex items-center justify-between h-10 px-4 border-t border-white/5 bg-slate-950/80 backdrop-blur shrink-0">
      <Link href={ROUTES.MONITORING} className="flex items-center gap-2 text-xs text-slate-300 hover:text-slate-100 transition-colors">
        <span className="h-2 w-2 rounded-full bg-slate-500" />
        <span>Idle</span>
        <span className="text-slate-500">Logs</span>
      </Link>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className={!networksAvailable ? "text-amber-400/80" : ""}>
          {networksAvailable ? networkLabel : "Networks unavailable"}
        </span>
        <Link href={ROUTES.MONITORING} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors">
          <FileText className="w-3.5 h-3.5" />
          <span>History</span>
        </Link>
      </div>
    </footer>
  );
}

export function StatusDock(props: StatusDockProps) {
  return (
    <Suspense fallback={<StatusDockFallback />}>
      <StatusDockInner {...props} />
    </Suspense>
  );
}
