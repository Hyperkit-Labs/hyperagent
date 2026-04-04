"use client";

import { useEffect, useState } from "react";
import { getPlatformTrackRecord } from "@/lib/api";

const DEFAULTS = {
  audits_completed: 0,
  vulnerabilities_found: 0,
  security_researchers: 0,
  contracts_deployed: 0,
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
    {
      label: "Audits",
      value: record.audits_completed,
      prefix: "",
      suffix: "",
      desc: "Audits Completed",
    },
    {
      label: "Vulnerabilities",
      value: record.vulnerabilities_found,
      prefix: "",
      suffix: "",
      desc: "Vulnerabilities Found",
    },
    {
      label: "Team",
      value: record.security_researchers,
      prefix: "",
      suffix: record.security_researchers > 0 ? "+" : "",
      desc: "Security Researchers",
    },
    {
      label: "Deployments",
      value: record.contracts_deployed,
      prefix: "",
      suffix: "",
      desc: "Contracts Deployed",
    },
  ];

  return { trackRecord };
}
