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
      if (!line.trim()) return false;
      // Git status porcelain format: XY filename
      // X = index status, Y = working tree status
      // We want files that are not staged (X != ' ' means not staged)
      const indexStatus = line[0];
      const workTreeStatus = line[1];
      
      // Include if:
      // - Untracked (??)
      // - Modified in working tree but not staged ( M,  D, etc.)
      // - Staged but modified in working tree (M , D , etc.)
      // - Any combination that indicates unstaged changes
      return indexStatus !== ' ' || workTreeStatus !== ' ';
    })
    .map(line => {
      // Extract filename (skip the 2-char status and space)
      const filename = line.substring(3).trim();
      // Handle renamed files (old -> new)
      return filename.split(' -> ').pop();
    })
    .filter(Boolean);
}

function getAllChangedFiles() {
  // Get all files that would be staged with 'git add -A'
  // This includes modified, deleted, and untracked files
  const result = execCommand('git status --porcelain');
  if (!result.success) {
    return [];
  }
  return result.stdout
    .trim()
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      // Git status porcelain format: XY filename
      // For staged deletions: "D " (no space before D), filename starts at position 2
      // For unstaged: " D" (space before D), filename starts at position 3
      // For untracked: "??", filename starts at position 3
      // For modified: " M" or "M ", filename starts at position 3
      let filename;
      if (line[0] !== ' ' && line[1] === ' ') {
        // Staged (first char is status, second is space): "D ", "M ", "A ", etc.
        filename = line.substring(2).trim();
      } else {
        // Unstaged or untracked: " D", " M", "??", etc.
        filename = line.substring(3).trim();
      }
      // Handle renamed files (old -> new)
      return filename.split(' -> ').pop();
    })
    .filter(Boolean);
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
  
  const prefixes = {
    frontend: 'feat(frontend)',
    backend: 'feat(backend)',
    docs: 'docs',
    config: 'chore(config)',
    other: 'chore'
  };

  const prefix = prefixes[group] || 'chore';
  
  // Generate a more descriptive message based on file count
  if (fileCount === 1) {
    return `${prefix}: update ${files[0]}`;
  } else if (fileCount <= 5) {
    return `${prefix}: update ${fileCount} file(s)`;
  } else {
    return `${prefix}: update ${fileCount} file(s)`;
  }
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
    // In dry-run, get all files that would be staged (including deleted)
    // In actual run, get unstaged files
    const allChangedFiles = isDryRun ? getAllChangedFiles() : getUnstagedFiles();
    
    if (allChangedFiles.length === 0) {
      log('No changes to commit');
      process.exit(0);
    }
    
    log(`Found ${allChangedFiles.length} unstaged file(s). Staging all changes...`);
    
    if (isDryRun) {
      // In dry-run, use all changed files as what would be staged
      stagedFiles = allChangedFiles;
      log(`[DRY RUN] Would stage ${stagedFiles.length} file(s) with 'git add -A'`);
    } else {
      // Actually stage files
      const stageResult = execCommand('git add -A');
      if (!stageResult.success) {
        log(`Error staging files: ${stageResult.stderr}`);
        process.exit(1);
      }
      
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
    log(`     Files (${commit.files.length} total):`);
    // In dry-run, show all files. In actual run, show first 10
    const filesToShow = isDryRun ? commit.files : commit.files.slice(0, 10);
    filesToShow.forEach(file => {
      log(`       - ${file}`);
    });
    if (!isDryRun && commit.files.length > 10) {
      log(`       ... and ${commit.files.length - 10} more`);
    }
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
    
    if (isDryRun) {
      log(`  [DRY RUN] Would commit ${commit.files.length} file(s):`);
      commit.files.forEach(file => {
        log(`    - ${file}`);
      });
      log(`  [DRY RUN] Message: ${commit.message}`);
      successCount++;
      return;
    }
    
    // Stage files for this group
    // For deleted files, we need to use 'git add' which stages deletions
    // Use git add with individual files, properly quoted
    const filesToStage = commit.files.map(file => {
      // Quote filenames with spaces or special characters
      if (file.includes(' ') || file.includes('(') || file.includes(')')) {
        return `"${file}"`;
      }
      return file;
    });
    
    // Try staging individual files first
    let stageResult = execCommand(`git add -- ${filesToStage.join(' ')}`);
    if (!stageResult.success) {
      log(`  Warning: Failed to stage individual files: ${stageResult.stderr}`);
      // Fallback: unstage everything, then stage only files in this group
      execCommand('git reset');
      // Use a different approach: stage by pattern or use git add with paths
      stageResult = execCommand(`git add -A -- ${filesToStage.join(' ')}`);
      if (!stageResult.success) {
        log(`  ✗ Failed to stage files: ${stageResult.stderr}`);
        return;
      }
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

