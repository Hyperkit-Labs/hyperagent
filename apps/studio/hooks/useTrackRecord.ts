"use client";

import { useEffect, useState } from "react";
import { getPlatformTrackRecord, type PlatformTrackRecord } from "@/lib/api";

/** Refresh waitlist-backed beta count on the login track record (ms). */
const TRACK_RECORD_POLL_MS = 30_000;

const DEFAULTS: PlatformTrackRecord = {
  audits_completed: 0,
  vulnerabilities_found: 0,
  security_researchers: 0,
  contracts_deployed: 0,
  beta_testers_confirmed: 0,
  source: "env_defaults",
};

function normalizeRecord(data: PlatformTrackRecord): PlatformTrackRecord {
  return {
    ...DEFAULTS,
    ...data,
    beta_testers_confirmed:
      typeof data.beta_testers_confirmed === "number"
        ? data.beta_testers_confirmed
        : 0,
  };
}

export function useTrackRecord() {
  const [record, setRecord] = useState<PlatformTrackRecord>(DEFAULTS);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      getPlatformTrackRecord()
        .then((r) => {
          if (!cancelled) setRecord(normalizeRecord(r));
        })
        .catch(() => {
          if (!cancelled) setRecord(DEFAULTS);
        });
    };

    load();
    const interval = setInterval(load, TRACK_RECORD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const betaUsers = record.beta_testers_confirmed ?? 0;

  const trackRecord = [
    {
      label: "Users",
      value: betaUsers,
      prefix: "",
      suffix: "",
      desc: "Beta testers",
    },
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
      label: "Deployments",
      value: record.contracts_deployed,
      prefix: "",
      suffix: "",
      desc: "Contracts Deployed",
    },
  ];

  return { trackRecord };
}
