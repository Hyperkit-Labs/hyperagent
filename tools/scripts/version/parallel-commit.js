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
  try {
    if (isDryRun) {
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
    .filter(line => line.startsWith('??') || line.startsWith(' M') || line.startsWith(' M'))
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
    if (file.startsWith('apps/web/')) {
      groups.frontend.push(file);
    } else if (file.startsWith('apps/api/') || file.startsWith('services/') || file.startsWith('agents/')) {
      groups.backend.push(file);
    } else if (file.startsWith('docs/') || file.endsWith('.md')) {
      groups.docs.push(file);
    } else if (file.startsWith('.') || file.includes('config') || file.includes('package.json') || file.includes('.json')) {
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
  const stagedFiles = getStagedFiles();
  
  if (stagedFiles.length === 0) {
    log('No staged files found. Staging all changes...');
    const stageResult = execCommand('git add -A');
    if (!stageResult.success) {
      log(`Error staging files: ${stageResult.stderr}`);
      process.exit(1);
    }
    // Re-fetch staged files
    const newStagedFiles = getStagedFiles();
    if (newStagedFiles.length === 0) {
      log('No changes to commit');
      process.exit(0);
    }
    stagedFiles.push(...newStagedFiles);
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

