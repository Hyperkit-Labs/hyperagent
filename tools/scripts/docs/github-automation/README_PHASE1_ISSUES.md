# GitHub Issues Automation for HyperAgent Phase 1

This automation creates GitHub issues from CSV/YAML data and links them to GitHub Project 9 with proper labels, milestones, and custom fields.

## Quick Start

1. **Follow the setup instructions below** to get your tokens and IDs
2. **Set environment variables**
3. **Run the script**: `cd scripts/github && python create_phase1_issues.py --csv ../data/issues.csv`

## Detailed Setup Instructions

### Step 1: Generate Fine-Grained Personal Access Token (PAT)

1. Go to: https://github.com/settings/tokens?type=beta
2. Click **"Generate new token"** → **"Generate new token (fine-grained)"**
3. Configure the token:
   - **Token name**: `HyperAgent Phase 1 Automation`
   - **Expiration**: 90 days (recommended for automation)
   - **Repository access**: Select your repository or organization
   - **Repository permissions**:
     * Issues: **Read and write**
     * Metadata: **Read-only** (automatically selected)
   - **Account permissions**:
     * Projects: **Read and write**
4. Click **"Generate token"**
5. **Copy the token immediately** (you won't see it again) and save it securely

### Step 2: Find Project ID for Project 9

Run this command to get the Project ID:

**For Organization Projects:**
```bash
gh api graphql -f query='
  query {
    organization(login: "YOUR_ORG_NAME") {
      projectsV2(first: 20) {
        nodes {
          number
          id
          title
        }
      }
    }
  }
' | jq '.data.organization.projectsV2.nodes[] | select(.number == 9)'
```

**For User Projects:**
```bash
gh api graphql -f query='
  query {
    user(login: "YOUR_USERNAME") {
      projectsV2(first: 20) {
        nodes {
          number
          id
          title
        }
      }
    }
  }
' | jq '.data.user.projectsV2.nodes[] | select(.number == 9)'
```

**Or use the helper script:**
```bash
cd scripts/github && ./fetch_project_ids.sh org YOUR_ORG_NAME
```

Save the `id` value (it looks like: `PVT_kwDO...`)

### Step 3: Fetch Project Field IDs

Run this to get all field IDs:

**For Organization Projects:**
```bash
gh api graphql -f query='
  query {
    organization(login: "YOUR_ORG_NAME") {
      projectsV2(first: 20) {
        nodes {
          number
          id
          fields(first: 50) {
            nodes {
              id
              name
              ... on ProjectV2SingleSelectField {
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  }
' | jq '.data.organization.projectsV2.nodes[] | select(.number == 9) | .fields.nodes[] | {id, name}'
```

**For User Projects:**
```bash
gh api graphql -f query='
  query {
    user(login: "YOUR_USERNAME") {
      projectsV2(first: 20) {
        nodes {
          number
          id
          fields(first: 50) {
            nodes {
              id
              name
              ... on ProjectV2SingleSelectField {
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  }
' | jq '.data.user.projectsV2.nodes[] | select(.number == 9) | .fields.nodes[] | {id, name}'
```

**Or use the helper script (recommended):**
```bash
cd scripts/github && ./fetch_project_ids.sh org YOUR_ORG_NAME
```

Look for fields named:
- **Sprint** - Save the field ID
- **Type** - Save the field ID  
- **Area** - Save the field ID
- **Chain** - Save the field ID (if exists)
- **Preset** - Save the field ID (if exists)

**Note**: For single-select fields, you'll also need the option IDs. The script will try to match by name, but you may need to update the script if option IDs are required.

### Step 4: Create Milestones (if they don't exist)

```bash
# Set your repo
export REPO="YOUR_ORG/YOUR_REPO"

# Create Sprint 1 milestone
gh api repos/$REPO/milestones \
  -X POST \
  -f title="Phase 1 – Sprint 1 (Feb 5–17)" \
  -f description="Foundation Sprint 1: Core orchestration, agents, and Protocol Labs/SKALE presets"

# Create Sprint 2 milestone
gh api repos/$REPO/milestones \
  -X POST \
  -f title="Phase 1 – Sprint 2 (Feb 18–Mar 2)" \
  -f description="Foundation Sprint 2: BNB/Avalanche adapters, SDK/CLI v0.1, observability"

# Create Sprint 3 milestone
gh api repos/$REPO/milestones \
  -X POST \
  -f title="Phase 1 – Sprint 3 (Mar 3–16)" \
  -f description="Foundation Sprint 3: Multi-tenant workspaces, template library, CI/CD"
```

### Step 5: Set Environment Variables

Create a `.env` file or export these variables:

```bash
export GITHUB_TOKEN="ghp_your_token_here"
export GITHUB_OWNER="your_org_or_username"
export GITHUB_REPO="your_repo_name"
export PROJECT_ID="PVT_kwDO..."  # From Step 2
export SPRINT_FIELD_ID="..."     # From Step 3
export TYPE_FIELD_ID="..."       # From Step 3
export AREA_FIELD_ID="..."       # From Step 3
export CHAIN_FIELD_ID="..."      # From Step 3 (optional)
export PRESET_FIELD_ID="..."     # From Step 3 (optional)
```

Or create a `.env` file:
```bash
GITHUB_TOKEN=ghp_your_token_here
GITHUB_OWNER=your_org_or_username
GITHUB_REPO=your_repo_name
PROJECT_ID=PVT_kwDO...
SPRINT_FIELD_ID=...
TYPE_FIELD_ID=...
AREA_FIELD_ID=...
CHAIN_FIELD_ID=...
PRESET_FIELD_ID=...
```

Then load it:
```bash
source .env  # or: set -a; source .env; set +a
```

### Step 6: Install Dependencies

```bash
pip install requests pyyaml
```

### Step 7: Run the Script

**Dry run (validate without creating):**
```bash
python create_phase1_issues.py --csv ../data/issues.csv --dry-run
```

**Create issues:**
```bash
python create_phase1_issues.py --csv ../data/issues.csv
```

**Or with YAML:**
```bash
python create_phase1_issues.py --yaml ../data/issues.yaml
```

## What the Script Does

1. **Reads the CSV/YAML file** with issue data
2. **Creates GitHub issues** via REST API with:
   - Title
   - Labels (parsed from CSV)
   - Milestone (linked by title)
   - Auto-generated body based on issue type
3. **Adds each issue to Project 9** via GraphQL API
4. **Sets custom fields**:
   - Sprint (from CSV)
   - Type (extracted from labels)
   - Area (extracted from labels)
   - Chain (extracted from labels, if present)
   - Preset (extracted from labels, if present)

## Troubleshooting

### "Milestone not found"
- Ensure milestones are created (Step 4)
- Check milestone titles match exactly (including em dashes)

### "Failed to add issue to project"
- Verify PROJECT_ID is correct
- Check token has "Projects: Read and write" permission
- Ensure project number 9 exists

### "Field update failed"
- Verify field IDs are correct
- For single-select fields, ensure the option exists in the project
- Check field names match exactly (case-sensitive)

### Rate Limiting
The script includes a 1-second delay between issues. If you hit rate limits:
- GitHub allows 5,000 requests/hour for authenticated requests
- The script processes ~60 issues/minute
- For large batches, consider running in smaller chunks

## Field Option IDs (Advanced)

If single-select fields require specific option IDs instead of names, you'll need to:

1. Get option IDs from the field query in Step 3
2. Update the script's `update_project_field` method to use option IDs
3. Create a mapping of option names to IDs

## Alternative: Using `gh` CLI Directly

For simpler workflows, you can use `gh` CLI commands:

```bash
# Create an issue
gh issue create \
  --title "Epic: Core Orchestration & Data Model" \
  --label "type:epic,area:orchestration,phase:foundation" \
  --milestone "Phase 1 – Sprint 1 (Feb 5–17)"

# Add to project
gh project item-add 9 --owner "@me" --url https://github.com/OWNER/REPO/issues/123

# Update field (requires item ID and field ID)
gh project item-edit \
  --id ITEM_ID \
  --project-id PROJECT_ID \
  --field-id SPRINT_FIELD_ID \
  --single-select-option-id OPTION_ID
```

However, the Python script automates this for all issues at once.

## Next Steps

After creating issues:
1. Review issues in GitHub to ensure they're correctly configured
2. Verify project board shows all issues with correct fields
3. Assign issues to team members as needed
4. Update issue bodies with detailed acceptance criteria

