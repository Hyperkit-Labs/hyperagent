#!/bin/bash
# Helper script to fetch GitHub Project 9 IDs and field IDs
# Follows patterns from .cursor/skills/github-projects/
#
# Usage: ./scripts/fetch_project_ids.sh [org|user] [ORG_NAME_OR_USERNAME]
#
# Examples:
#   ./scripts/fetch_project_ids.sh org hyperkit-labs
#   ./scripts/fetch_project_ids.sh user myusername

set -euo pipefail  # Exit on error, undefined vars, pipe failures

TYPE="${1:-org}"
OWNER="${2}"

if [ -z "${OWNER:-}" ]; then
    echo "Error: Missing OWNER_NAME argument" >&2
    echo "Usage: $0 [org|user] OWNER_NAME" >&2
    echo "Example: $0 org hyperkit-labs" >&2
    echo "Example: $0 user myusername" >&2
    exit 1
fi

# Verify gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is not installed" >&2
    echo "Install from: https://cli.github.com/" >&2
    exit 1
fi

# Verify gh is authenticated
if ! gh auth status &> /dev/null; then
    echo "Error: GitHub CLI is not authenticated" >&2
    echo "Run: gh auth login" >&2
    exit 1
fi

echo "Fetching Project 9 information for $TYPE: $OWNER..."
echo ""

# Query based on type - projectsV2 is a connection, so we query and filter
# First, get the project ID
if [ "$TYPE" = "org" ]; then
    QUERY='query {
      organization(login: "'"$OWNER"'") {
        projectsV2(first: 20) {
          nodes {
            number
            id
            title
          }
        }
      }
    }'
else
    QUERY='query {
      user(login: "'"$OWNER"'") {
        projectsV2(first: 20) {
          nodes {
            number
            id
            title
          }
        }
      }
    }'
fi

# Execute query to get project
RESPONSE=$(gh api graphql -f query="$QUERY")

# Extract project with number 9
if [ "$TYPE" = "org" ]; then
    PROJECT_DATA=$(echo "$RESPONSE" | jq '.data.organization.projectsV2.nodes[] | select(.number == 9)')
else
    PROJECT_DATA=$(echo "$RESPONSE" | jq '.data.user.projectsV2.nodes[] | select(.number == 9)')
fi

if [ -z "${PROJECT_DATA:-}" ] || [ "$PROJECT_DATA" = "null" ] || [ "$PROJECT_DATA" = "" ]; then
    echo "Error: Project 9 not found or access denied" >&2
    echo "" >&2
    echo "Available projects:" >&2
    if [ "$TYPE" = "org" ]; then
        echo "$RESPONSE" | jq -r '.data.organization.projectsV2.nodes[] | "   #\(.number): \(.title)"' >&2
    else
        echo "$RESPONSE" | jq -r '.data.user.projectsV2.nodes[] | "   #\(.number): \(.title)"' >&2
    fi
    exit 1
fi

PROJECT_ID=$(echo "$PROJECT_DATA" | jq -r '.id')
PROJECT_TITLE=$(echo "$PROJECT_DATA" | jq -r '.title')

# Use gh project CLI to get fields (simpler and handles union types automatically)
echo "Fetching project fields..."
FIELDS_JSON=$(gh project field-list 9 --owner "$OWNER" --format json 2>/dev/null || echo '{"fields":[]}')

# Parse gh CLI output - it returns {"fields": [...]}
if [ "$(echo "$FIELDS_JSON" | jq 'has("fields")')" = "true" ]; then
    FIELDS=$(echo "$FIELDS_JSON" | jq '.fields')
elif [ "$(echo "$FIELDS_JSON" | jq 'type')" = "array" ]; then
    FIELDS="$FIELDS_JSON"
else
    echo "⚠️  Warning: Could not parse fields, trying GraphQL..."
    # Fallback to GraphQL with simplified query
    FIELDS_QUERY='query {
      node(id: "'"$PROJECT_ID"'") {
        ... on ProjectV2 {
          fields(first: 50) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }'
    FIELDS_RESPONSE=$(gh api graphql -f query="$FIELDS_QUERY" 2>/dev/null || echo '{"data":{"node":null}}')
    FIELDS=$(echo "$FIELDS_RESPONSE" | jq '.data.node.fields.nodes // []')
fi

if [ -z "${PROJECT_ID:-}" ] || [ "$PROJECT_ID" = "null" ]; then
    echo "Error: Could not extract Project ID" >&2
    echo "Response: $RESPONSE" >&2
    exit 1
fi

echo "Project Found:"
echo "   Title: $PROJECT_TITLE"
echo "   ID: $PROJECT_ID"
echo ""
echo "Export this to your environment:"
echo "   export PROJECT_ID=\"$PROJECT_ID\""
echo ""
# Parse fields from gh CLI output
if [ "$(echo "$FIELDS_JSON" | jq 'type')" = "object" ] && [ "$(echo "$FIELDS_JSON" | jq 'has("fields")')" = "true" ]; then
    FIELDS=$(echo "$FIELDS_JSON" | jq '.fields')
elif [ "$(echo "$FIELDS_JSON" | jq 'type')" = "array" ]; then
    FIELDS="$FIELDS_JSON"
else
    FIELDS="[]"
fi

echo "Fields:"
echo "$FIELDS" | jq -r '.[] | "   \(.name): \(.id)"'

echo ""
echo "Required Custom Fields:"
REQUIRED_FIELDS=("Sprint" "Type" "Area" "Chain" "Preset")
MISSING_FIELDS=()

for field_name in "${REQUIRED_FIELDS[@]}"; do
    FIELD_DATA=$(echo "$FIELDS" | jq -r ".[] | select(.name == \"$field_name\")")
    FIELD_ID=$(echo "$FIELD_DATA" | jq -r '.id // empty')
    if [ -n "${FIELD_ID:-}" ] && [ "$FIELD_ID" != "null" ] && [ "$FIELD_ID" != "" ]; then
        FIELD_TYPE=$(echo "$FIELD_DATA" | jq -r '.type // "unknown"')
        echo "   [OK] $field_name: $FIELD_ID ($FIELD_TYPE)"
        ENV_VAR=$(echo "$field_name" | tr '[:lower:]' '[:upper:]' | tr '-' '_')
        echo "      export ${ENV_VAR}_FIELD_ID=\"$FIELD_ID\""
    else
        echo "   [MISSING] $field_name: NOT FOUND"
        MISSING_FIELDS+=("$field_name")
    fi
done

echo ""
if [ ${#MISSING_FIELDS[@]} -gt 0 ]; then
    echo "WARNING: Missing custom fields detected!" >&2
    echo "" >&2
    echo "You need to create these fields in Project 9 first:" >&2
    for field in "${MISSING_FIELDS[@]}"; do
        echo "   - $field" >&2
    done
    echo "" >&2
    echo "Create them using these commands (following .cursor/skills/github-projects/ patterns):" >&2
    echo "" >&2
    echo "   # Sprint field (required)"
    echo "   gh project field-create 9 --owner $OWNER --name \"Sprint\" --data-type SINGLE_SELECT --single-select-options \"Sprint 1,Sprint 2,Sprint 3\""
    echo ""
    echo "   # Type field (required)"
    echo "   gh project field-create 9 --owner $OWNER --name \"Type\" --data-type SINGLE_SELECT --single-select-options \"Epic,Feature,Chore,Bug\""
    echo ""
    echo "   # Area field (required)"
    echo "   gh project field-create 9 --owner $OWNER --name \"Area\" --data-type SINGLE_SELECT --single-select-options \"Orchestration,Agents,Frontend,Infra,SDK-CLI,Storage-RAG,Chain-Adapter,Security,Observability,Contracts,Docs\""
    echo ""
    echo "   # Chain field (optional - only if using chain-specific issues)"
    echo "   gh project field-create 9 --owner $OWNER --name \"Chain\" --data-type SINGLE_SELECT --single-select-options \"Protocol Labs,SKALE,BNB,Avalanche\""
    echo ""
    echo "   # Preset field (optional - only if using preset-specific issues)"
    echo "   gh project field-create 9 --owner $OWNER --name \"Preset\" --data-type SINGLE_SELECT --single-select-options \"verifiable-factory,skale-commerce,bnb-infra,avax-infra\""
    echo ""
    echo "After creating fields, run this script again to get the field IDs."
fi

echo ""
echo "Single-Select Field Options:"
echo "$FIELDS" | jq -r '.[] | select(.options != null) | "   \(.name):\n" + (.options[] | "      - \(.name): \(.id)")'

