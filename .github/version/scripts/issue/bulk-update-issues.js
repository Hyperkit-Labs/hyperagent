#!/usr/bin/env node
/**
 * Bulk GitHub Issue Update Script
 * Template-aware, batched updates. Loads config from scripts/issue-transforms.json.
 *
 * Usage:
 *   npm run issues:bulk-update:dry
 *   GITHUB_TOKEN in .env or export
 *
 * Options:
 *   --dry-run       Preview changes without updating
 *   --limit N       Process at most N issues
 *   --state open|closed|all
 *   --delay ms      Delay between batches
 *   --batch N       Issues per batch
 *   --config PATH   Override config file (default: scripts/issue-transforms.json)
 */

const path = require('path');
const fs = require('fs');

// Load .env: try process.cwd() first (npm runs from project root), then script-relative
const projectRoot = path.resolve(__dirname, '../../../..');
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(projectRoot, '.env'),
];
try {
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      require('dotenv').config({ path: p });
      break;
    }
  }
} catch {
  // dotenv not installed; rely on shell env
}

const REPO_OWNER = process.env.GITHUB_OWNER || 'Hyperkit-labs';
const REPO_NAME = process.env.GITHUB_REPO || 'hyperagent';

const HAS_DOC_REFS = /(documentation references|knowledge resources|docs\/draft\.md|docs\/planning)/i;

function loadConfig(configPath) {
  const p = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(projectRoot, configPath || 'scripts/issue-transforms.json');
  if (!fs.existsSync(p)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function getReplacements(config) {
  const defaults = [
    [/docs\/HyperAgent Spec\.md/gi, 'docs/draft.md'],
    [/docs\/Spec\.md/g, 'docs/draft.md'],
    [/docs\/reference\/spec\/draft\.md/g, 'docs/draft.md'],
  ];
  if (!config?.docReplacements?.length) return defaults;
  return config.docReplacements.map(([from, to]) => {
    if (from instanceof RegExp) return [from, to];
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [new RegExp(escaped, 'gi'), to];
  });
}

function getDocRefsBlock(config) {
  const def = `
---

**Documentation References:**
- Platform spec: \`docs/draft.md\`
- Planning index: \`docs/planning/0-Master-Index.md\`
- Issue template: \`.github/template/ISSUE_TEMPLATE.md\`
`;
  return config?.docRefsBlock?.replace(/\\n/g, '\n') ?? def;
}

function getSectionForLabels(labels, config) {
  if (!config?.sectionsByLabel) return '';
  const names = (labels || []).map((l) => (typeof l === 'string' ? l : l.name || '')).filter(Boolean);
  for (const name of names) {
    const section = config.sectionsByLabel[name.toLowerCase()];
    if (section) return '\n\n' + section;
  }
  return '';
}

function getSectionFromBodyArea(body, config) {
  if (!config?.sectionsByArea) return '';
  const areaMatch = body && body.match(/\*\*Area\*\*:\s*(\w+[-]?\w*)/i);
  if (!areaMatch) return '';
  const area = areaMatch[1].toLowerCase().replace(/-/g, '-');
  for (const [key, section] of Object.entries(config.sectionsByArea)) {
    if (key.toLowerCase().replace(/-/g, '-') === area) return '\n\n' + section;
  }
  return '';
}

function transformBody(body, issue, config) {
  if (!body || typeof body !== 'string') return body;
  const replacements = getReplacements(config);
  const docRefsBlock = getDocRefsBlock(config);

  let out = body;

  for (const [from, to] of replacements) {
    out = out.replace(from, to);
  }

  const labelSection = getSectionForLabels(issue?.labels || [], config);
  if (labelSection && !out.includes('**Area:**')) {
    const insertAt = out.indexOf('**Primary Goal:**') >= 0 ? out.indexOf('**Primary Goal:**') : out.indexOf('##');
    if (insertAt >= 0) {
      out = out.slice(0, insertAt) + labelSection + '\n\n' + out.slice(insertAt);
    } else {
      out = out.trimStart() + labelSection;
    }
  }

  const areaSection = getSectionFromBodyArea(out, config);
  if (areaSection && !out.includes(areaSection.trim())) {
    out = out.trimEnd() + areaSection;
  }

  if (!HAS_DOC_REFS.test(out)) {
    out = out.trimEnd() + docRefsBlock;
  }

  return out;
}

function hasChanges(original, transformed) {
  return original !== transformed;
}

async function fetchIssues(token, state = 'open', perPage = 50) {
  const issues = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=${state}&per_page=${perPage}&page=${page}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) hasMore = false;
    else {
      issues.push(...data.filter((i) => !i.pull_request));
      if (data.length < perPage) hasMore = false;
      else page += 1;
    }
  }

  return issues;
}

async function updateIssue(token, issueNumber, body) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update #${issueNumber} failed ${res.status}: ${text}`);
  }

  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const colors = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', bright: '\x1b[1m' };
function log(msg, c = 'reset') {
  console.log(`${colors[c]}${msg}${colors.reset}`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : null;
  const stateIdx = args.indexOf('--state');
  const state = stateIdx >= 0 ? args[stateIdx + 1] : 'open';
  const delayIdx = args.indexOf('--delay');
  const delay = delayIdx >= 0 ? parseInt(args[delayIdx + 1], 10) : 1000;
  const batchIdx = args.indexOf('--batch');
  const batchSize = batchIdx >= 0 ? parseInt(args[batchIdx + 1], 10) : 5;
  const configIdx = args.indexOf('--config');
  const configPath = configIdx >= 0 ? args[configIdx + 1] : 'scripts/issue-transforms.json';

  if (args.includes('--help') || args.includes('-h')) {
    log('\nBulk GitHub Issue Update\n', 'bright');
    log('Usage: npm run issues:bulk-update:dry [options]', 'cyan');
    log('       (Set GITHUB_TOKEN in .env or export it)\n', 'yellow');
    log('Options:', 'cyan');
    log('  --dry-run       Preview changes without updating');
    log('  --limit N      Process at most N issues');
    log('  --state X      open|closed|all (default: open)');
    log('  --delay ms     Delay between batches (default: 1000)');
    log('  --batch N      Issues per batch (default: 5)');
  log('  --config PATH     Config file (default: scripts/issue-transforms.json)\n');
    return;
  }

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    log('Error: Set GITHUB_TOKEN or GH_TOKEN', 'red');
    log('  Add to .env in project root, or run: export GITHUB_TOKEN=your_token', 'yellow');
    log('  Create token: https://github.com/settings/tokens (scope: repo)', 'yellow');
    process.exit(1);
  }

  const config = loadConfig(configPath);
  if (config) log('Config loaded: ' + configPath, 'cyan');
  else log('Using built-in defaults (no config file)', 'yellow');

  log('\nBulk Issue Update', 'bright');
  log(`${REPO_OWNER}/${REPO_NAME} | state=${state}`, 'cyan');
  if (dryRun) log('DRY RUN - no updates will be made', 'yellow');

  log('\nFetching issues...', 'cyan');
  const allIssues = await fetchIssues(token, state);
  let issues = allIssues;
  if (limit) issues = issues.slice(0, limit);
  log(`Found ${issues.length} issues (${limit ? `limited to ${limit}` : 'all'})\n`, 'green');

  const toUpdate = [];
  for (const issue of issues) {
    const transformed = transformBody(issue.body, issue, config);
    if (hasChanges(issue.body || '', transformed)) {
      toUpdate.push({ issue, original: issue.body, transformed });
    }
  }

  log(`Issues needing update: ${toUpdate.length}`, toUpdate.length ? 'yellow' : 'green');

  if (toUpdate.length === 0) {
    log('Nothing to do.', 'green');
    return;
  }

  if (dryRun) {
    toUpdate.slice(0, 5).forEach(({ issue, transformed }) => {
      log(`\n#${issue.number} ${issue.title}`, 'cyan');
      log('--- New body (first 400 chars) ---', 'yellow');
      log((transformed || '').slice(0, 400) + '...');
    });
    if (toUpdate.length > 5) log(`\n... and ${toUpdate.length - 5} more`, 'yellow');
    return;
  }

  let updated = 0;
  let failed = 0;
  for (let i = 0; i < toUpdate.length; i += batchSize) {
    const batch = toUpdate.slice(i, i + batchSize);
    for (const { issue, transformed } of batch) {
      try {
        await updateIssue(token, issue.number, transformed);
        log(`  #${issue.number} updated`, 'green');
        updated += 1;
      } catch (e) {
        log(`  #${issue.number} failed: ${e.message}`, 'red');
        failed += 1;
      }
    }
    if (i + batchSize < toUpdate.length) await sleep(delay);
  }

  log(`\nDone. Updated: ${updated}, Failed: ${failed}`, 'bright');
}

main().catch((e) => {
  log(`Error: ${e.message}`, 'red');
  process.exit(1);
});
