#!/usr/bin/env node
/**
 * List GitHub issues with filters.
 *
 * Usage:
 *   npm run issues:list
 *   npm run issues:list -- --state closed
 *   npm run issues:list -- --label "area:frontend"
 *   npm run issues:list -- --assignee "JustineDevs"
 */

const path = require('path');

const projectRoot = path.resolve(__dirname, '../../../..');
try {
  require('dotenv').config({ path: path.join(projectRoot, '.env') });
} catch {}

const REPO_OWNER = process.env.GITHUB_OWNER || 'Hyperkit-labs';
const REPO_NAME = process.env.GITHUB_REPO || 'hyperagent';

async function fetchIssues(token, state = 'open', labels = null, assignee = null, perPage = 50) {
  const issues = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    let url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=${state}&per_page=${perPage}&page=${page}`;
    if (labels) url += `&labels=${encodeURIComponent(labels)}`;
    if (assignee) url += `&assignee=${encodeURIComponent(assignee)}`;
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

const c = { r: '\x1b[0m', cyan: '\x1b[36m', yellow: '\x1b[33m' };
function log(m) {
  console.log(`${c.cyan}${m}${c.r}`);
}

async function main() {
  const args = process.argv.slice(2);
  const stateIdx = args.indexOf('--state');
  const state = stateIdx >= 0 ? args[stateIdx + 1] : 'open';
  const labelIdx = args.indexOf('--label');
  const labels = labelIdx >= 0 ? args[labelIdx + 1] : null;
  const assigneeIdx = args.indexOf('--assignee');
  const assignee = assigneeIdx >= 0 ? args[assigneeIdx + 1] : null;
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : null;

  if (args.includes('--help') || args.includes('-h')) {
    console.log(
      'Usage: npm run issues:list -- [--state open|closed|all] [--label "area:frontend"] [--assignee "JustineDevs"] [--limit N]'
    );
    return;
  }

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    console.error('Error: GITHUB_TOKEN required');
    process.exit(1);
  }

  const issues = await fetchIssues(token, state, labels, assignee);
  const list = limit ? issues.slice(0, limit) : issues;

  log(`\n${REPO_OWNER}/${REPO_NAME} | state=${state}${labels ? ` | label=${labels}` : ''}${assignee ? ` | assignee=${assignee}` : ''} | ${list.length} issues\n`);
  list.forEach((i) => {
    const labs = (i.labels || []).map((l) => l.name).join(', ');
    console.log(`  #${i.number}  ${i.title.slice(0, 60)}${i.title.length > 60 ? '...' : ''}`);
    if (labs) console.log(`       ${c.yellow}${labs}${c.r}`);
  });
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
