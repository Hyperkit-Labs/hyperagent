"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ROUTES } from "@/constants/routes";

export default function MarketplacePage() {
  const router = useRouter();

  useEffect(() => {
    toast.info("Marketplace is now Templates");
    const t = setTimeout(() => router.replace(ROUTES.TEMPLATES), 150);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[200px] gap-2 text-[var(--color-text-tertiary)]">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm">Redirecting to Templates...</span>
    </div>
  );
}
