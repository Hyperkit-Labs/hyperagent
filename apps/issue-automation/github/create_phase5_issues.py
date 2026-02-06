#!/usr/bin/env python3
"""
GitHub Issues Automation for HyperAgent Phase 5 Roadmap (Verifiable Intelligence)

This script creates GitHub issues for Phase 5 (H2 2027) focusing on:
- Verifiable Build & Audit (ZK proofs)
- Verifiable Simulation & Deployment
- Cross-Chain AVS for Verification
- Verifiable Mode toggle and UX
- Cryptographic proof generation

SETUP: Same as Phase 1 - uses same environment variables and project structure.
"""

import os
import sys

# Add parent directory to path to import shared module
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the base automation class
from create_phase1_issues import GitHubProjectAutomation

def main():
    """Main entry point for Phase 5 issue creation."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Create GitHub issues for Phase 5 (Verifiable Intelligence)"
    )
    parser.add_argument("--csv", help="Path to CSV file with Phase 5 issues")
    parser.add_argument("--yaml", help="Path to YAML file with Phase 5 issues")
    parser.add_argument("--dry-run", action="store_true", help="Validate without creating issues")
    
    args = parser.parse_args()
    
    # Load configuration from environment (same as Phase 1)
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
        "PROJECT_ID": project_id,
    }
    missing = [k for k, v in required.items() if not v]
    if missing:
        print("Error: Missing required environment variables:")
        for var in missing:
            print(f"  - {var}")
        print("\nSee Phase 1 setup instructions for details.")
        sys.exit(1)
    
    # Build field IDs dict
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
    
    # Parse input file (reuse Phase 1 parsing logic)
    if args.csv:
        from create_phase1_issues import parse_csv
        issues = parse_csv(args.csv)
    elif args.yaml:
        from create_phase1_issues import parse_yaml
        issues = parse_yaml(args.yaml)
    else:
        print("Error: Must provide either --csv or --yaml")
        sys.exit(1)
    
    if args.dry_run:
        print(f"Dry run: Would create {len(issues)} Phase 5 issues")
        for issue in issues[:5]:
            print(f"  - {issue['title']}")
        if len(issues) > 5:
            print(f"  ... and {len(issues) - 5} more")
        return
    
    # Initialize automation (reuse Phase 1 class)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(os.path.dirname(script_dir))
    codeowners_path = os.path.join(repo_root, "CODEOWNERS")
    
    automation = GitHubProjectAutomation(token, owner, repo, project_id, field_ids, codeowners_path)
    
    # Process issues
    print(f"Creating {len(issues)} Phase 5 issues...")
    success_count = 0
    failed_count = 0
    
    for i, issue in enumerate(issues, 1):
        print(f"[{i}/{len(issues)}] Processing: {issue['title'][:60]}...")
        if automation.process_issue(
            issue["title"],
            issue["labels"],
            issue["milestone"],
            issue["sprint"],
            issue.get("chain"),
            issue.get("preset"),
        ):
            success_count += 1
        else:
            failed_count += 1
    
    print(f"\n✓ Successfully created {success_count}/{len(issues)} Phase 5 issues")
    if failed_count > 0:
        print(f"✗ Failed to create {failed_count} issues")


if __name__ == "__main__":
    main()

