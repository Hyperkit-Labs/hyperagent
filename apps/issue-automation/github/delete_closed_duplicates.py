#!/usr/bin/env python3
"""
Delete closed duplicate issues from GitHub.

Note: GitHub's REST API does not support deleting issues directly.
This script attempts to use GitHub CLI (gh) which may have delete capabilities,
or provides instructions for manual deletion via web UI.

For issues that cannot be deleted via API, this script will:
1. List all closed duplicate issues
2. Provide a script to delete them via GitHub CLI (if available)
3. Provide instructions for manual deletion via web UI
"""

import os
import sys
import subprocess
import requests
import argparse
from typing import List, Dict

# Fix Windows console encoding
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def fetch_closed_duplicates(token: str, owner: str, repo: str, start_number: int = 177) -> List[Dict]:
    """Fetch all closed issues that are likely duplicates."""
    url = f"https://api.github.com/repos/{owner}/{repo}/issues"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    all_issues = []
    page = 1
    per_page = 100
    
    print(f"Fetching closed issues from #{start_number} onwards...")
    
    while True:
        params = {
            "state": "closed",  # Only closed issues
            "per_page": per_page,
            "page": page,
            "sort": "number",
            "direction": "asc"
        }
        
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code != 200:
            print(f"Error fetching issues: {response.status_code}")
            print(response.text)
            break
        
        issues = response.json()
        if not issues:
            break
        
        # Filter issues >= start_number and closed as "not_planned" (duplicates)
        filtered = [
            issue for issue in issues 
            if issue.get("number", 0) >= start_number 
            and issue.get("state") == "closed"
            and issue.get("state_reason") == "not_planned"  # These are our duplicates
        ]
        all_issues.extend(filtered)
        
        if len(issues) < per_page:
            break
        
        if issues[-1].get("number", 0) < start_number:
            break
        
        page += 1
    
    print(f"Found {len(all_issues)} closed duplicate issues")
    return all_issues

def delete_via_gh_cli(owner: str, repo: str, issue_numbers: List[int], dry_run: bool = True) -> bool:
    """Attempt to delete issues using GitHub CLI."""
    print(f"\n{'[DRY-RUN] ' if dry_run else ''}Attempting to delete issues via GitHub CLI...")
    
    # Check if gh CLI is available
    try:
        result = subprocess.run(["gh", "--version"], capture_output=True, text=True)
        if result.returncode != 0:
            print("GitHub CLI (gh) is not installed or not authenticated")
            return False
    except FileNotFoundError:
        print("GitHub CLI (gh) is not installed")
        return False
    
    deleted_count = 0
    failed_count = 0
    
    for issue_num in issue_numbers:
        if dry_run:
            print(f"[DRY-RUN] Would delete issue #{issue_num}")
            deleted_count += 1
        else:
            # Try to delete using gh CLI
            # Note: GitHub CLI may not support issue deletion either
            try:
                # First, try to see if gh issue delete exists
                result = subprocess.run(
                    ["gh", "issue", "delete", str(issue_num), "--repo", f"{owner}/{repo}", "--yes"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                if result.returncode == 0:
                    print(f"✓ Deleted issue #{issue_num}")
                    deleted_count += 1
                else:
                    # If delete doesn't work, try close with delete flag (if it exists)
                    print(f"✗ GitHub CLI does not support deleting issue #{issue_num}")
                    print(f"  Error: {result.stderr}")
                    failed_count += 1
            except subprocess.TimeoutExpired:
                print(f"✗ Timeout deleting issue #{issue_num}")
                failed_count += 1
            except Exception as e:
                print(f"✗ Error deleting issue #{issue_num}: {e}")
                failed_count += 1
    
    print(f"\n{'[DRY-RUN] ' if dry_run else ''}Summary:")
    print(f"  {'Would delete' if dry_run else 'Deleted'}: {deleted_count} issues")
    if not dry_run and failed_count > 0:
        print(f"  Failed: {failed_count} issues")
    
    return deleted_count > 0

def generate_manual_deletion_script(owner: str, repo: str, issue_numbers: List[int]):
    """Generate a script with instructions for manual deletion."""
    script_content = f"""#!/bin/bash
# Manual deletion script for GitHub issues
# GitHub's API does not support deleting issues, so they must be deleted via web UI
#
# Repository: {owner}/{repo}
# Issues to delete: {len(issue_numbers)} issues
#
# Instructions:
# 1. Go to: https://github.com/{owner}/{repo}/issues
# 2. For each issue number below, navigate to the issue
# 3. Click the "..." menu (three dots) in the top right
# 4. Select "Delete issue"
# 5. Confirm deletion
#
# Or use GitHub CLI (if it supports deletion):
# Note: GitHub CLI may not support issue deletion. Check with: gh issue delete --help

"""
    
    # Generate individual delete commands (if gh supports it)
    for issue_num in issue_numbers:
        script_content += f"# gh issue delete {issue_num} --repo {owner}/{repo} --yes\n"
    
    script_content += f"""
# Alternative: Use GitHub's web interface
# Bulk delete URL (if available):
# https://github.com/{owner}/{repo}/issues?q=is:issue+is:closed+state_reason:not_planned

# List of issue numbers to delete:
"""
    
    for issue_num in issue_numbers:
        script_content += f"# - #{issue_num}: https://github.com/{owner}/{repo}/issues/{issue_num}\n"
    
    script_path = "scripts/github/delete_duplicates_manual.sh"
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(script_content)
    
    print(f"\nGenerated manual deletion script: {script_path}")
    print(f"Contains {len(issue_numbers)} issue numbers to delete")

def generate_graphql_delete_attempt(token: str, owner: str, repo: str, issue_numbers: List[int]):
    """Attempt to delete issues using GraphQL API (may not work)."""
    print("\nAttempting GraphQL deletion (experimental)...")
    
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    # First, get repository ID
    query_repo = f"""
    query {{
      repository(owner: "{owner}", name: "{repo}") {{
        id
      }}
    }}
    """
    
    response = requests.post(
        "https://api.github.com/graphql",
        headers=headers,
        json={"query": query_repo}
    )
    
    if response.status_code != 200:
        print(f"Failed to get repository ID: {response.status_code}")
        return False
    
    repo_data = response.json()
    if "errors" in repo_data:
        print(f"GraphQL errors: {repo_data['errors']}")
        return False
    
    repo_id = repo_data.get("data", {}).get("repository", {}).get("id")
    if not repo_id:
        print("Could not get repository ID")
        return False
    
    print(f"Repository ID: {repo_id}")
    print("Note: GitHub's GraphQL API also does not support deleting issues.")
    print("Issues can only be deleted via the web UI by repository owners/admins.")
    
    return False

def main():
    parser = argparse.ArgumentParser(
        description="Delete closed duplicate GitHub issues"
    )
    parser.add_argument("--start-number", type=int, default=177,
                       help="Start scanning from this issue number (default: 177)")
    parser.add_argument("--delete", action="store_true",
                       help="Actually attempt to delete (default: dry-run)")
    parser.add_argument("--use-gh-cli", action="store_true",
                       help="Attempt to use GitHub CLI for deletion")
    parser.add_argument("--generate-script", action="store_true", default=True,
                       help="Generate manual deletion script")
    
    args = parser.parse_args()
    
    # Load configuration from environment
    token = os.getenv("GITHUB_TOKEN")
    owner = os.getenv("GITHUB_OWNER")
    repo = os.getenv("GITHUB_REPO")
    
    if not token or not owner or not repo:
        print("Error: Missing required environment variables:")
        missing = []
        if not token:
            missing.append("GITHUB_TOKEN")
        if not owner:
            missing.append("GITHUB_OWNER")
        if not repo:
            missing.append("GITHUB_REPO")
        print(f"  Missing: {', '.join(missing)}")
        print("\nSet these in your environment or .env.issue file")
        sys.exit(1)
    
    # Fetch closed duplicates
    closed_issues = fetch_closed_duplicates(token, owner, repo, args.start_number)
    
    if not closed_issues:
        print("\nNo closed duplicate issues found")
        return
    
    issue_numbers = [issue.get("number") for issue in closed_issues]
    print(f"\nFound {len(issue_numbers)} closed duplicate issues:")
    print(f"  Issue numbers: {', '.join(map(str, issue_numbers[:10]))}{'...' if len(issue_numbers) > 10 else ''}")
    
    # Attempt deletion methods
    deleted = False
    
    if args.use_gh_cli:
        deleted = delete_via_gh_cli(owner, repo, issue_numbers, dry_run=not args.delete)
    
    if not deleted:
        # Try GraphQL (will likely fail)
        generate_graphql_delete_attempt(token, owner, repo, issue_numbers)
    
    # Generate manual deletion script
    if args.generate_script:
        generate_manual_deletion_script(owner, repo, issue_numbers)
    
    print("\n" + "=" * 80)
    print("IMPORTANT: GitHub's API does not support deleting issues.")
    print("Issues can only be deleted via the web UI:")
    print(f"  1. Go to: https://github.com/{owner}/{repo}/issues")
    print("  2. Filter by: is:issue is:closed state_reason:not_planned")
    print("  3. For each issue, click '...' menu → 'Delete issue'")
    print("\nOr use the generated script for reference.")
    print("=" * 80)

if __name__ == "__main__":
    main()

