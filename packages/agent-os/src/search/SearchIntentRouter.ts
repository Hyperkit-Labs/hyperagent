/**
 * SearchIntentRouter: maps natural language user phrases to typed SearchRequest.
 *
 * Route user phrases like "find all TODOs", "grep for auth middleware",
 * "locate every use of process.env", "verify scaffold" to the correct
 * search mode before falling back to semantic reasoning.
 */

import type { SearchMode, SearchRequest } from "./types.js";
import { DEFAULT_MAX_RESULTS } from "./types.js";

export interface IntentMatch {
  readonly mode: SearchMode;
  readonly query?: string;
  readonly regex?: string;
  readonly confidence: number;
}

interface IntentPattern {
  readonly patterns: readonly RegExp[];
  readonly mode: SearchMode;
  readonly extractQuery: (input: string, match: RegExpMatchArray) => string | undefined;
}

const INTENT_PATTERNS: readonly IntentPattern[] = [
  {
    patterns: [
      /\b(?:find|search|show|list)\s+(?:all\s+)?(?:todos?|fixmes?|hacks?|xxx)\b/i,
      /\btodo\b/i,
      /\bfixme\b/i,
    ],
    mode: "todo",
    extractQuery(input, match) {
      const after = input.slice((match.index ?? 0) + match[0].length).trim();
      const kw = after.match(/(?:about|for|with|related to|containing)\s+["']?(\w[\w\s]*\w?)["']?/i);
      return kw?.[1]?.trim();
    },
  },
  {
    patterns: [
      /\b(?:find|locate|search)\s+(?:file|files)\s+(?:named?|called)\s+["']?(.+?)["']?\s*$/i,
      /\b(?:find|locate)\s+(?:every|all|the)\s+(?:file|files)\s+(?:matching|like)\s+["']?(.+?)["']?\s*$/i,
      /\bfilename\s+["']?(.+?)["']?\s*$/i,
    ],
    mode: "filename",
    extractQuery(_input, match) {
      return match[1]?.trim();
    },
  },
  {
    patterns: [
      /\b(?:grep|search|find|locate)\s+(?:for\s+)?(?:every|all|each)?\s*(?:uses?\s+of|references?\s+to|occurrences?\s+of)\s+["']?(\S+?)["']?\s*$/i,
      /\b(?:grep|rg)\s+(?:for\s+)?["']?(\S+?)["']?\s*$/i,
      /\bsymbol\s+["']?(\S+?)["']?\s*$/i,
    ],
    mode: "symbol",
    extractQuery(_input, match) {
      return match[1]?.trim();
    },
  },
  {
    patterns: [
      /\b(?:find|show|list|locate)\s+(?:all\s+)?(?:env|environment)\s*(?:vars?|variables?)?\b/i,
      /\bprocess\.env\b/i,
      /\bimport\.meta\.env\b/i,
      /\bNEXT_PUBLIC_/i,
    ],
    mode: "env",
    extractQuery(input) {
      const specific = input.match(/["']?([A-Z][A-Z0-9_]{2,})["']?/);
      return specific?.[1];
    },
  },
  {
    patterns: [
      /\b(?:find|show|list|locate)\s+(?:all\s+)?exports?\b/i,
      /\bbarrel\s+(?:files?|exports?)\b/i,
    ],
    mode: "export",
    extractQuery(input) {
      const specific = input.match(/(?:of|named?|called)\s+["']?(\w+)["']?/i);
      return specific?.[1];
    },
  },
  {
    patterns: [
      /\b(?:find|scan|detect|show)\s+(?:all\s+)?(?:risky|dangerous|unsafe|insecure)\s+(?:patterns?|code|usage)\b/i,
      /\brisk\s+scan\b/i,
      /\bsecurity\s+scan\b/i,
    ],
    mode: "risk",
    extractQuery() {
      return undefined;
    },
  },
  {
    patterns: [
      /\b(?:verify|check|validate)\s+scaffold\b/i,
      /\bscaffold\s+(?:verify|check|validation)\b/i,
    ],
    mode: "scaffold",
    extractQuery() {
      return undefined;
    },
  },
];

export function matchIntent(input: string): IntentMatch | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  for (const pattern of INTENT_PATTERNS) {
    for (const re of pattern.patterns) {
      const match = trimmed.match(re);
      if (match) {
        const query = pattern.extractQuery(trimmed, match);
        return {
          mode: pattern.mode,
          query,
          confidence: query ? 0.9 : 0.7,
        };
      }
    }
  }

  return null;
}

export function routeToSearchRequest(
  input: string,
  workspaceRoot: string,
  overrides?: Partial<SearchRequest>,
): SearchRequest | null {
  const intent = matchIntent(input);
  if (!intent) return null;

  return {
    mode: intent.mode,
    query: intent.query ?? overrides?.query,
    regex: intent.regex ?? overrides?.regex,
    workspaceRoot,
    maxResults: overrides?.maxResults ?? DEFAULT_MAX_RESULTS,
    caseSensitive: overrides?.caseSensitive,
    wholeWord: overrides?.wholeWord,
    includeGlobs: overrides?.includeGlobs ? [...overrides.includeGlobs] : undefined,
    excludeGlobs: overrides?.excludeGlobs ? [...overrides.excludeGlobs] : undefined,
    contextLines: overrides?.contextLines,
    includeHidden: overrides?.includeHidden,
    includeIgnored: overrides?.includeIgnored,
    paths: overrides?.paths ? [...overrides.paths] : undefined,
    rules: overrides?.rules ? [...overrides.rules] : undefined,
  };
}

export function shouldRouteToSearch(input: string): boolean {
  return matchIntent(input) !== null;
}
