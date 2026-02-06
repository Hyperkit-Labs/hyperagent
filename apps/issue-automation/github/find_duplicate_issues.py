#!/usr/bin/env python3
"""
Find and identify duplicate GitHub issues starting from issue #177.

This script:
1. Fetches all issues from #177 onwards
2. Identifies duplicates by title (case-insensitive, normalized)
3. Reports duplicates with their issue numbers
4. Optionally deletes duplicates (keeping the first occurrence)
"""

import os
import sys
import requests
import argparse
from typing import Dict, List, Tuple
from collections import defaultdict
import re

# Fix Windows console encoding
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def normalize_title(title: str) -> str:
    """Normalize title for comparison (lowercase, remove extra spaces)."""
    # Remove extra whitespace and convert to lowercase
    normalized = re.sub(r'\s+', ' ', title.strip().lower())
    return normalized

def fetch_issues(token: str, owner: str, repo: str, start_number: int = 177) -> List[Dict]:
    """Fetch all issues from GitHub starting from issue number."""
    url = f"https://api.github.com/repos/{owner}/{repo}/issues"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    all_issues = []
    page = 1
    per_page = 100
    
    print(f"Fetching issues from #{start_number} onwards...")
    
    while True:
        params = {
            "state": "all",  # Include both open and closed
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
        
        # Filter issues >= start_number
        filtered = [issue for issue in issues if issue.get("number", 0) >= start_number]
        all_issues.extend(filtered)
        
        # If we got fewer than per_page, we're done
        if len(issues) < per_page:
            break
        
        # If the last issue number is less than start_number, we can stop
        if issues[-1].get("number", 0) < start_number:
            break
        
        page += 1
    
    print(f"Found {len(all_issues)} issues from #{start_number} onwards")
    return all_issues

def find_duplicates(issues: List[Dict]) -> Dict[str, List[Dict]]:
    """Find duplicate issues by normalized title."""
    title_map = defaultdict(list)
    
    for issue in issues:
        title = issue.get("title", "")
        normalized = normalize_title(title)
        title_map[normalized].append(issue)
    
    # Filter to only duplicates (more than one issue with same title)
    duplicates = {title: issues_list for title, issues_list in title_map.items() 
                  if len(issues_list) > 1}
    
    return duplicates

def print_duplicates(duplicates: Dict[str, List[Dict]]):
    """Print duplicate issues in a readable format."""
    if not duplicates:
        print("\n✓ No duplicate issues found!")
        return
    
    print(f"\n[DUPLICATES] Found {len(duplicates)} sets of duplicate issues:\n")
    print("=" * 80)
    
    for idx, (normalized_title, issues_list) in enumerate(duplicates.items(), 1):
        # Sort by issue number
        issues_list.sort(key=lambda x: x.get("number", 0))
        
        print(f"\nDuplicate Set #{idx}:")
        print(f"  Title: {issues_list[0].get('title', 'N/A')}")
        print(f"  Count: {len(issues_list)} issues")
        print(f"  Issues:")
        
        for issue in issues_list:
            number = issue.get("number", "N/A")
            state = issue.get("state", "unknown")
            milestone = issue.get("milestone", {}).get("title", "No milestone")
            url = issue.get("html_url", "")
            
            print(f"    - #{number} [{state}] ({milestone}) - {url}")
        
        # Recommend keeping the first one (lowest number)
        keep_number = issues_list[0].get("number", "N/A")
        delete_numbers = [i.get("number") for i in issues_list[1:]]
        
        print(f"  → Keep: #{keep_number}")
        print(f"  → Delete: {', '.join(f'#{n}' for n in delete_numbers)}")
        print()

def delete_duplicates(token: str, owner: str, repo: str, duplicates: Dict[str, List[Dict]], dry_run: bool = True):
    """Delete duplicate issues, keeping the first occurrence (lowest number)."""
    if not duplicates:
        return
    
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    deleted_count = 0
    failed_count = 0
    
    print(f"\n{'[DRY-RUN] ' if dry_run else ''}Deleting duplicate issues...\n")
    
    for normalized_title, issues_list in duplicates.items():
        # Sort by issue number
        issues_list.sort(key=lambda x: x.get("number", 0))
        
        # Keep the first one (lowest number)
        keep_issue = issues_list[0]
        delete_issues = issues_list[1:]
        
        for issue in delete_issues:
            number = issue.get("number", "N/A")
            title = issue.get("title", "N/A")
            
            if dry_run:
                print(f"[DRY-RUN] Would delete issue #{number}: {title[:60]}...")
                deleted_count += 1
            else:
                # Close the issue (GitHub doesn't allow deleting issues via API)
                url = f"https://api.github.com/repos/{owner}/{repo}/issues/{number}"
                data = {
                    "state": "closed",
                    "state_reason": "not_planned"  # Mark as duplicate
                }
                
                response = requests.patch(url, headers=headers, json=data)
                
                if response.status_code == 200:
                    print(f"✓ Closed issue #{number}: {title[:60]}...")
                    deleted_count += 1
                else:
                    print(f"✗ Failed to close issue #{number}: {response.status_code} - {response.text}")
                    failed_count += 1
    
    print(f"\n{'[DRY-RUN] ' if dry_run else ''}Summary:")
    print(f"  {'Would delete' if dry_run else 'Deleted'}: {deleted_count} issues")
    if not dry_run and failed_count > 0:
        print(f"  Failed: {failed_count} issues")

def main():
    parser = argparse.ArgumentParser(
        description="Find and remove duplicate GitHub issues"
    )
    parser.add_argument("--start-number", type=int, default=177, 
                       help="Start scanning from this issue number (default: 177)")
    parser.add_argument("--delete", action="store_true",
                       help="Actually delete duplicates (default: dry-run)")
    parser.add_argument("--dry-run", action="store_true", default=True,
                       help="Show what would be deleted without actually deleting")
    
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
    
    # Fetch issues
    issues = fetch_issues(token, owner, repo, args.start_number)
    
    if not issues:
        print(f"No issues found from #{args.start_number} onwards")
        return
    
    # Find duplicates
    duplicates = find_duplicates(issues)
    
    # Print duplicates
    print_duplicates(duplicates)
    
    # Delete duplicates if requested
    if duplicates:
        dry_run = not args.delete
        delete_duplicates(token, owner, repo, duplicates, dry_run=dry_run)
        
        if dry_run and duplicates:
            print("\n" + "=" * 80)
            print("To actually delete duplicates, run with --delete flag:")
            print(f"  python {sys.argv[0]} --delete")

if __name__ == "__main__":
    main()

