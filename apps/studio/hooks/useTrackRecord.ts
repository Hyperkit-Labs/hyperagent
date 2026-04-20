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
    waitlist_total:
      typeof data.waitlist_total === "number" ? data.waitlist_total : undefined,
    waitlist_pending:
      typeof data.waitlist_pending === "number"
        ? data.waitlist_pending
        : undefined,
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

  /** Match waitlist hero "Total Joined" when backend returns waitlist_total (WAITLIST_SUPABASE_* on orchestrator). */
  const waitlistUsers =
    typeof record.waitlist_total === "number"
      ? record.waitlist_total
      : (record.beta_testers_confirmed ?? 0);

  const trackRecord = [
    {
      label: "Users",
      value: waitlistUsers,
      prefix: "",
      suffix: "",
      desc:
        typeof record.waitlist_total === "number"
          ? "Waitlist signups"
          : "Beta confirmations",
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
