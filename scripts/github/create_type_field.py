#!/usr/bin/env python3
"""
Create Type field in GitHub Project 9 using fine-grained PAT
This script uses the same authentication as create_phase1_issues.py
"""

import os
import sys
import requests
import json

# Load environment variables
if os.path.exists(".env.issue"):
    with open(".env.issue", "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                # Remove quotes if present
                value = value.strip('"\'')
                os.environ[key.strip()] = value

token = os.getenv("GITHUB_TOKEN")
owner = os.getenv("GITHUB_OWNER")
project_id = os.getenv("PROJECT_ID")

if not all([token, owner, project_id]):
    print("Error: Missing required environment variables")
    print("Required: GITHUB_TOKEN, GITHUB_OWNER, PROJECT_ID")
    print("Make sure .env.issue is configured")
    sys.exit(1)

# GraphQL mutation to create a single-select field
mutation = """
mutation CreateProjectField($projectId: ID!, $name: String!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
  createProjectV2Field(input: {
    projectId: $projectId
    name: $name
    dataType: SINGLE_SELECT
    singleSelectOptions: $options
  }) {
    projectV2Field {
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
"""

variables = {
    "projectId": project_id,
    "name": "Issue Type",  # Use "Issue Type" as GitHub Projects standard name
    "options": [
        {"name": "Epic", "color": "BLUE", "description": "Large feature or initiative"},
        {"name": "Feature", "color": "GREEN", "description": "New functionality"},
        {"name": "Chore", "color": "GRAY", "description": "Maintenance or setup task"},
        {"name": "Bug", "color": "RED", "description": "Bug fix"}
    ]
}

headers = {
    "Authorization": f"Bearer {token}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

print(f"Checking for Type field in Project 9 for {owner}...")
print(f"Project ID: {project_id}")

# First, check if the field already exists
query = """
query GetFields($projectId: ID!) {
  node(id: $projectId) {
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
          ... on ProjectV2Field {
            id
            name
          }
        }
      }
    }
  }
}
"""

check_response = requests.post(
    "https://api.github.com/graphql",
    headers=headers,
    json={"query": query, "variables": {"projectId": project_id}},
)

if check_response.status_code == 200:
    check_result = check_response.json()
    if "data" in check_result and check_result["data"]["node"]:
        fields = check_result["data"]["node"]["fields"]["nodes"]
        # Debug: show all field names
        print(f"Found {len(fields)} fields in project:")
        for f in fields:
            print(f"  - {f.get('name', 'Unknown')} (ID: {f.get('id', 'N/A')})")
        
        # Check for both "Type" and "Issue Type" (GitHub Projects may use either)
        type_field = next((f for f in fields if f["name"] in ["Type", "Issue Type"]), None)
        if type_field:
            print(f"\n[OK] Type/Issue Type field already exists!")
            print(f"  Field ID: {type_field['id']}")
            print(f"  Field Name: {type_field['name']}")
            if "options" in type_field:
                print(f"  Options: {', '.join([opt['name'] for opt in type_field['options']])}")
            print(f"\nAdd this to .env.issue:")
            print(f"TYPE_FIELD_ID={type_field['id']}")
            sys.exit(0)
        else:
            print(f"\n[INFO] No 'Type' or 'Issue Type' field found. Will attempt to create 'Issue Type' field.")

print(f"Creating Type field...")

response = requests.post(
    "https://api.github.com/graphql",
    headers=headers,
    json={"query": mutation, "variables": variables},
)

if response.status_code == 200:
    result = response.json()
    if "errors" in result:
        error_msg = result["errors"][0].get("message", "Unknown error")
        if "already exists" in error_msg.lower() or "duplicate" in error_msg.lower() or "already been taken" in error_msg.lower():
            print("[OK] Issue Type field already exists")
            # Try to get the existing field ID
            query = """
            query GetField($projectId: ID!) {
              node(id: $projectId) {
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
                      ... on ProjectV2Field {
                        id
                        name
                      }
                    }
                  }
                }
              }
            }
            """
            response2 = requests.post(
                "https://api.github.com/graphql",
                headers=headers,
                json={"query": query, "variables": {"projectId": project_id}},
            )
            if response2.status_code == 200:
                result2 = response2.json()
                if "data" in result2 and result2["data"]["node"]:
                    fields = result2["data"]["node"]["fields"]["nodes"]
                    print(f"\n[DEBUG] Found {len(fields)} fields in project:")
                    for f in fields:
                        print(f"  - {f.get('name', 'Unknown')} (ID: {f.get('id', 'N/A')})")
                    
                    # Check for both "Type" and "Issue Type"
                    type_field = next((f for f in fields if f["name"] in ["Type", "Issue Type"]), None)
                    if type_field:
                        print(f"\n[OK] Found field: {type_field['name']}")
                        print(f"  Field ID: {type_field['id']}")
                        if "options" in type_field and type_field["options"]:
                            print(f"  Options: {', '.join([opt['name'] for opt in type_field['options']])}")
                        print(f"\nAdd this to .env.issue:")
                        print(f"TYPE_FIELD_ID={type_field['id']}")
                    else:
                        print("\n[WARNING] Field exists but could not retrieve ID. Check Project 9 manually.")
                else:
                    print(f"\n[WARNING] Could not parse field data from response: {result2}")
            else:
                print(f"\n[WARNING] Failed to query fields: {response2.status_code} - {response2.text}")
        else:
            print(f"[ERROR] Error: {error_msg}")
            print(json.dumps(result, indent=2))
    else:
        field = result["data"]["createProjectV2Field"]["projectV2Field"]
        print(f"[OK] Type field created successfully!")
        print(f"  Field ID: {field['id']}")
        print(f"  Field Name: {field['name']}")
        print(f"\nAdd this to .env.issue:")
        print(f"TYPE_FIELD_ID={field['id']}")
else:
    print(f"[ERROR] Failed to create field: {response.status_code}")
    print(response.text)

