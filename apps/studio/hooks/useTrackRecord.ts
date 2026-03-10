"use client";

import { useEffect, useState } from "react";
import { getPlatformTrackRecord } from "@/lib/api";

const DEFAULTS = {
  audits_completed: 500,
  vulnerabilities_found: 1200,
  security_researchers: 50,
  tvl_secured: 2,
  tvl_suffix: "B+",
};

export function useTrackRecord() {
  const [record, setRecord] = useState(DEFAULTS);

  useEffect(() => {
    const ac = new AbortController();
    getPlatformTrackRecord(ac.signal)
      .then(setRecord)
      .catch(() => setRecord(DEFAULTS));
    return () => ac.abort();
  }, []);

  const trackRecord = [
    { label: "Audits", value: record.audits_completed, prefix: "", suffix: "", desc: "Audits Completed" },
    { label: "Vulnerabilities", value: record.vulnerabilities_found, prefix: "", suffix: "", desc: "Vulnerabilities Found" },
    { label: "Team", value: record.security_researchers, prefix: "", suffix: "+", desc: "Security Researchers" },
    { label: "TVL", value: record.tvl_secured, prefix: "$", suffix: record.tvl_suffix, desc: "TVL Secured" },
  ];

  return { trackRecord };
}
