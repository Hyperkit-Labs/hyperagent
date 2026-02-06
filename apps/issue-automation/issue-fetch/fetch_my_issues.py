#!/usr/bin/env python3
"""
Fetch GitHub issues assigned to a specific user.

This script fetches all issues assigned to a user and optionally saves them
to JSON files for further processing.
"""

import os
import sys
import requests
import argparse
import json
from typing import Dict, List, Optional
from datetime import datetime

# Fix Windows console encoding
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def fetch_assigned_issues(
    token: str,
    owner: str,
    repo: str,
    assignee: str,
    state: str = "open"
) -> List[Dict]:
    """
    Fetch all issues assigned to a specific user.
    
    Args:
        token: GitHub personal access token
        owner: Repository owner (org or user)
        repo: Repository name
        assignee: GitHub username to filter by
        state: Issue state (open, closed, all)
    
    Returns:
        List of issue dictionaries
    """
    url = f"https://api.github.com/repos/{owner}/{repo}/issues"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    all_issues = []
    page = 1
    per_page = 100
    
    print(f"Fetching {state} issues assigned to @{assignee}...")
    
    while True:
        params = {
            "state": state,
            "assignee": assignee,
            "per_page": per_page,
            "page": page,
            "sort": "updated",
            "direction": "desc"
        }
        
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code != 200:
            print(f"Error fetching issues: {response.status_code}")
            print(response.text)
            break
        
        issues = response.json()
        if not issues:
            break
        
        # Filter out pull requests
        issues = [issue for issue in issues if "pull_request" not in issue]
        all_issues.extend(issues)
        
        print(f"  Fetched {len(all_issues)} issues so far...")
        
        # Check if we've reached the last page
        if len(issues) < per_page:
            break
        
        page += 1
    
    print(f"Found {len(all_issues)} issues assigned to @{assignee}")
    return all_issues

def save_issues_json(issues: List[Dict], filepath: str):
    """Save issues to a JSON file."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(issues, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(issues)} issues to {filepath}")

def print_issues_summary(issues: List[Dict]):
    """Print a summary of fetched issues."""
    if not issues:
        print("\nNo issues found.")
        return
    
    print(f"\n{'='*80}")
    print(f"ISSUES SUMMARY ({len(issues)} total)")
    print(f"{'='*80}\n")
    
    # Group by milestone
    by_milestone = {}
    no_milestone = []
    
    for issue in issues:
        milestone = issue.get("milestone")
        if milestone:
            title = milestone.get("title", "Unknown")
            if title not in by_milestone:
                by_milestone[title] = []
            by_milestone[title].append(issue)
        else:
            no_milestone.append(issue)
    
    # Print by milestone
    for milestone_title, milestone_issues in sorted(by_milestone.items()):
        print(f"\n[{milestone_title}] ({len(milestone_issues)} issues)")
        for issue in sorted(milestone_issues, key=lambda x: x.get("number", 0)):
            number = issue.get("number", "N/A")
            title = issue.get("title", "N/A")
            state = issue.get("state", "unknown")
            url = issue.get("html_url", "")
            print(f"  #{number} [{state}] {title}")
            print(f"    {url}")
    
    # Print issues without milestone
    if no_milestone:
        print(f"\n[No Milestone] ({len(no_milestone)} issues)")
        for issue in sorted(no_milestone, key=lambda x: x.get("number", 0)):
            number = issue.get("number", "N/A")
            title = issue.get("title", "N/A")
            state = issue.get("state", "unknown")
            url = issue.get("html_url", "")
            print(f"  #{number} [{state}] {title}")
            print(f"    {url}")

def main():
    parser = argparse.ArgumentParser(
        description="Fetch GitHub issues assigned to a user"
    )
    parser.add_argument(
        "--assignee",
        default="JustineDevs",
        help="GitHub username to filter by (default: JustineDevs)"
    )
    parser.add_argument(
        "--state",
        choices=["open", "closed", "all"],
        default="open",
        help="Issue state to fetch (default: open)"
    )
    parser.add_argument(
        "--output",
        help="Output JSON file path (optional)"
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Print summary of issues"
    )
    
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
        print("\nSet these in your environment or .env file")
        sys.exit(1)
    
    # Fetch issues
    issues = fetch_assigned_issues(
        token, owner, repo,
        args.assignee,
        state=args.state
    )
    
    # Save to JSON if requested
    if args.output:
        save_issues_json(issues, args.output)
    
    # Print summary if requested
    if args.summary or not args.output:
        print_issues_summary(issues)

if __name__ == "__main__":
    main()

