"use client";

import { useEffect, useState } from "react";
import { hasCryptoSubtle } from "@/lib/session-store";

export function CryptoUnavailableBanner() {
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    setAvailable(hasCryptoSubtle());
  }, []);

  if (available) return null;

  return (
    <div
      className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
      role="alert"
    >
      <p className="font-medium">Secure context required</p>
      <p className="mt-1 text-xs text-amber-300/80">
        Your browser does not expose the Web Crypto API on this origin.
        LLM key encryption and session-only keys are unavailable.
        Access HyperAgent over HTTPS or localhost to enable full functionality.
      </p>
    </div>
  );
}
