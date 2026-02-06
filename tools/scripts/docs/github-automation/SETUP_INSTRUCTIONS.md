# Quick Setup Instructions for Phase 1 Issues Automation

## Issue 1: GitHub Token Scopes

Your current GitHub token is missing the required project scopes. You need to:

1. **Go to GitHub Token Settings**: https://github.com/settings/tokens?type=beta
2. **Find your token** (or create a new fine-grained token)
3. **Add these scopes**:
   - **Account permissions**: `Projects: Read and write`
   - **Repository permissions**: `Issues: Read and write`
4. **Save the token**

## Issue 2: Environment Variables

You need to set these environment variables before running the script:

```bash
export GITHUB_TOKEN="ghp_your_token_here"
export GITHUB_OWNER="hyperkit-labs"
export GITHUB_REPO="Hyperkit_agent"  # or your actual repo name
export PROJECT_ID="PVT_kwDO..."      # Get this from fetch_project_ids.sh
export SPRINT_FIELD_ID="..."          # Get this from fetch_project_ids.sh
export TYPE_FIELD_ID="..."            # Get this from fetch_project_ids.sh
export AREA_FIELD_ID="..."            # Get this from fetch_project_ids.sh
export CHAIN_FIELD_ID="..."           # Optional
export PRESET_FIELD_ID="..."          # Optional
```

## Step-by-Step Setup

### Step 1: Update GitHub Token Scopes

1. Visit: https://github.com/settings/tokens?type=beta
2. Click on your existing token (or create new one)
3. Under **Account permissions**, enable:
   - ✅ **Projects: Read and write**
4. Under **Repository permissions**, ensure:
   - ✅ **Issues: Read and write**
5. Click **Update token** or **Generate token**
6. Copy the new token

### Step 2: Create Custom Fields in Project 9

The project needs custom fields. Run these commands:

```bash
# From scripts/github directory
cd scripts/github

# Sprint field
gh project field-create 9 --owner hyperkit-labs --name "Sprint" --data-type SINGLE_SELECT --single-select-options "Sprint 1,Sprint 2,Sprint 3"

# Type field
gh project field-create 9 --owner hyperkit-labs --name "Type" --data-type SINGLE_SELECT --single-select-options "Epic,Feature,Chore,Bug"

# Area field
gh project field-create 9 --owner hyperkit-labs --name "Area" --data-type SINGLE_SELECT --single-select-options "Orchestration,Agents,Frontend,Infra,SDK-CLI,Storage-RAG,Chain-Adapter,Security,Observability,Contracts,Docs"

# Chain field (optional)
gh project field-create 9 --owner hyperkit-labs --name "Chain" --data-type SINGLE_SELECT --single-select-options "Protocol Labs,SKALE,BNB,Avalanche"

# Preset field (optional)
gh project field-create 9 --owner hyperkit-labs --name "Preset" --data-type SINGLE_SELECT --single-select-options "verifiable-factory,skale-commerce,bnb-infra,avax-infra"
```

### Step 3: Fetch Project and Field IDs

```bash
# This will show you all the IDs you need
cd scripts/github
./fetch_project_ids.sh org hyperkit-labs
```

Copy the export commands from the output.

### Step 4: Set Environment Variables

Create a `.env` file or export them:

```bash
# Option 1: Create .env file
cat > .env << EOF
GITHUB_TOKEN=ghp_your_token_here
GITHUB_OWNER=hyperkit-labs
GITHUB_REPO=Hyperkit_agent
PROJECT_ID=PVT_kwDO...
SPRINT_FIELD_ID=...
TYPE_FIELD_ID=...
AREA_FIELD_ID=...
CHAIN_FIELD_ID=...
PRESET_FIELD_ID=...
EOF

# Option 2: Export directly
export GITHUB_TOKEN="ghp_your_token_here"
export GITHUB_OWNER="hyperkit-labs"
export GITHUB_REPO="Hyperkit_agent"
# ... (add other exports from fetch_project_ids.sh output)
```

### Step 5: Create Milestones

```bash
export REPO="hyperkit-labs/Hyperkit_agent"  # Adjust repo name if needed

gh api repos/$REPO/milestones \
  -X POST \
  -f title="Phase 1 – Sprint 1 (Feb 5–17)" \
  -f description="Foundation Sprint 1"

gh api repos/$REPO/milestones \
  -X POST \
  -f title="Phase 1 – Sprint 2 (Feb 18–Mar 2)" \
  -f description="Foundation Sprint 2"

gh api repos/$REPO/milestones \
  -X POST \
  -f title="Phase 1 – Sprint 3 (Mar 3–16)" \
  -f description="Foundation Sprint 3"
```

### Step 6: Test with Dry Run

```bash
# Load environment variables if using .env
source .env  # or: set -a; source .env; set +a

# Test first
python create_phase1_issues.py --csv ../data/issues.csv --dry-run
```

### Step 7: Create Issues

```bash
# If dry-run looks good, create the issues
python create_phase1_issues.py --csv ../data/issues.csv
```

## Troubleshooting

### "Token has not been granted the required scopes"
- Go to https://github.com/settings/tokens?type=beta
- Edit your token and add `Projects: Read and write` scope
- Save and use the new token

### "python3: command not found"
- On Windows, use `python` instead of `python3`
- Or install Python 3 and ensure it's in PATH

### "Missing required environment variables"
- Make sure you've exported all variables or loaded them from `.env`
- Run `cd scripts/github && ./fetch_project_ids.sh` to get the IDs

### "Milestone not found"
- Create milestones first (Step 5)
- Ensure milestone titles match exactly (including em dashes)

## Quick Reference

```bash
# 1. Update token scopes at: https://github.com/settings/tokens?type=beta
# 2. Create custom fields (see Step 2 above)
# 3. Get IDs
cd scripts/github
./fetch_project_ids.sh org hyperkit-labs

# 4. Set environment variables (copy from step 3 output)
export GITHUB_TOKEN="..."
export GITHUB_OWNER="hyperkit-labs"
# ... etc

# 5. Create milestones
gh api repos/hyperkit-labs/Hyperkit_agent/milestones -X POST -f title="Phase 1 – Sprint 1 (Feb 5–17)" -f description="Sprint 1"
# ... (repeat for Sprint 2 and 3)

# 6. Test
python create_phase1_issues.py --csv ../data/issues.csv --dry-run

# 7. Create
python create_phase1_issues.py --csv ../data/issues.csv
```

