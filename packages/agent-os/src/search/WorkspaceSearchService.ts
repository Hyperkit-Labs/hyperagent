/**
 * Workspace search service.
 *
 * Validates requests, delegates to RipgrepAdapter, enforces workspace boundaries
 * and result caps, and returns structured SearchResponse objects.
 */

import type { SearchRequest, SearchResponse } from "./types.js";
import { DEFAULT_MAX_RESULTS } from "./types.js";
import { validateSearchRequest } from "./SearchSafetyValidator.js";
import { executeRipgrep } from "./RipgrepAdapter.js";

export class WorkspaceSearchService {
  async search(req: SearchRequest): Promise<SearchResponse> {
    const validationErrors = validateSearchRequest(req);
    if (validationErrors.length > 0) {
      return {
        mode: req.mode,
        query: req.query,
        totalMatches: 0,
        filesMatched: 0,
        elapsedMs: 0,
        truncated: false,
        warnings: validationErrors.map(
          (e) => `${e.field}: ${e.message}`,
        ),
        matches: [],
      };
    }

    const result = await executeRipgrep(req);

    const fileSet = new Set(result.matches.map((m) => m.filePath));

    return {
      mode: req.mode,
      query: req.query ?? req.regex,
      totalMatches: result.matches.length,
      filesMatched: fileSet.size,
      elapsedMs: result.elapsedMs,
      truncated: result.truncated,
      warnings: result.warnings,
      matches: result.matches,
    };
  }
}
