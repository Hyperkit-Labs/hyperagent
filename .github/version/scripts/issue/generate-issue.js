#!/usr/bin/env node
/**
 * Generate a new issue body from the 6-layer template.
 * Output: markdown to stdout or --output file.
 *
 * Usage:
 *   npm run issues:generate -- --title "Add X" --area frontend
 *   npm run issues:generate -- --title "Fix Y" --type bug --output new-issue.md
 *
 * Options:
 *   --title, -t    Issue title (required)
 *   --area, -a     Area (frontend|orchestration|agents|chain-adapter|infra|contracts|...)
 *   --type, -y     Issue type (feature|bug|epic|chore)
 *   --output, -o   Write to file instead of stdout
 *   --help         Show help
 */

const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '../../../..');

function loadTemplate() {
  const p = path.join(projectRoot, '.github/template/ISSUE_TEMPLATE.md');
  if (!fs.existsSync(p)) {
    return null;
  }
  return fs.readFileSync(p, 'utf8');
}

function generateBody(opts) {
  const template = loadTemplate();
  if (!template) {
    return `# ${opts.title}\n\n*Template not found at .github/template/ISSUE_TEMPLATE.md*\n\n**Primary Goal:**\n> ${opts.title}\n\n**Area:** ${opts.area || 'TBD'}\n**Issue Type:** ${opts.type || 'Feature'}`;
  }

  const area = opts.area || 'TBD';
  const type = opts.type || 'feature';
  const title = opts.title || 'Untitled';

  let body = template
    .replace(/> Use clear, descriptive titles.*/i, `> ${title}`)
    .replace(/\*\*Area\*\*:.*/i, `**Area:** ${area}`)
    .replace(/\*\*Issue Type\*\*:.*/i, `**Issue Type:** ${type}`)
    .replace(/\*\*Primary Goal\*\*:[\s\S]*?(?=\*\*User Story|$)/i, `**Primary Goal:**\n> ${title}\n\n`);

  return body;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Generate issue body from 6-layer template

Usage: npm run issues:generate -- [options]

Options:
  --title, -t   Issue title (required)
  --area, -a    frontend|orchestration|agents|chain-adapter|storage-rag|infra|sdk-cli|security|observability|contracts
  --type, -y    feature|bug|epic|chore
  --output, -o  Write to file instead of stdout
`);
    return;
  }

  const getArg = (names, def) => {
    for (const n of names) {
      const i = args.indexOf(n);
      if (i >= 0 && args[i + 1]) return args[i + 1];
    }
    return def;
  };

  const title = getArg(['--title', '-t']);
  if (!title) {
    console.error('Error: --title is required');
    process.exit(1);
  }

  const opts = {
    title,
    area: getArg(['--area', '-a']),
    type: getArg(['--type', '-y'], 'feature'),
  };

  const body = generateBody(opts);
  const output = getArg(['--output', '-o']);

  if (output) {
    fs.writeFileSync(output, body, 'utf8');
    console.log(`Written to ${output}`);
  } else {
    console.log(body);
  }
}

main();
