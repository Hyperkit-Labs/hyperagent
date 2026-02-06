#!/usr/bin/env python3
"""
Delete All GitHub Issues

This script deletes all issues from a GitHub repository.
Use with caution - this action cannot be undone!

SETUP:
1. Set GITHUB_TOKEN environment variable (fine-grained PAT with repo access)
2. Set GITHUB_OWNER environment variable (organization or username)
3. Set GITHUB_REPO environment variable (repository name)

USAGE:
    # Dry run (list issues without deleting)
    python scripts/delete_all_issues.py --dry-run

    # Delete all issues
    python scripts/delete_all_issues.py

    # Delete issues with specific state
    python scripts/delete_all_issues.py --state closed
    python scripts/delete_all_issues.py --state open
"""

import os
import sys
import argparse
import time
import logging
import requests
from typing import List, Dict, Optional

# Configure logging following GitHub automation patterns
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class IssueDeleter:
    """Delete GitHub issues from a repository."""

    def __init__(self, token: str, owner: str, repo: str):
        self.token = token
        self.owner = owner
        self.repo = repo
        self.headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        self.base_url = f"https://api.github.com/repos/{owner}/{repo}"

    def list_all_issues(self, state: str = "all") -> List[Dict]:
        """List all issues in the repository."""
        issues = []
        page = 1
        per_page = 100

        logger.info(f"Fetching {state} issues from {self.owner}/{self.repo}...")

        while True:
            url = f"{self.base_url}/issues"
            params = {
                "state": state,
                "per_page": per_page,
                "page": page,
                "sort": "created",
                "direction": "asc",  # Oldest first
            }

            try:
                response = requests.get(url, headers=self.headers, params=params, timeout=30)
                
                # Handle rate limiting
                if response.status_code == 403:
                    retry_after = int(response.headers.get("Retry-After", 60))
                    logger.warning(f"Rate limit exceeded. Waiting {retry_after} seconds...")
                    time.sleep(retry_after)
                    continue
                
                if response.status_code != 200:
                    logger.error(f"Error fetching issues: {response.status_code} - {response.text}")
                    break

                page_issues = response.json()

                # Filter out pull requests (they have 'pull_request' field)
                page_issues = [issue for issue in page_issues if "pull_request" not in issue]

                if not page_issues:
                    break

                issues.extend(page_issues)
                logger.debug(f"Fetched {len(issues)} issues so far...")

                # Check if we've reached the last page
                if len(page_issues) < per_page:
                    break

                page += 1
                time.sleep(0.5)  # Rate limiting
            except requests.exceptions.RequestException as e:
                logger.error(f"Request error: {e}")
                break

        return issues

    def get_issue_node_id(self, issue_number: int) -> Optional[str]:
        """Get the GraphQL node ID for an issue."""
        query = """
        query GetIssueNodeId($owner: String!, $repo: String!, $issueNumber: Int!) {
          repository(owner: $owner, name: $repo) {
            issue(number: $issueNumber) {
              id
            }
          }
        }
        """
        
        variables = {
            "owner": self.owner,
            "repo": self.repo,
            "issueNumber": issue_number,
        }
        
        graphql_headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        
        response = requests.post(
            "https://api.github.com/graphql",
            headers=graphql_headers,
            json={"query": query, "variables": variables},
        )
        
        if response.status_code == 200:
            result = response.json()
            if "errors" not in result and result.get("data", {}).get("repository", {}).get("issue"):
                return result["data"]["repository"]["issue"]["id"]
        return None

    def delete_issue(self, issue_number: int) -> bool:
        """Delete an issue by number using GraphQL (requires admin access)."""
        # Try GraphQL deletion first (requires admin access)
        node_id = self.get_issue_node_id(issue_number)
        
        if node_id:
            mutation = """
            mutation DeleteIssue($issueId: ID!) {
              deleteIssue(input: {issueId: $issueId}) {
                clientMutationId
              }
            }
            """
            
            variables = {"issueId": node_id}
            
            graphql_headers = {
                "Authorization": f"Bearer {self.token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            }
            
            response = requests.post(
                "https://api.github.com/graphql",
                headers=graphql_headers,
                json={"query": mutation, "variables": variables},
            )
            
            if response.status_code == 200:
                result = response.json()
                if "errors" not in result:
                    logger.debug(f"Issue #{issue_number} deleted successfully")
                    return True
                else:
                    logger.warning(f"GraphQL deletion failed for issue #{issue_number}: {result.get('errors')}")
                # If deletion fails, fall through to close/lock
        
        # Fallback: Close and lock the issue (if deletion not possible)
        url = f"{self.base_url}/issues/{issue_number}"
        data = {"state": "closed"}
        
        try:
            response = requests.patch(url, headers=self.headers, json=data, timeout=30)
            
            if response.status_code == 200:
                # Lock the issue to prevent further comments
                lock_url = f"{self.base_url}/issues/{issue_number}/lock"
                lock_response = requests.put(
                    lock_url,
                    headers=self.headers,
                    json={"lock_reason": "resolved"},
                    timeout=30
                )
                logger.debug(f"Issue #{issue_number} closed and locked")
                return True
            else:
                logger.error(f"Failed to close issue #{issue_number}: {response.status_code} - {response.text}")
                return False
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error closing issue #{issue_number}: {e}")
            return False

    def delete_all_issues(self, state: str = "all", dry_run: bool = False) -> None:
        """Delete all issues from the repository."""
        issues = self.list_all_issues(state)

        if not issues:
            logger.info(f"No {state} issues found.")
            return

        logger.info(f"Found {len(issues)} issues to {'delete' if not dry_run else 'review'}:")
        
        # Show first 10 issues
        for issue in issues[:10]:
            logger.info(f"  #{issue['number']}: {issue['title']} ({issue['state']})")
        if len(issues) > 10:
            logger.info(f"  ... and {len(issues) - 10} more")

        if dry_run:
            logger.info(f"[DRY RUN] Would delete/close {len(issues)} issues")
            logger.info("Run without --dry-run to actually delete issues")
            return

        # Confirm deletion
        logger.warning(f"WARNING: This will delete/close {len(issues)} issues!")
        logger.warning("Note: If you have admin access, issues will be permanently deleted.")
        logger.warning("      Otherwise, issues will be closed and locked.")
        confirm = input("Type 'DELETE' to confirm: ")

        if confirm != "DELETE":
            logger.info("Cancelled.")
            return

        # Delete issues with progress tracking
        logger.info(f"Deleting/closing {len(issues)} issues...")
        success_count = 0
        failed_count = 0
        deleted_count = 0
        closed_count = 0

        for i, issue in enumerate(issues, 1):
            issue_num = issue["number"]
            logger.info(f"[{i}/{len(issues)}] Processing issue #{issue_num}: {issue['title'][:50]}...")

            # Try to get node ID first to check if deletion is possible
            node_id = self.get_issue_node_id(issue_num)
            
            if self.delete_issue(issue_num):
                success_count += 1
                # Check if it was actually deleted (GraphQL) or just closed
                if node_id:
                    # Try to verify deletion by checking if issue still exists
                    try:
                        check_url = f"{self.base_url}/issues/{issue_num}"
                        check_response = requests.get(check_url, headers=self.headers, timeout=10)
                        if check_response.status_code == 404:
                            deleted_count += 1
                            logger.debug(f"Issue #{issue_num} permanently deleted")
                        else:
                            closed_count += 1
                            logger.debug(f"Issue #{issue_num} closed and locked")
                    except requests.exceptions.RequestException:
                        closed_count += 1
                        logger.debug(f"Issue #{issue_num} closed (verification failed)")
                else:
                    closed_count += 1
                    logger.debug(f"Issue #{issue_num} closed and locked")
            else:
                failed_count += 1
                logger.error(f"Failed to process issue #{issue_num}")

            # Rate limiting: wait 1 second between requests
            if i < len(issues):
                time.sleep(1)

        logger.info(f"Successfully processed {success_count}/{len(issues)} issues")
        if deleted_count > 0:
            logger.info(f"  - {deleted_count} permanently deleted")
        if closed_count > 0:
            logger.info(f"  - {closed_count} closed and locked")
        if failed_count > 0:
            logger.warning(f"Failed to process {failed_count} issues")


def main():
    parser = argparse.ArgumentParser(
        description="Delete all GitHub issues from a repository"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List issues without deleting (safe preview)",
    )
    parser.add_argument(
        "--state",
        choices=["open", "closed", "all"],
        default="all",
        help="Issue state to delete (default: all)",
    )

    args = parser.parse_args()

    # Load configuration from environment
    token = os.getenv("GITHUB_TOKEN")
    owner = os.getenv("GITHUB_OWNER")
    repo = os.getenv("GITHUB_REPO")

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
        logger.error("Set these in your environment or .env file")
        sys.exit(1)

    # Initialize deleter
    deleter = IssueDeleter(token, owner, repo)

    # Delete issues
    deleter.delete_all_issues(state=args.state, dry_run=args.dry_run)


if __name__ == "__main__":
    main()

