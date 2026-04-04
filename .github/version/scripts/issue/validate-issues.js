#!/usr/bin/env node
/**
 * Validate GitHub issues against the 6-layer template.
 * Checks for required sections and doc references.
 *
 * Usage:
 *   npm run issues:validate
 *   npm run issues:validate -- --limit 20
 */

const path = require('path');

const projectRoot = path.resolve(__dirname, '../../../..');
try {
  require('dotenv').config({ path: path.join(projectRoot, '.env') });
} catch {}

const REPO_OWNER = process.env.GITHUB_OWNER || 'Hyperkit-labs';
const REPO_NAME = process.env.GITHUB_REPO || 'hyperagent';

const REQUIRED_SECTIONS = [
  { name: 'Primary Goal', pattern: /\*\*Primary Goal\*\*:?/i },
  { name: 'Documentation References', pattern: /(documentation references|docs\/draft\.md|docs\/planning)/i },
];

const OBSOLETE_REFS = [
  /docs\/HyperAgent Spec\.md/i,
  /docs\/Spec\.md(?![a-z])/,
];

async function fetchIssues(token, state = 'open', perPage = 50) {
  const issues = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=${state}&per_page=${perPage}&page=${page}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    issues.push(...data.filter((i) => !i.pull_request));
    hasMore = data.length >= perPage ? true : false;
    page++;
  }
  return issues;
}

function validateBody(body) {
  const issues = [];
  if (!body || typeof body !== 'string') {
    issues.push('Empty body');
    return issues;
  }
  for (const { name, pattern } of REQUIRED_SECTIONS) {
    if (!pattern.test(body)) issues.push(`Missing: ${name}`);
  }
  for (const re of OBSOLETE_REFS) {
    if (re.test(body)) issues.push('Obsolete doc ref (update to docs/draft.md)');
  }
  return issues;
}

const c = { r: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m' };
function log(m, col = 'r') {
  console.log(`${c[col]}${m}${c.r}`);
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : null;

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    log('Error: GITHUB_TOKEN required', 'red');
    process.exit(1);
  }

  log('\nValidating issues...', 'cyan');
  const all = await fetchIssues(token);
  const issues = limit ? all.slice(0, limit) : all;
  log(`Checking ${issues.length} issues\n`, 'cyan');

  let ok = 0;
  let fail = 0;
  for (const issue of issues) {
    const errs = validateBody(issue.body);
    if (errs.length === 0) {
      ok++;
      log(`  #${issue.number} OK`, 'green');
    } else {
      fail++;
      log(`  #${issue.number} ${issue.title.slice(0, 40)}...`, 'yellow');
      errs.forEach((e) => log(`      - ${e}`, 'red'));
    }
  }

  log(`\nSummary: ${ok} OK, ${fail} need updates`, 'cyan');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
