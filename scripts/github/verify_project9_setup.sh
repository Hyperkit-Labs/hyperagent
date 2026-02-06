#!/bin/bash
# Verification script for GitHub Project 9 setup
# Verifies Project 9 exists, custom fields exist, and milestones are created
#
# Usage: ./scripts/github/verify_project9_setup.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Verifying GitHub Project 9 Setup...${NC}"
echo ""

# Check if .env.issue exists
if [ ! -f ".env.issue" ]; then
    echo -e "${YELLOW}Warning: .env.issue not found${NC}"
    echo "Create it from .env.issue.example and fill in your values"
    echo ""
fi

# Load environment variables if .env.issue exists
if [ -f ".env.issue" ]; then
    set -a
    source .env.issue
    set +a
fi

# Check required environment variables
REQUIRED_VARS=("GITHUB_TOKEN" "GITHUB_OWNER" "GITHUB_REPO" "PROJECT_ID")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}Error: Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Set these in .env.issue or export them in your shell"
    exit 1
fi

# Check optional but recommended field IDs
RECOMMENDED_VARS=("SPRINT_FIELD_ID" "TYPE_FIELD_ID" "AREA_FIELD_ID")
MISSING_RECOMMENDED=()

for var in "${RECOMMENDED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        MISSING_RECOMMENDED+=("$var")
    fi
done

if [ ${#MISSING_RECOMMENDED[@]} -gt 0 ]; then
    echo -e "${YELLOW}Warning: Missing recommended field IDs:${NC}"
    for var in "${MISSING_RECOMMENDED[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "These are required for issue creation. Run ./scripts/github/fetch_project_ids.sh to get them."
    echo ""
fi

# Verify gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
    echo "Install from: https://cli.github.com/"
    exit 1
fi

# Verify gh is authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI is not authenticated${NC}"
    echo "Run: gh auth login"
    exit 1
fi

echo -e "${GREEN}✓ GitHub CLI installed and authenticated${NC}"

# Verify Project 9 exists
echo ""
echo -e "${BLUE}Verifying Project 9...${NC}"

# Check if jq is available
if command -v jq &> /dev/null; then
    USE_JQ=true
else
    USE_JQ=false
    echo -e "${YELLOW}⚠ jq not found, using basic verification${NC}"
fi

PROJECT_INFO=$(gh project view 9 --owner "${GITHUB_OWNER}" --format json 2>/dev/null || echo "")

if [ -z "$PROJECT_INFO" ]; then
    echo -e "${RED}✗ Project 9 not found or not accessible${NC}"
    echo "Verify the project exists and you have access"
    exit 1
fi

if [ "$USE_JQ" = true ]; then
    PROJECT_TITLE=$(echo "$PROJECT_INFO" | jq -r '.title // "Unknown"')
else
    PROJECT_TITLE=$(echo "$PROJECT_INFO" | grep -o '"title":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "Unknown")
fi
echo -e "${GREEN}✓ Project 9 found: $PROJECT_TITLE${NC}"

# Verify custom fields
echo ""
echo -e "${BLUE}Verifying custom fields...${NC}"
FIELDS=$(gh project field-list 9 --owner "${GITHUB_OWNER}" --format json 2>/dev/null || echo "[]")

REQUIRED_FIELDS=("Sprint" "Type" "Area")
# Note: GitHub Projects may use "Issue Type" instead of "Type"
REQUIRED_FIELDS_ALT=("Issue Type")
OPTIONAL_FIELDS=("Chain" "Preset")

if [ "$USE_JQ" = true ]; then
    FIELD_NAMES=$(echo "$FIELDS" | jq -r '.[].name // empty')
else
    # Extract field names using grep/sed as fallback
    FIELD_NAMES=$(echo "$FIELDS" | grep -o '"name":"[^"]*"' | sed 's/"name":"\([^"]*\)"/\1/' || echo "")
fi

for field in "${REQUIRED_FIELDS[@]}"; do
    if echo "$FIELD_NAMES" | grep -qi "^${field}$"; then
        echo -e "${GREEN}✓ Field '$field' exists${NC}"
        
        # Verify field ID if provided in environment
        FIELD_ID_VAR=$(echo "$field" | tr '[:lower:]' '[:upper:]' | tr '-' '_')_FIELD_ID
        if [ -n "${!FIELD_ID_VAR:-}" ]; then
            # Try to extract field ID from FIELDS JSON
            if [ "$USE_JQ" = true ]; then
                ACTUAL_FIELD_ID=$(echo "$FIELDS" | jq -r ".[] | select(.name == \"$field\") | .id // empty")
            else
                # Extract field ID using grep/sed
                ACTUAL_FIELD_ID=$(echo "$FIELDS" | grep -A 5 "\"name\":\"$field\"" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
            fi
            
            if [ -n "$ACTUAL_FIELD_ID" ] && [ "$ACTUAL_FIELD_ID" = "${!FIELD_ID_VAR}" ]; then
                echo -e "${GREEN}  ✓ Field ID matches environment variable${NC}"
            elif [ -n "$ACTUAL_FIELD_ID" ]; then
                echo -e "${YELLOW}  ⚠ Field ID mismatch: env has '${!FIELD_ID_VAR}', project has '$ACTUAL_FIELD_ID'${NC}"
                echo "     Update .env.issue with: ${FIELD_ID_VAR}=$ACTUAL_FIELD_ID"
            else
                echo -e "${YELLOW}  ⚠ Could not verify field ID (field exists but ID not found)${NC}"
            fi
        else
            echo -e "${YELLOW}  ⚠ ${FIELD_ID_VAR} not set in environment${NC}"
            echo "     Run ./scripts/github/fetch_project_ids.sh to get the field ID"
        fi
    else
        echo -e "${RED}✗ Field '$field' not found${NC}"
        echo "  Create it with: gh project field-create 9 --owner ${GITHUB_OWNER} --name \"$field\" --data-type SINGLE_SELECT"
        
        # Show what field ID variable should be set
        FIELD_ID_VAR=$(echo "$field" | tr '[:lower:]' '[:upper:]' | tr '-' '_')_FIELD_ID
        echo "  After creating, set ${FIELD_ID_VAR} in .env.issue"
    fi
done

for field in "${OPTIONAL_FIELDS[@]}"; do
    if echo "$FIELD_NAMES" | grep -qi "^${field}$"; then
        echo -e "${GREEN}✓ Field '$field' exists (optional)${NC}"
    else
        echo -e "${YELLOW}⚠ Field '$field' not found (optional)${NC}"
    fi
done

# Verify milestones
echo ""
echo -e "${BLUE}Verifying milestones...${NC}"

if [ "$USE_JQ" = true ]; then
    MILESTONES=$(gh api repos/${GITHUB_OWNER}/${GITHUB_REPO}/milestones --jq '.[] | select(.state == "open") | .title' 2>/dev/null || echo "")
else
    # Fallback: get milestones and extract titles manually
    MILESTONES_JSON=$(gh api repos/${GITHUB_OWNER}/${GITHUB_REPO}/milestones 2>/dev/null || echo "[]")
    MILESTONES=$(echo "$MILESTONES_JSON" | grep -o '"title":"[^"]*"' | sed 's/"title":"\([^"]*\)"/\1/' | grep -v "^$" || echo "")
fi

REQUIRED_MILESTONES=(
    "Phase 1 – Sprint 1 (Feb 5–17)"
    "Phase 1 – Sprint 2 (Feb 18–Mar 2)"
    "Phase 1 – Sprint 3 (Mar 3–16)"
)

for milestone in "${REQUIRED_MILESTONES[@]}"; do
    if echo "$MILESTONES" | grep -qF "$milestone"; then
        echo -e "${GREEN}✓ Milestone '$milestone' exists${NC}"
    else
        echo -e "${RED}✗ Milestone '$milestone' not found${NC}"
        MILESTONE_TITLE=$(echo "$milestone" | cut -d' ' -f1-4)
        MILESTONE_DESC=$(echo "$milestone" | cut -d'(' -f2 | cut -d')' -f1)
        echo "  Create it with: gh api repos/${GITHUB_OWNER}/${GITHUB_REPO}/milestones -X POST -f title=\"$milestone\" -f description=\"Foundation $MILESTONE_TITLE\""
    fi
done

# Verify CSV file
echo ""
echo -e "${BLUE}Verifying issues CSV...${NC}"
CSV_PATH="${ISSUES_CSV_PATH:-scripts/data/issues.csv}"

if [ ! -f "$CSV_PATH" ]; then
    echo -e "${RED}✗ CSV file not found: $CSV_PATH${NC}"
    exit 1
fi

ISSUE_COUNT=$(tail -n +2 "$CSV_PATH" | grep -v '^$' | wc -l | tr -d ' ')
echo -e "${GREEN}✓ CSV file found: $CSV_PATH${NC}"
echo -e "${GREEN}✓ Total issues in CSV: $ISSUE_COUNT${NC}"

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Verification Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Project 9: Accessible${NC}"
echo -e "${GREEN}✓ CSV File: $ISSUE_COUNT issues${NC}"

# Check if all required field IDs are set
ALL_FIELD_IDS_SET=true
for var in "${RECOMMENDED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        ALL_FIELD_IDS_SET=false
        break
    fi
done

if [ "$ALL_FIELD_IDS_SET" = true ]; then
    echo -e "${GREEN}✓ All field IDs configured${NC}"
else
    echo -e "${YELLOW}⚠ Some field IDs missing (required for issue creation)${NC}"
fi

echo ""
echo -e "${YELLOW}Next steps:${NC}"
if [ "$ALL_FIELD_IDS_SET" != true ]; then
    echo "1. Run ./scripts/github/fetch_project_ids.sh org ${GITHUB_OWNER} to get field IDs"
    echo "2. Update .env.issue with the field IDs"
    echo "3. Ensure all custom fields exist (create missing ones)"
    echo "4. Ensure all milestones exist (create missing ones)"
    echo "5. Run dry-run test: python scripts/github/create_phase1_issues.py --csv $CSV_PATH --dry-run"
    echo "6. If dry-run passes, run: python scripts/github/create_phase1_issues.py --csv $CSV_PATH"
else
    echo "1. Ensure all custom fields exist (create missing ones)"
    echo "2. Ensure all milestones exist (create missing ones)"
    echo "3. Run dry-run test: python scripts/github/create_phase1_issues.py --csv $CSV_PATH --dry-run"
    echo "4. If dry-run passes, run: python scripts/github/create_phase1_issues.py --csv $CSV_PATH"
fi

