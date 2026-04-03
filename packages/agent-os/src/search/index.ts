export type {
  SearchMode,
  SearchRequest,
  SearchMatch,
  SearchResponse,
  SearchValidationError,
} from "./types.js";

export {
  SEARCH_MODES,
  DEFAULT_MAX_RESULTS,
  DEFAULT_CONTEXT_LINES,
  MAX_QUERY_LENGTH,
  MAX_REGEX_LENGTH,
} from "./types.js";

export { validateSearchRequest } from "./SearchSafetyValidator.js";
export { executeRipgrep } from "./RipgrepAdapter.js";
export { WorkspaceSearchService } from "./WorkspaceSearchService.js";

export type { IntentMatch } from "./SearchIntentRouter.js";
export { matchIntent, routeToSearchRequest, shouldRouteToSearch } from "./SearchIntentRouter.js";

export type {
  ScaffoldRule,
  FileExistenceRule,
  ExportRule,
  EnvRule,
  RiskPatternRule,
  AnyScaffoldRule,
  ScaffoldCheckResult,
} from "./scaffoldRules.js";
export {
  DEFAULT_SCAFFOLD_RULES,
  buildFileExistenceChecks,
  buildExportChecks,
  buildEnvChecks,
  scaffoldCheckResultToMatches,
  mergeScaffoldResults,
  getRulesForCategories,
} from "./scaffoldRules.js";

export type {
  GroupedFileResult,
  FormattedMatch,
  FormattedSearchResult,
} from "./SearchResultFormatter.js";
export {
  formatSearchResult,
  formatMatchAsOneliner,
  formatResponseAsText,
} from "./SearchResultFormatter.js";
