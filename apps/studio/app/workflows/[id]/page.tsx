"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ROUTES } from "@/constants/routes";

/**
 * Workflow detail is shown on the chat page. Redirect /workflows/[id] to chat with workflow selected.
 */
export default function WorkflowIdRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;

  useEffect(() => {
    if (!id) {
      router.replace(ROUTES.HOME);
      return;
    }
    toast.info("Opening workflow...");
    const t = setTimeout(() => router.replace(`${ROUTES.HOME}?workflow=${encodeURIComponent(id)}`), 150);
    return () => clearTimeout(t);
  }, [router, id]);

  return (
    <div className="flex items-center justify-center min-h-[200px] gap-2 text-[var(--color-text-tertiary)]">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm">Opening workflow...</span>
    </div>
  );
}
