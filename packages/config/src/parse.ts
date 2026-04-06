const TRUE_ENV_VALUES = new Set(["1", "true", "yes"]);
const FALSE_ENV_VALUES = new Set(["0", "false", "no"]);

/**
 * Single parse path for env-derived booleans and numbers across Node services.
 * Truthy: "1", "true", "yes" (case-insensitive). Falsy: "0", "false", "no", unset.
 */
export function parseEnvBool(value: string | undefined, defaultValue: boolean): boolean {
  return parseOptionalEnvBool(value) ?? defaultValue;
}

export function parseOptionalEnvBool(value: string | undefined): boolean | undefined {
  if (value === undefined || value === "") return undefined;
  const v = value.trim().toLowerCase();
  if (TRUE_ENV_VALUES.has(v)) return true;
  if (FALSE_ENV_VALUES.has(v)) return false;
  return undefined;
}

export function parseEnvInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === "") return defaultValue;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

export function parseEnvFloat(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === "") return defaultValue;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : defaultValue;
}

export function parseEnvNonNegativeInt(value: string | undefined, defaultValue: number): number {
  const n = parseEnvInt(value, defaultValue);
  return n < 0 ? defaultValue : n;
}
