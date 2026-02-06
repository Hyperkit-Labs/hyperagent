#!/usr/bin/env node

/**
 * Parallel Commit Script
 * 
 * Handles git commits with optional dry-run mode.
 * Supports versioning and parallel commit operations.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const maxCommits = args.find(arg => arg.startsWith('--max='))?.split('=')[1] || null;

function log(message) {
  console.log(`[parallel-commit] ${message}`);
}

function execCommand(command, options = {}) {
  // Always execute read-only git commands (status, diff, etc.) even in dry-run
  // to get actual file information for planning
  const readOnlyCommands = [
    'git status',
    'git diff',
    'git rev-parse',
    'git log',
    'git show',
    'git ls-files'
  ];
  const isReadOnly = readOnlyCommands.some(cmd => command.startsWith(cmd));
  const shouldSimulate = isDryRun && !isReadOnly;
  
  try {
    if (shouldSimulate) {
      log(`[DRY RUN] Would execute: ${command}`);
      return { stdout: '', stderr: '', success: true };
    }
    const result = execSync(command, { 
      encoding: 'utf-8',
      stdio: 'pipe',
      ...options 
    });
    return { stdout: result, stderr: '', success: true };
  } catch (error) {
    return { 
      stdout: error.stdout?.toString() || '', 
      stderr: error.stderr?.toString() || error.message, 
      success: false 
    };
  }
}

function getStagedFiles() {
  const result = execCommand('git diff --cached --name-only');
  if (!result.success) {
    return [];
  }
  return result.stdout.trim().split('\n').filter(Boolean);
}

function getUnstagedFiles() {
  const result = execCommand('git status --porcelain');
  if (!result.success) {
    return [];
  }
  return result.stdout
    .trim()
    .split('\n')
    .filter(line => {
      // Untracked files: ??
      // Modified unstaged:  M (space before M)
      // Deleted unstaged:  D (space before D)
      // Renamed unstaged:  R (space before R)
      // Copied unstaged:  C (space before C)
      const status = line.substring(0, 2);
      return status === '??' || 
             status === ' M' || 
             status === ' D' || 
             status === ' R' || 
             status === ' C' ||
             status === 'AM' || // Added and modified
             status === 'AD';   // Added and deleted
    })
    .map(line => line.substring(3).trim());
}

function groupFilesByType(files) {
  const groups = {
    frontend: [],
    backend: [],
    docs: [],
    config: [],
    other: []
  };

  files.forEach(file => {
    // Normalize path separators for Windows compatibility
    const normalizedFile = file.replace(/\\/g, '/');
    
    if (normalizedFile.startsWith('apps/hyperagent-web/') || normalizedFile.startsWith('apps/web/')) {
      groups.frontend.push(file);
    } else if (normalizedFile.startsWith('apps/hyperagent-api/') || 
               normalizedFile.startsWith('apps/api/') || 
               normalizedFile.startsWith('services/') || 
               normalizedFile.startsWith('agents/')) {
      groups.backend.push(file);
    } else if (normalizedFile.startsWith('docs/') || normalizedFile.endsWith('.md')) {
      groups.docs.push(file);
    } else if (normalizedFile.startsWith('.') || 
               normalizedFile.includes('config') || 
               normalizedFile.includes('package.json') || 
               normalizedFile.includes('.json') ||
               normalizedFile.includes('tsconfig.json') ||
               normalizedFile.includes('turbo.json') ||
               normalizedFile.includes('pnpm-workspace.yaml')) {
      groups.config.push(file);
    } else {
      groups.other.push(file);
    }
  });

  return groups;
}

function generateCommitMessage(files, group) {
  const fileCount = files.length;
  const fileList = files.slice(0, 5).join(', ');
  const more = files.length > 5 ? ` and ${files.length - 5} more` : '';
  
  const prefixes = {
    frontend: 'feat(frontend)',
    backend: 'feat(backend)',
    docs: 'docs',
    config: 'chore(config)',
    other: 'chore'
  };

  const prefix = prefixes[group] || 'chore';
  return `${prefix}: update ${fileCount} file(s)${more ? more : ''}`;
}

function main() {
  log(`Starting parallel commit${isDryRun ? ' (DRY RUN)' : ''}...`);

  // Check if we're in a git repository
  const gitCheck = execCommand('git rev-parse --git-dir');
  if (!gitCheck.success) {
    log('Error: Not in a git repository');
    process.exit(1);
  }

  // Get staged files
  let stagedFiles = getStagedFiles();
  
  // If no staged files, check for unstaged changes
  if (stagedFiles.length === 0) {
    const unstagedFiles = getUnstagedFiles();
    if (unstagedFiles.length === 0) {
      log('No changes to commit');
      process.exit(0);
    }
    
    log(`Found ${unstagedFiles.length} unstaged file(s). Staging all changes...`);
    const stageResult = execCommand('git add -A');
    if (!stageResult.success) {
      log(`Error staging files: ${stageResult.stderr}`);
      process.exit(1);
    }
    
    // In dry-run mode, simulate what would be staged
    if (isDryRun) {
      // Use the unstaged files we found as what would be staged
      stagedFiles = unstagedFiles;
    } else {
      // Re-fetch staged files after actual staging
      stagedFiles = getStagedFiles();
      if (stagedFiles.length === 0) {
        log('No changes to commit after staging');
        process.exit(0);
      }
    }
  }

  log(`Found ${stagedFiles.length} staged file(s)`);

  // Group files by type
  const groups = groupFilesByType(stagedFiles);
  
  const commits = [];
  
  // Create commits for each group
  Object.entries(groups).forEach(([group, files]) => {
    if (files.length > 0) {
      const message = generateCommitMessage(files, group);
      commits.push({ group, files, message });
    }
  });

  if (commits.length === 0) {
    log('No files to commit');
    process.exit(0);
  }

  // Limit commits if --max is specified
  const commitsToProcess = maxCommits 
    ? commits.slice(0, parseInt(maxCommits))
    : commits;

  log(`\nPlanning ${commitsToProcess.length} commit(s):`);
  commitsToProcess.forEach((commit, index) => {
    log(`  ${index + 1}. [${commit.group}] ${commit.message}`);
    log(`     Files: ${commit.files.slice(0, 3).join(', ')}${commit.files.length > 3 ? '...' : ''}`);
  });

  if (isDryRun) {
    log('\n[DRY RUN] No commits were made');
    process.exit(0);
  }

  // Execute commits
  log('\nExecuting commits...');
  let successCount = 0;
  
  commitsToProcess.forEach((commit, index) => {
    log(`\n[${index + 1}/${commitsToProcess.length}] Committing ${commit.group}...`);
    
    // Stage only files for this group
    const stageResult = execCommand(`git add ${commit.files.join(' ')}`);
    if (!stageResult.success) {
      log(`  Warning: Failed to stage files: ${stageResult.stderr}`);
      return;
    }

    // Commit
    const commitResult = execCommand(`git commit -m "${commit.message}"`);
    if (commitResult.success) {
      log(`  ✓ Committed: ${commit.message}`);
      successCount++;
    } else {
      log(`  ✗ Failed: ${commitResult.stderr}`);
    }
  });

  log(`\nCompleted: ${successCount}/${commitsToProcess.length} commit(s) successful`);
  
  if (successCount < commitsToProcess.length) {
    process.exit(1);
  }
}

main();

