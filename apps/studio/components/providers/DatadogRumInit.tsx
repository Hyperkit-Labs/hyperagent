"use client";

import { useEffect } from "react";
import { initDatadogBrowserRum } from "@/lib/datadogRumInit";

export function DatadogRumInit() {
  useEffect(() => {
    initDatadogBrowserRum();
  }, []);
  return null;
}
