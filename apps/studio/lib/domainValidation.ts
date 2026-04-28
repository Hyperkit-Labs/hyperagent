"use client";

const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeDomainInput(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

export function validateDomainInput(value: string): string | null {
  const domain = normalizeDomainInput(value);
  if (!domain) {
    return "Enter a domain name.";
  }
  if (domain.length > 253) {
    return "Domain names must be 253 characters or fewer.";
  }
  if (domain.includes("://") || domain.includes("/") || domain.includes("@")) {
    return "Enter only the hostname, for example example.com.";
  }
  const labels = domain.split(".");
  if (labels.length < 2) {
    return "Use a fully qualified domain such as example.com.";
  }
  for (const label of labels) {
    if (!DOMAIN_LABEL_PATTERN.test(label)) {
      return `Invalid domain label: ${label}`;
    }
  }
  return null;
}
