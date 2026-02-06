# GitHub Automation Scripts

Scripts for automating GitHub issue creation, project management, and related tasks.

## Scripts

### create_phase1_issues.py

Creates GitHub issues for Phase 1 roadmap and links them to GitHub Project 9.

**Usage:**
```bash
# Dry run
python create_phase1_issues.py --csv ../data/issues.csv --dry-run

# Create issues
python create_phase1_issues.py --csv ../data/issues.csv
```

**Features:**
- Reads issues from CSV
- Creates issues with detailed templates
- Assigns owners based on CODEOWNERS
- Links to GitHub Project 9
- Sets custom fields (Sprint, Type, Area, Chain, Preset)
- Includes code examples in issue bodies

**Documentation:**
- Setup: [../docs/github-automation/SETUP_INSTRUCTIONS.md](../docs/github-automation/SETUP_INSTRUCTIONS.md)
- Issue Template: [../docs/github-automation/ISSUE_TEMPLATE_UPDATE.md](../docs/github-automation/ISSUE_TEMPLATE_UPDATE.md)
- Code Examples: [../docs/github-automation/CODE_EXAMPLES_UPDATE.md](../docs/github-automation/CODE_EXAMPLES_UPDATE.md)

### delete_all_issues.py

Deletes or closes all issues in a repository.

**Usage:**
```bash
# Dry run
python delete_all_issues.py --dry-run

# Delete all issues
python delete_all_issues.py

# Delete only open issues
python delete_all_issues.py --state open
```

**Documentation:**
- [../docs/utilities/DELETE_ISSUES_README.md](../docs/utilities/DELETE_ISSUES_README.md)

### fetch_project_ids.sh

Fetches GitHub Project 9 ID and custom field IDs.

**Usage:**
```bash
# For organization
./fetch_project_ids.sh org hyperkit-labs

# For user
./fetch_project_ids.sh user myusername
```

**Output:**
- Project ID
- Field IDs (Sprint, Type, Area, Chain, Preset)
- Commands to create missing fields

## Setup

1. **Set environment variables:**
   ```bash
   export GITHUB_TOKEN="ghp_your_token"
   export GITHUB_OWNER="hyperkit-labs"
   export GITHUB_REPO="Hyperkit_agent"
   ```

2. **Get Project IDs:**
   ```bash
   ./fetch_project_ids.sh org hyperkit-labs
   ```

3. **Export field IDs:**
   ```bash
   export PROJECT_ID="PVT_kwDO..."
   export SPRINT_FIELD_ID="..."
   # ... etc
   ```

See [../docs/github-automation/SETUP_INSTRUCTIONS.md](../docs/github-automation/SETUP_INSTRUCTIONS.md) for detailed setup.

## Documentation

All documentation is in [../docs/github-automation/](../docs/github-automation/):
- Setup instructions
- Issue assignment logic
- Sprint assignment strategy
- Issue template details
- Code examples integration

## Compliance

All scripts follow AGENT.mdc patterns:
- Check `.cursor/skills/` before implementation
- Use logging instead of print statements
- Handle errors gracefully
- Follow GitHub automation best practices

See [../docs/compliance/AGENT_MDC_COMPLIANCE.md](../docs/compliance/AGENT_MDC_COMPLIANCE.md) for details.

