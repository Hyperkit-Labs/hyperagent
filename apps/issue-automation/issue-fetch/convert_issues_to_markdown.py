#!/usr/bin/env python3
"""
Convert GitHub issues to individual .md files for implementation tracking.

This script fetches GitHub issues and converts them to markdown files
following the structure defined in the monorepo documentation.
"""

import os
import sys
import requests
import argparse
import json
import re
from typing import Dict, List
from urllib.parse import quote
from datetime import datetime

# Note: Windows console encoding is handled by fetch_my_issues when imported
# No need to wrap here to avoid conflicts

def slugify(text: str) -> str:
    """Convert text to URL-friendly slug."""
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text[:50]  # Limit length

def fetch_issue(token: str, owner: str, repo: str, issue_number: int) -> Dict:
    """Fetch a single issue from GitHub."""
    url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(f"Error fetching issue #{issue_number}: {response.status_code}")
        return None
    
    return response.json()

def extract_labels(issue: Dict) -> Dict[str, str]:
    """Extract label values into a dictionary."""
    labels = {}
    for label in issue.get("labels", []):
        name = label["name"]
        if ":" in name:
            key, value = name.split(":", 1)
            labels[key] = value
        else:
            labels[name] = True
    return labels

def generate_markdown(issue: Dict) -> str:
    """Generate markdown content for issue."""
    number = issue.get("number")
    title = issue.get("title", "")
    state = issue.get("state", "open")
    body = issue.get("body", "")
    assignee = issue.get("assignee", {}).get("login") if issue.get("assignee") else "Unassigned"
    milestone = issue.get("milestone", {}).get("title") if issue.get("milestone") else "No milestone"
    url = issue.get("html_url", "")
    created_at = issue.get("created_at", "")
    updated_at = issue.get("updated_at", "")
    
    labels = extract_labels(issue)
    issue_type = labels.get("type", "feature")
    area = labels.get("area", "unassigned")
    sprint = labels.get("sprint", "Unassigned")
    
    # Build markdown
    md = f"""# Issue #{number}: {title}

**Status**: {state.title()}  
**Assignee**: @{assignee}  
**Sprint**: {sprint}  
**Milestone**: {milestone}  
**Type**: {issue_type}  
**Area**: {area}  
**GitHub**: {url}  
**Created**: {created_at}  
**Updated**: {updated_at}

---

## Original Issue Body

{body}

---

## Implementation Notes

### Progress Updates
- [ ] Started: YYYY-MM-DD
- [ ] In Progress: YYYY-MM-DD
- [ ] Blocked: YYYY-MM-DD (reason)
- [ ] Completed: YYYY-MM-DD

### Implementation Decisions
<!-- Document key decisions made during implementation -->

### Code Changes
<!-- List files created/modified -->
- Files created:
  - 
- Files modified:
  - 

### Testing
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] Manual testing completed

### PR Links
<!-- Link PRs that close this issue -->
- 

### Completion Checklist
- [ ] Code implemented
- [ ] Tests passing
- [ ] Documentation updated
- [ ] PR merged
- [ ] Issue closed

---
*Last synced: {datetime.now().isoformat()}*
"""
    return md

def save_markdown(content: str, filepath: str):
    """Save markdown content to file."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Saved: {filepath}")

def main():
    parser = argparse.ArgumentParser(
        description="Convert GitHub issues to markdown files"
    )
    parser.add_argument("--assignee", help="Filter by assignee")
    parser.add_argument("--sprint", help="Filter by sprint")
    parser.add_argument("--issue", type=int, help="Convert specific issue number")
    parser.add_argument("--output-dir", default="docs/implementation/issues",
                       help="Output directory for .md files")
    parser.add_argument("--sync", action="store_true",
                       help="Sync existing files with GitHub")
    
    args = parser.parse_args()
    
    # Load configuration
    token = os.getenv("GITHUB_TOKEN")
    owner = os.getenv("GITHUB_OWNER")
    repo = os.getenv("GITHUB_REPO")
    
    if not token or not owner or not repo:
        print("Error: Missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO")
        sys.exit(1)
    
    if args.issue:
        # Convert single issue
        issue = fetch_issue(token, owner, repo, args.issue)
        if issue:
            title_slug = slugify(issue["title"])
            filename = f"{args.issue}-{title_slug}.md"
            filepath = os.path.join(args.output_dir, filename)
            md = generate_markdown(issue)
            save_markdown(md, filepath)
    else:
        # Convert all issues for assignee
        # Import fetch_assigned_issues from fetch_my_issues
        script_dir = os.path.dirname(os.path.abspath(__file__))
        if script_dir not in sys.path:
            sys.path.insert(0, script_dir)
        
        try:
            from fetch_my_issues import fetch_assigned_issues
        except ImportError as e:
            print(f"Error importing fetch_my_issues: {e}")
            print(f"Script directory: {script_dir}")
            sys.exit(1)
        
        issues = fetch_assigned_issues(
            token, owner, repo,
            args.assignee or "JustineDevs",
            state="open"
        )
        
        # Filter by sprint if provided
        if args.sprint:
            filtered = []
            for issue in issues:
                labels = extract_labels(issue)
                if labels.get("sprint") == args.sprint:
                    filtered.append(issue)
            issues = filtered
        
        # Convert each issue
        for issue in issues:
            number = issue["number"]
            title_slug = slugify(issue["title"])
            filename = f"{number}-{title_slug}.md"
            filepath = os.path.join(args.output_dir, filename)
            
            # Skip if exists and not syncing
            if os.path.exists(filepath) and not args.sync:
                print(f"Skipping existing: {filename}")
                continue
            
            md = generate_markdown(issue)
            save_markdown(md, filepath)

if __name__ == "__main__":
    main()

