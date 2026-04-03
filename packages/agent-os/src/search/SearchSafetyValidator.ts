/**
 * Validates search requests for safety.
 *
 * Blocks path traversal, command injection, regex DoS, and workspace escape attempts.
 */

import * as path from "path";
import type { SearchRequest, SearchValidationError } from "./types.js";
import {
  DEFAULT_MAX_RESULTS,
  MAX_QUERY_LENGTH,
  MAX_REGEX_LENGTH,
  SEARCH_MODES,
} from "./types.js";

const DANGEROUS_PATTERNS = [
  /[;&|`$]/, // shell metacharacters
  /\.\.[/\\]/, // path traversal
  /~[/\\]/, // home dir expansion
];

const REGEX_DOS_PATTERNS = [
  /\(\?[^)]*\){5,}/, // excessive groups
  /(\.\*){4,}/, // catastrophic backtracking bait
  /(\+\+|\*\*){2,}/, // nested quantifiers
];

function isWithinWorkspace(target: string, workspaceRoot: string): boolean {
  const resolved = path.resolve(workspaceRoot, target);
  const normalizedRoot = path.resolve(workspaceRoot);
  return resolved.startsWith(normalizedRoot);
}

export function validateSearchRequest(
  req: Partial<SearchRequest>,
): SearchValidationError[] {
  const errors: SearchValidationError[] = [];

  if (!req.workspaceRoot || typeof req.workspaceRoot !== "string") {
    errors.push({ field: "workspaceRoot", message: "workspaceRoot is required" });
  }

  if (!req.mode || !SEARCH_MODES.includes(req.mode)) {
    errors.push({
      field: "mode",
      message: `mode must be one of: ${SEARCH_MODES.join(", ")}`,
    });
  }

  if (req.query !== undefined) {
    if (typeof req.query !== "string") {
      errors.push({ field: "query", message: "query must be a string" });
    } else if (req.query.length > MAX_QUERY_LENGTH) {
      errors.push({
        field: "query",
        message: `query exceeds max length ${MAX_QUERY_LENGTH}`,
      });
    } else {
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(req.query)) {
          errors.push({
            field: "query",
            message: "query contains disallowed characters",
          });
          break;
        }
      }
    }
  }

  if (req.regex !== undefined) {
    if (typeof req.regex !== "string") {
      errors.push({ field: "regex", message: "regex must be a string" });
    } else if (req.regex.length > MAX_REGEX_LENGTH) {
      errors.push({
        field: "regex",
        message: `regex exceeds max length ${MAX_REGEX_LENGTH}`,
      });
    } else {
      for (const pattern of REGEX_DOS_PATTERNS) {
        if (pattern.test(req.regex)) {
          errors.push({
            field: "regex",
            message: "regex contains potentially dangerous pattern",
          });
          break;
        }
      }
      try {
        new RegExp(req.regex);
      } catch {
        errors.push({ field: "regex", message: "regex is syntactically invalid" });
      }
    }
  }

  if (req.maxResults !== undefined) {
    if (typeof req.maxResults !== "number" || req.maxResults < 1) {
      errors.push({ field: "maxResults", message: "maxResults must be a positive number" });
    }
  }

  if (req.paths && Array.isArray(req.paths) && req.workspaceRoot) {
    for (const p of req.paths) {
      if (!isWithinWorkspace(p, req.workspaceRoot)) {
        errors.push({
          field: "paths",
          message: `path escapes workspace boundary: ${p}`,
        });
      }
    }
  }

  if (req.includeGlobs && Array.isArray(req.includeGlobs)) {
    for (const g of req.includeGlobs) {
      if (typeof g !== "string" || g.includes("..")) {
        errors.push({
          field: "includeGlobs",
          message: `glob contains disallowed pattern: ${g}`,
        });
      }
    }
  }

  return errors;
}
