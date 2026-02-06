# Delete All GitHub Issues

This script deletes or closes all GitHub issues from a repository to clear history before creating new issues.

## Important Notes

⚠️ **WARNING**: This action cannot be undone for deleted issues!

- **With Admin Access**: Issues will be permanently deleted via GraphQL API
- **Without Admin Access**: Issues will be closed and locked (they remain in the repository but are hidden)

## Setup

1. **Set Environment Variables** (same as create script):
   ```bash
   export GITHUB_TOKEN="your-fine-grained-pat"
   export GITHUB_OWNER="hyperkit-labs"  # or your org/username
   export GITHUB_REPO="hyperagent"      # or your repo name
   ```

   Or load from `.env` file:
   ```bash
   source .env
   ```

2. **Required Permissions**:
   - Repository: Read and write access
   - For true deletion: Admin access to the repository

## Usage

### Dry Run (Safe Preview)

Preview what would be deleted without actually doing it:

```bash
cd scripts/github && python delete_all_issues.py --dry-run
```

This will:
- List all issues
- Show how many would be deleted
- Not make any changes

### Delete All Issues

Delete all issues (requires confirmation):

```bash
cd scripts/github && python delete_all_issues.py
```

You'll be prompted to type `DELETE` to confirm.

### Delete by State

Delete only open or closed issues:

```bash
# Delete only open issues
cd scripts/github && python delete_all_issues.py --state open

# Delete only closed issues
cd scripts/github && python delete_all_issues.py --state closed

# Delete all issues (default)
cd scripts/github && python delete_all_issues.py --state all
```

## How It Works

1. **Lists all issues** from the repository (paginated)
2. **Filters out pull requests** (only processes actual issues)
3. **Attempts GraphQL deletion** (requires admin access)
4. **Falls back to close+lock** if deletion not possible
5. **Rate limits** requests (1 second between issues)

## Example Output

```
Fetching all issues from hyperkit-labs/hyperagent...
  Fetched 57 issues so far...

Found 57 issues to delete:
  #1: Epic: Core Orchestration & Data Model (open)
  #2: Design Supabase schema for workspaces (open)
  #3: Implement FastAPI API gateway skeleton (open)
  ... and 54 more

⚠️  WARNING: This will delete/close 57 issues!
Note: If you have admin access, issues will be permanently deleted.
      Otherwise, issues will be closed and locked.
Type 'DELETE' to confirm: DELETE

Deleting/closing 57 issues...
[1/57] Processing issue #1: Epic: Core Orchestration & Data Model... ✓ (deleted)
[2/57] Processing issue #2: Design Supabase schema for workspaces... ✓ (deleted)
...

✓ Successfully processed 57/57 issues
  - 57 permanently deleted
```

## Troubleshooting

### "Failed to delete issue"
- Check if you have admin access to the repository
- Verify your token has the correct permissions
- Issues will be closed and locked as fallback

### "Rate limit exceeded"
- The script includes rate limiting (1 second between requests)
- If you have many issues, it may take time
- GitHub allows 5,000 requests/hour for authenticated requests

### "Issue not found"
- The issue may have already been deleted
- Check the issue number manually

## After Deletion

Once issues are deleted/closed:

1. **Verify deletion**: Check the repository issues page
2. **Create new issues**: Run the create script:
   ```bash
   cd scripts/github && python create_phase1_issues.py --csv ../data/issues.csv
   ```

## Safety Features

- **Dry run mode**: Preview before deleting
- **Confirmation prompt**: Requires typing "DELETE"
- **State filtering**: Can target specific issue states
- **Rate limiting**: Prevents API abuse
- **Error handling**: Continues on individual failures

