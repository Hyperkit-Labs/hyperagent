#!/usr/bin/env python3
"""
Update existing GitHub issues with the latest issue template

This script updates existing Phase 1 issues (#177-233) with the new comprehensive
issue template that follows the Internal Planning Layers structure.

Usage:
    python scripts/github/update_existing_issues.py --dry-run
    python scripts/github/update_existing_issues.py
"""

import os
import sys
import argparse
import requests
import logging
from typing import Dict, List, Optional, Any

# Add parent directory to path to import shared module
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from create_phase1_issues import GitHubProjectAutomation, parse_csv

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def get_phase1_issues(token: str, owner: str, repo: str) -> List[Dict[str, Any]]:
    """Fetch all Phase 1 issues from GitHub."""
    url = f"https://api.github.com/repos/{owner}/{repo}/issues"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    
    all_issues = []
    page = 1
    
    while True:
        params = {
            "state": "all",
            "per_page": 100,
            "page": page,
            "milestone": None  # We'll filter by milestone title
        }
        
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code != 200:
            logger.error(f"Failed to fetch issues: {response.status_code} - {response.text}")
            break
        
        issues = response.json()
        if not issues:
            break
        
        for issue in issues:
            # Skip pull requests
            if "pull_request" in issue:
                continue
            
            # Filter for Phase 1 milestones
            milestone = issue.get("milestone")
            if milestone and "Phase 1" in milestone.get("title", ""):
                all_issues.append({
                    "number": issue["number"],
                    "title": issue["title"],
                    "body": issue.get("body", ""),
                    "labels": [label["name"] for label in issue.get("labels", [])],
                    "milestone": milestone["title"],
                    "state": issue["state"],
                    "url": issue["html_url"],
                })
        
        if len(issues) < 100:
            break
        page += 1
    
    logger.info(f"Found {len(all_issues)} Phase 1 issues")
    return all_issues


def extract_metadata_from_issue(issue: Dict[str, Any]) -> Dict[str, Any]:
    """Extract metadata (sprint, chain, preset) from existing issue."""
    labels = issue.get("labels", [])
    milestone = issue.get("milestone", "")
    
    # Extract sprint from milestone
    sprint = None
    if "Sprint" in milestone:
        import re
        sprint_match = re.search(r'Sprint (\d+)', milestone)
        if sprint_match:
            sprint = f"Sprint {sprint_match.group(1)}"
    
    # Extract chain and preset from labels
    chain = next((l.split(":")[1] for l in labels if l.startswith("chain:")), None)
    preset = next((l.split(":")[1] for l in labels if l.startswith("preset:")), None)
    
    return {
        "sprint": sprint,
        "chain": chain,
        "preset": preset,
        "labels": labels,
        "milestone": milestone,
    }


def update_issue(
    automation: GitHubProjectAutomation,
    issue_number: int,
    title: str,
    labels: List[str],
    milestone: str,
    sprint: Optional[str],
    chain: Optional[str],
    preset: Optional[str],
    dry_run: bool = False,
) -> bool:
    """Update an existing issue with the new template."""
    # Generate new body using the same template generation logic
    # This will include updated CODEOWNERS info and current date
    new_body = automation.generate_issue_body(title, labels, milestone, sprint, chain, preset)
    
    if dry_run:
        logger.info(f"[DRY-RUN] Would update issue #{issue_number}: {title[:60]}")
        logger.debug(f"New body length: {len(new_body)} characters")
        return True
    
    # Update issue via GitHub API
    url = f"https://api.github.com/repos/{automation.owner}/{automation.repo}/issues/{issue_number}"
    data = {
        "body": new_body,
    }
    
    response = requests.patch(url, headers=automation.headers, json=data)
    
    if response.status_code == 200:
        logger.info(f"✓ Updated issue #{issue_number}: {title[:60]}")
        return True
    else:
        logger.error(f"✗ Failed to update issue #{issue_number}: {response.status_code} - {response.text}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Update existing Phase 1 issues with latest template"
    )
    parser.add_argument("--dry-run", action="store_true", help="Show what would be updated without making changes")
    parser.add_argument("--issue-range", help="Update specific issue range (e.g., '177-233')")
    parser.add_argument("--csv", help="Path to CSV file to match issues (optional)")
    
    args = parser.parse_args()
    
    # Load configuration from environment
    token = os.getenv("GITHUB_TOKEN")
    owner = os.getenv("GITHUB_OWNER")
    repo = os.getenv("GITHUB_REPO")
    project_id = os.getenv("PROJECT_ID")
    sprint_field_id = os.getenv("SPRINT_FIELD_ID")
    type_field_id = os.getenv("TYPE_FIELD_ID")
    area_field_id = os.getenv("AREA_FIELD_ID")
    chain_field_id = os.getenv("CHAIN_FIELD_ID")
    preset_field_id = os.getenv("PRESET_FIELD_ID")
    
    # Validate required environment variables
    required = {
        "GITHUB_TOKEN": token,
        "GITHUB_OWNER": owner,
        "GITHUB_REPO": repo,
    }
    missing = [k for k, v in required.items() if not v]
    if missing:
        logger.error("Missing required environment variables:")
        for var in missing:
            logger.error(f"  - {var}")
        sys.exit(1)
    
    # Build field IDs dict (optional)
    field_ids = {}
    if sprint_field_id:
        field_ids["sprint"] = sprint_field_id
    if type_field_id:
        field_ids["type"] = type_field_id
    if area_field_id:
        field_ids["area"] = area_field_id
    if chain_field_id:
        field_ids["chain"] = chain_field_id
    if preset_field_id:
        field_ids["preset"] = preset_field_id
    
    # Initialize automation
    codeowners_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "CODEOWNERS")
    automation = GitHubProjectAutomation(token, owner, repo, project_id, field_ids, codeowners_path)
    
    # Fetch existing Phase 1 issues
    logger.info("Fetching existing Phase 1 issues...")
    existing_issues = get_phase1_issues(token, owner, repo)
    
    if not existing_issues:
        logger.warning("No Phase 1 issues found")
        return
    
    # Filter by issue range if specified
    if args.issue_range:
        start, end = map(int, args.issue_range.split("-"))
        existing_issues = [i for i in existing_issues if start <= i["number"] <= end]
        logger.info(f"Filtered to issues #{start}-#{end}: {len(existing_issues)} issues")
    
    # Optionally load CSV to match issues
    csv_issues = {}
    if args.csv:
        csv_issues_list = parse_csv(args.csv)
        csv_issues = {issue["title"]: issue for issue in csv_issues_list}
        logger.info(f"Loaded {len(csv_issues)} issues from CSV for matching")
    
    # Update issues
    logger.info(f"\n{'='*60}")
    logger.info(f"Updating {len(existing_issues)} issues...")
    logger.info(f"{'='*60}\n")
    
    success_count = 0
    failed_count = 0
    skipped_count = 0
    
    for i, issue in enumerate(existing_issues, 1):
        issue_num = issue["number"]
        title = issue["title"]
        
        logger.info(f"[{i}/{len(existing_issues)}] Processing issue #{issue_num}: {title[:60]}...")
        
        # Extract metadata
        metadata = extract_metadata_from_issue(issue)
        
        # Try to match with CSV if provided
        if csv_issues and title in csv_issues:
            csv_issue = csv_issues[title]
            labels = csv_issue["labels"]
            milestone = csv_issue["milestone"]
            sprint = csv_issue.get("sprint")
            chain = csv_issue.get("chain")
            preset = csv_issue.get("preset")
        else:
            # Use metadata from existing issue
            labels = metadata["labels"]
            milestone = metadata["milestone"]
            sprint = metadata["sprint"]
            chain = metadata["chain"]
            preset = metadata["preset"]
        
        # Check if issue body already has the new template AND updated CODEOWNERS format
        # Check for both Layer 1 marker and new sign-off format (current date format)
        body = issue.get("body", "")
        has_layer1 = "## 🎯 Layer 1: Intent Parsing" in body
        has_new_signoff = "Approved by @Hyperionkit on" in body and "YYYY-MM-DD" not in body
        has_access_request = "Access Request:" in body
        
        # Skip if already fully updated (has all new features)
        if has_layer1 and has_new_signoff and has_access_request:
            logger.info(f"  ⏭ Skipping issue #{issue_num} - already fully updated")
            skipped_count += 1
            continue
        
        # Log what needs updating
        if has_layer1:
            needs_update = []
            if not has_access_request:
                needs_update.append("Access Request")
            if not has_new_signoff:
                needs_update.append("Sign-off date")
            if needs_update:
                logger.info(f"  🔄 Issue #{issue_num} needs update: {', '.join(needs_update)}")
        
        # Update the issue
        if update_issue(
            automation,
            issue_num,
            title,
            labels,
            milestone,
            sprint,
            chain,
            preset,
            dry_run=args.dry_run,
        ):
            success_count += 1
        else:
            failed_count += 1
        
        # Rate limiting
        if not args.dry_run:
            import time
            time.sleep(1)
    
    # Summary
    logger.info(f"\n{'='*60}")
    logger.info(f"Update Summary:")
    logger.info(f"  Updated: {success_count} issues")
    logger.info(f"  Skipped (already updated): {skipped_count} issues")
    logger.info(f"  Failed: {failed_count} issues")
    logger.info(f"  Total processed: {len(existing_issues)} issues")
    logger.info(f"{'='*60}")


if __name__ == "__main__":
    main()

