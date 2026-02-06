#!/usr/bin/env python3
"""
GitHub Issues Automation for HyperAgent Phase 1 Roadmap

This script creates GitHub issues from CSV/YAML data and links them to GitHub Project 9
with proper labels, milestones, and custom fields (Sprint, Type, Area, Chain, Preset).

SETUP INSTRUCTIONS:
==================

1. Generate a Fine-Grained Personal Access Token (PAT):
   - Go to: https://github.com/settings/tokens?type=beta
   - Click "Generate new token" → "Generate new token (fine-grained)"
   - Select your organization/repository
   - Set expiration (recommend 90 days for automation)
   - Required scopes:
     * Repository access: Read and write permissions
     * Account permissions: Read and write for "Projects"
   - Copy the token and save it securely (you'll need it for GITHUB_TOKEN)

2. Find the Project ID for Project 9:
   ```bash
   gh api graphql -f query='
     query {
       organization(login: "YOUR_ORG") {
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
   Or if it's a user project:
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
   Or use the helper script:
   ```bash
   ./scripts/fetch_project_ids.sh org YOUR_ORG
   ```
   Save the `id` value (it looks like: PVT_kwDO...)

3. Fetch Project Field IDs:
   ```bash
   gh api graphql -f query='
     query {
       organization(login: "YOUR_ORG") {
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
   ' | jq '.data.organization.projectsV2.nodes[] | select(.number == 9) | .fields.nodes[]'
   ```
   Or use the helper script (recommended):
   ```bash
   ./scripts/fetch_project_ids.sh org YOUR_ORG
   ```
   Look for fields named "Sprint", "Type", "Area", "Chain", "Preset" and save their IDs.

4. Create Milestones (if they don't exist):
   ```bash
   gh api repos/YOUR_ORG/YOUR_REPO/milestones \
     -X POST \
     -f title="Phase 1 – Sprint 1 (Feb 5–17)" \
     -f description="Foundation Sprint 1"
   
   gh api repos/YOUR_ORG/YOUR_REPO/milestones \
     -X POST \
     -f title="Phase 1 – Sprint 2 (Feb 18–Mar 2)" \
     -f description="Foundation Sprint 2"
   
   gh api repos/YOUR_ORG/YOUR_REPO/milestones \
     -X POST \
     -f title="Phase 1 – Sprint 3 (Mar 3–16)" \
     -f description="Foundation Sprint 3"
   ```

5. Set Environment Variables:
   ```bash
   export GITHUB_TOKEN="your_pat_token_here"
   export GITHUB_OWNER="your_org_or_username"
   export GITHUB_REPO="your_repo_name"
   export PROJECT_ID="PVT_kwDO..."  # From step 2
   export SPRINT_FIELD_ID="..."     # From step 3
   export TYPE_FIELD_ID="..."       # From step 3
   export AREA_FIELD_ID="..."       # From step 3
   export CHAIN_FIELD_ID="..."      # From step 3 (optional)
   export PRESET_FIELD_ID="..."     # From step 3 (optional)
   ```

USAGE:
======
python3 scripts/create_phase1_issues.py --csv issues.csv
# OR
python3 scripts/create_phase1_issues.py --yaml issues.yaml
"""

import os
import sys
import csv
import json
import yaml
import argparse
import requests
import time
import logging
from typing import Dict, List, Optional, Any
from urllib.parse import quote

# Configure logging following GitHub automation patterns
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class GitHubProjectAutomation:
    def __init__(
        self,
        token: str,
        owner: str,
        repo: str,
        project_id: str,
        field_ids: Dict[str, str],
        codeowners_path: str = "CODEOWNERS",
    ):
        self.token = token
        self.owner = owner
        self.repo = repo
        self.project_id = project_id
        self.field_ids = field_ids
        self.headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        self.graphql_headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        self.milestone_cache: Dict[str, Optional[int]] = {}
        self.codeowners = self._parse_codeowners(codeowners_path)
        self.existing_issues_cache: Optional[Dict[str, Dict[str, Any]]] = None

    def _parse_codeowners(self, codeowners_path: str) -> Dict[str, str]:
        """Parse CODEOWNERS file to extract owners and their roles."""
        owners = {}
        try:
            if os.path.exists(codeowners_path):
                with open(codeowners_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        # Skip empty lines, comments, and email lines
                        if not line or line.startswith("#") or "@" not in line or "Email:" in line:
                            continue
                        # Parse format: @username - Role description
                        if " - " in line:
                            parts = line.split(" - ", 1)
                            if len(parts) == 2:
                                username_part = parts[0].strip()
                                # Extract username (remove @ if present)
                                username = username_part.replace("@", "").strip()
                                role = parts[1].strip()
                                if username:
                                    owners[username] = role
        except Exception as e:
            logger.warning(f"Could not parse CODEOWNERS: {e}")
        
        # Ensure we have at least the default owners
        if not owners:
            owners = {
                "JustineDevs": "CPOO/Product Lead",
                "ArhonJay": "CTO/Project Architect",
                "Tristan-T-Dev": "Frontend Developer / UI/UX",
            }
        
        return owners

    def _assign_owner(self, area: Optional[str], issue_type: str, sprint: Optional[str] = None) -> str:
        """Assign issues based on area and team roles.
        
        Distribution:
        - JustineDevs: Orchestration, GitOps, DevOps, Documentation, Backend
        - ArhonJay: SDKs related
        - Tristan-T-Dev: Frontend Side
        """
        # Tristan-T-Dev: Frontend only
        tristan_areas = {"frontend"}
        
        # ArhonJay: SDKs only
        arhon_areas = {"sdk-cli"}
        
        # JustineDevs: Everything else (Orchestration, GitOps, DevOps, Docs, Backend)
        justine_areas = {
            "orchestration",  # Core orchestration
            "infra",  # Infrastructure, DevOps, GitOps
            "docs",  # Documentation
            "backend",  # Backend services
            "api",  # API layer
            "storage-rag",  # Backend data systems
            "security",  # Backend security
            "observability",  # Backend monitoring
            "agents",  # Backend agents
            "chain-adapter",  # Backend chain adapters
            "contracts",  # Backend contract templates
        }
        
        # Epics always go to JustineDevs (primary owner)
        if issue_type == "epic":
            return "JustineDevs"
        
        # Area-based assignment
        if area in tristan_areas:
            return "Tristan-T-Dev"
        elif area in arhon_areas:
            return "ArhonJay"
        elif area in justine_areas:
            return "JustineDevs"
        else:
            # Default to JustineDevs for unassigned areas
            return "JustineDevs"

    def _get_reviewer(self, assigned_owner: str) -> str:
        """Get the reviewer for cross-review.
        
        Review assignments:
        - Frontend issues (Tristan-T-Dev) reviewed by JustineDevs (product lead)
        - SDK issues (ArhonJay) reviewed by JustineDevs (product lead)
        - JustineDevs issues reviewed by ArhonJay (technical review)
        """
        if assigned_owner == "Tristan-T-Dev":
            # Frontend issues reviewed by JustineDevs (product lead)
            return "JustineDevs"
        elif assigned_owner == "ArhonJay":
            # SDK issues reviewed by JustineDevs (product lead)
            return "JustineDevs"
        else:
            # JustineDevs issues reviewed by ArhonJay (technical review)
            return "ArhonJay"

    def get_existing_issues(self, milestone_title: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
        """Fetch existing issues and cache them. Returns dict mapping title -> issue data."""
        if self.existing_issues_cache is not None:
            return self.existing_issues_cache
        
        logger.info("Fetching existing issues to check for duplicates...")
        url = f"https://api.github.com/repos/{self.owner}/{self.repo}/issues"
        params = {"state": "all", "per_page": 100}
        all_issues = {}
        page = 1
        
        while True:
            params["page"] = page
            response = requests.get(url, headers=self.headers, params=params)
            
            if response.status_code != 200:
                logger.warning(f"Could not fetch issues: {response.status_code}")
                break
            
            issues = response.json()
            if not issues:
                break
            
            for issue in issues:
                # Skip pull requests
                if "pull_request" in issue:
                    continue
                
                # Filter by milestone if provided
                if milestone_title and issue.get("milestone"):
                    if issue["milestone"]["title"] != milestone_title:
                        continue
                elif milestone_title and not issue.get("milestone"):
                    continue
                
                title = issue["title"]
                all_issues[title] = {
                    "number": issue["number"],
                    "title": title,
                    "url": issue["html_url"],
                    "state": issue["state"],
                    "milestone": issue.get("milestone", {}).get("title") if issue.get("milestone") else None,
                }
            
            # Check if there are more pages
            if len(issues) < 100:
                break
            page += 1
        
        self.existing_issues_cache = all_issues
        logger.info(f"Found {len(all_issues)} existing issues")
        return all_issues
    
    def check_duplicate(self, title: str, milestone_title: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Check if an issue with the same title already exists."""
        existing = self.get_existing_issues(milestone_title)
        return existing.get(title)
    
    def get_milestone_number(self, milestone_title: str) -> Optional[int]:
        """Get milestone number by title, with caching."""
        if milestone_title in self.milestone_cache:
            return self.milestone_cache[milestone_title]

        url = f"https://api.github.com/repos/{self.owner}/{self.repo}/milestones"
        params = {"state": "all", "per_page": 100}
        response = requests.get(url, headers=self.headers, params=params)

        if response.status_code != 200:
            logger.warning(f"Could not fetch milestones: {response.status_code} - {response.text}")
            return None

        milestones = response.json()
        for milestone in milestones:
            if milestone["title"] == milestone_title:
                self.milestone_cache[milestone_title] = milestone["number"]
                logger.debug(f"Found milestone '{milestone_title}': #{milestone['number']}")
                return milestone["number"]

        logger.warning(f"Milestone '{milestone_title}' not found")
        return None

    def generate_issue_body(
        self,
        title: str,
        labels: List[str],
        milestone: Optional[str],
        sprint: Optional[str],
        chain: Optional[str],
        preset: Optional[str],
    ) -> str:
        """Generate comprehensive issue body following the template."""
        issue_type = next((l.split(":")[1] for l in labels if l.startswith("type:")), "feature")
        area = next((l.split(":")[1] for l in labels if l.startswith("area:")), None)
        phase = next((l.split(":")[1] for l in labels if l.startswith("phase:")), None)
        
        # Calculate deadline from milestone
        deadline = self._extract_deadline_from_milestone(milestone) if milestone else "TBD"
        
        # Determine skills based on area
        skills = self._get_required_skills(area, issue_type)
        
        # Determine effort based on issue type
        effort = self._estimate_effort(issue_type, area)
        
        # Generate acceptance criteria
        acceptance_criteria = self._generate_acceptance_criteria(issue_type, area)
        
        # Generate subtasks
        subtasks = self._generate_subtasks(issue_type, area)
        
        # Build the body following Internal Planning Layers
        body_parts = []
        
        # ============================================================
        # LAYER 1: INTENT PARSING - Understanding the Task
        # ============================================================
        body_parts.append("## 🎯 Layer 1: Intent Parsing\n")
        body_parts.append("**What needs to be done?**\n\n")
        body_parts.append(f"**Task Title:**  \n> {title}\n\n")
        goal = self._generate_goal(issue_type, title, area)
        body_parts.append(f"**Primary Goal:**  \n> {goal}\n\n")
        user_story = self._generate_user_story(issue_type, title, area)
        body_parts.append(f"**User Story / Context:**  \n> {user_story}\n\n")
        impact = self._generate_business_impact(issue_type, area, chain, preset)
        body_parts.append(f"**Business Impact:**  \n> {impact}\n\n")
        body_parts.append("**Task Metadata:**\n")
        body_parts.append(f"- Sprint: {sprint if sprint else 'TBD'}\n")
        body_parts.append(f"- Related Epic/Project: GitHub Project 9 - Phase 1 Foundation\n")
        body_parts.append(f"- Issue Type: {issue_type.title()}\n")
        if area:
            body_parts.append(f"- Area: {area.title()}\n")
        if chain:
            body_parts.append(f"- Chain: {chain}\n")
        if preset:
            body_parts.append(f"- Preset: {preset}\n")
        body_parts.append("\n---\n\n")
        
        # ============================================================
        # LAYER 2: KNOWLEDGE RETRIEVAL - Gathering Resources
        # ============================================================
        body_parts.append("## 📚 Layer 2: Knowledge Retrieval\n")
        body_parts.append("**What information do I need?**\n\n")
        body_parts.append("**Required Skills / Knowledge:**\n")
        for skill in skills:
            body_parts.append(f"- [ ] {skill}\n")
        body_parts.append(f"\n**Estimated Effort:**  \n> {effort}\n\n")
        body_parts.append("**Knowledge Resources:**\n")
        body_parts.append("- [ ] Review `.cursor/skills/` for relevant patterns\n")
        body_parts.append("- [ ] Check `.cursor/llm/` for implementation examples\n")
        body_parts.append("- [ ] Read Product spec: `docs/HyperAgent Spec.md`\n")
        if area == "frontend":
            body_parts.append("- [ ] Review design files / Figma (if available)\n")
        body_parts.append("- [ ] Study tech docs / ADRs in `docs/` directory\n")
        body_parts.append("- [ ] Review API / schema references for relevant services\n")
        body_parts.append("\n**Architecture Context:**\n")
        architecture_diagram = self._generate_architecture_diagram(area, issue_type, title, chain, preset)
        if architecture_diagram:
            body_parts.append("**System Architecture Diagram:**\n\n")
            body_parts.append(architecture_diagram)
            body_parts.append("\n")
        body_parts.append("\n**Code Examples & Patterns:**\n")
        code_examples = self._generate_code_examples(area, issue_type, title)
        if code_examples:
            body_parts.append(code_examples)
            body_parts.append("\n")
        else:
            body_parts.append("> Review existing codebase for similar implementations\n")
        body_parts.append("\n---\n\n")
        
        # ============================================================
        # LAYER 3: CONSTRAINT ANALYSIS - Identifying Limitations
        # ============================================================
        body_parts.append("## ⚠️ Layer 3: Constraint Analysis\n")
        body_parts.append("**What constraints and dependencies exist?**\n\n")
        dependencies = self._identify_dependencies(issue_type, area, chain, preset)
        body_parts.append("**Known Dependencies:**\n")
        if dependencies:
            for dep in dependencies:
                body_parts.append(f"- [ ] {dep}\n")
        else:
            body_parts.append("- [ ] None identified at this time\n")
        body_parts.append("\n**Technical Constraints:**\n")
        scope_notes = self._generate_scope_notes(issue_type, area, chain, preset)
        body_parts.append(f"> {scope_notes}\n")
        body_parts.append("\n**Current Blockers:**\n")
        body_parts.append("> None identified (update as work progresses)\n")
        risks = self._identify_risks(issue_type, area)
        body_parts.append(f"\n**Risk Assessment & Mitigations:**\n")
        body_parts.append(f"> {risks}\n")
        body_parts.append("\n**Resource Constraints:**\n")
        body_parts.append(f"- Deadline: {deadline}\n")
        body_parts.append(f"- Effort Estimate: {effort}\n")
        body_parts.append("\n---\n\n")
        
        # ============================================================
        # LAYER 4: SOLUTION GENERATION - Designing Approach
        # ============================================================
        body_parts.append("## 💡 Layer 4: Solution Generation\n")
        body_parts.append("**How should this be implemented?**\n\n")
        body_parts.append("**Solution Approach:**\n")
        body_parts.append("> [Describe the high-level approach here]\n")
        body_parts.append("\n**Design Considerations:**\n")
        body_parts.append("- [ ] Follow established patterns from `.cursor/skills/`\n")
        body_parts.append("- [ ] Maintain consistency with existing codebase\n")
        body_parts.append("- [ ] Consider scalability and maintainability\n")
        body_parts.append("- [ ] Ensure proper error handling\n")
        body_parts.append("- [ ] Plan for testing and validation\n")
        body_parts.append("\n**Acceptance Criteria (Solution Validation):**\n")
        for criterion in acceptance_criteria:
            body_parts.append(f"- [ ] {criterion}\n")
        body_parts.append("\n---\n\n")
        
        # ============================================================
        # LAYER 5: EXECUTION PLANNING - Breaking Down Steps
        # ============================================================
        body_parts.append("## 📋 Layer 5: Execution Planning\n")
        body_parts.append("**What are the concrete steps?**\n\n")
        body_parts.append("**Implementation Steps:**\n")
        for i, subtask in enumerate(subtasks, 1):
            body_parts.append(f"{i}. [ ] {subtask}\n")
        body_parts.append("\n**Environment Setup:**\n")
        body_parts.append("**Repos / Services:**\n")
        if area in ["frontend", "orchestration", "agents"]:
            body_parts.append("- Backend repo: `hyperagent/`\n")
        if area == "frontend":
            body_parts.append("- Frontend repo: `hyperagent/apps/web/`\n")
        if area in ["infra", "orchestration"]:
            body_parts.append("- Infra / IaC repo: `hyperagent/infra/`\n")
        body_parts.append("\n**Required Environment Variables:**\n")
        env_vars = self._get_required_env_vars(area, chain)
        for var in env_vars:
            body_parts.append(f"- `{var}=` (get from internal vault)\n")
        body_parts.append("\n**Access & Credentials:**\n")
        body_parts.append("- API keys: Internal vault (1Password / Doppler)\n")
        body_parts.append("- Access request: Contact @devops or project lead\n")
        body_parts.append("\n---\n\n")
        
        # ============================================================
        # LAYER 6: OUTPUT FORMATTING - Delivery & Validation
        # ============================================================
        body_parts.append("## ✅ Layer 6: Output Formatting & Validation\n")
        body_parts.append("**How do we ensure quality delivery?**\n\n")
        assigned_owner = self._assign_owner(area, issue_type, sprint)
        reviewer = self._get_reviewer(assigned_owner)
        body_parts.append("**Ownership & Collaboration:**\n")
        body_parts.append(f"- Owner: @{assigned_owner}\n")
        body_parts.append(f"- Reviewer: @{reviewer}\n")
        body_parts.append(f"- Deadline: {deadline}\n")
        body_parts.append("- Communication: Daily stand-up updates, GitHub issue comments\n")
        body_parts.append("\n**Quality Gates:**\n")
        body_parts.append("- [ ] Code follows project style guide\n")
        body_parts.append("- [ ] All tests pass (unit, integration, e2e)\n")
        body_parts.append("- [ ] No critical lint/security issues\n")
        body_parts.append("- [ ] Documentation updated (README, code comments, ADRs)\n")
        body_parts.append("- [ ] Meets all acceptance criteria\n")
        body_parts.append("\n**Review Checklist:**\n")
        body_parts.append(f"- [ ] Code review approved by @{reviewer}\n")
        body_parts.append("- [ ] CI/CD pipeline passes\n")
        body_parts.append("- [ ] Performance benchmarks met (if applicable)\n")
        body_parts.append("- [ ] Security scan passes\n")
        body_parts.append("\n**Delivery Status:**\n")
        body_parts.append("- Initial Status: To Do\n")
        body_parts.append("- Progress Tracking: Use issue comments for updates\n")
        body_parts.append(f"- Sign-off: Approved by @{reviewer} on YYYY-MM-DD\n")
        body_parts.append("- PR Link: [Link to merged PR(s)]\n")
        
        return "".join(body_parts)
    
    def _extract_deadline_from_milestone(self, milestone: Optional[str]) -> str:
        """Extract deadline from milestone name."""
        if not milestone:
            return "TBD"
        # Format: "Phase 1 – Sprint 1 (Feb 5–17)"
        import re
        match = re.search(r'\(([^)]+)\)', milestone)
        if match:
            return match.group(1)
        return "TBD"
    
    def _get_required_skills(self, area: Optional[str], issue_type: str) -> List[str]:
        """Determine required skills based on area and type."""
        skills_map = {
            "frontend": ["UI/UX design (Figma, design systems)", "Frontend (React/Next.js, TS)"],
            "orchestration": ["Backend/API (FastAPI, Python)", "DevOps/Infra (CI/CD, Docker)"],
            "agents": ["Backend/API (FastAPI, Python)", "Smart contracts (Solidity, Foundry/Hardhat)"],
            "chain-adapter": ["Smart contracts (Solidity, Foundry/Hardhat)", "Backend/API (FastAPI, Python)"],
            "storage-rag": ["Backend/API (FastAPI, Python)", "Data/Analytics (Supabase, Dune, etc.)"],
            "infra": ["DevOps/Infra (CI/CD, Docker)", "Backend/API (FastAPI, Python)"],
            "sdk-cli": ["Frontend (React/Next.js, TS)", "Backend/API (FastAPI, Python)"],
            "security": ["Smart contracts (Solidity, Foundry/Hardhat)", "Backend/API (FastAPI, Python)"],
            "observability": ["Backend/API (FastAPI, Python)", "Data/Analytics (Supabase, Dune, etc.)"],
            "contracts": ["Smart contracts (Solidity, Foundry/Hardhat)"],
        }
        base_skills = skills_map.get(area, ["Backend/API (FastAPI, Python)"])
        if issue_type == "epic":
            base_skills.append("Project Management")
        return base_skills
    
    def _estimate_effort(self, issue_type: str, area: Optional[str]) -> str:
        """Estimate effort based on issue type."""
        if issue_type == "epic":
            return "L (Large - multiple sprints)"
        elif issue_type == "feature":
            return "M (Medium - 3-5 days)"
        elif issue_type == "chore":
            return "S (Small - 1-2 days)"
        else:
            return "M (Medium - 3-5 days)"
    
    def _generate_acceptance_criteria(self, issue_type: str, area: Optional[str]) -> List[str]:
        """Generate acceptance criteria based on type and area."""
        base_criteria = [
            "Implementation complete and tested",
            "Code reviewed and approved",
            "Documentation updated",
        ]
        
        if issue_type == "epic":
            return [
                "All related issues completed",
                "Epic goals achieved",
                "Integration tested",
            ]
        elif issue_type == "feature":
            if area == "frontend":
                base_criteria.extend([
                    "UI/UX matches design specifications",
                    "Responsive design verified",
                    "Accessibility standards met",
                ])
            elif area in ["agents", "orchestration"]:
                base_criteria.extend([
                    "Unit tests written and passing",
                    "Integration tests passing",
                    "Error handling implemented",
                ])
            elif area == "chain-adapter":
                base_criteria.extend([
                    "Contract compiles successfully",
                    "Tests pass on target chain",
                    "Deployment verified",
                ])
        elif issue_type == "chore":
            base_criteria = [
                "Task completed as specified",
                "No breaking changes introduced",
            ]
        
        return base_criteria
    
    def _generate_subtasks(self, issue_type: str, area: Optional[str]) -> List[str]:
        """Generate subtasks based on issue type."""
        base_subtasks = [
            "Define detailed requirements / confirm acceptance criteria",
            "Implement / build",
            "Write/update tests (unit/integration/e2e as relevant)",
            "Update docs (README, runbook, in-app help, etc.)",
            "Demo in sprint review and gather feedback",
        ]
        
        if issue_type == "epic":
            return [
                "Break down epic into smaller issues",
                "Assign issues to team members",
                "Track progress across all related issues",
                "Verify integration of all components",
            ]
        
        if area == "frontend":
            base_subtasks.insert(2, "Create/update UI components")
            base_subtasks.insert(3, "Implement responsive design")
        
        return base_subtasks
    
    def _generate_goal(self, issue_type: str, title: str, area: Optional[str]) -> str:
        """Generate goal description."""
        if issue_type == "epic":
            return f"Complete {title.lower()} to enable Phase 1 Foundation goals"
        elif "Implement" in title:
            return f"Successfully implement {title.lower().replace('implement ', '')} with full functionality"
        elif "Design" in title:
            return f"Design and document {title.lower().replace('design ', '')} following best practices"
        elif "Set up" in title or "Configure" in title:
            return f"Set up and configure {title.lower()} for use in HyperAgent"
        else:
            return f"Complete {title.lower()} to support HyperAgent Phase 1 objectives"
    
    def _generate_business_impact(self, issue_type: str, area: Optional[str], chain: Optional[str], preset: Optional[str]) -> str:
        """Generate business impact description."""
        impact_parts = []
        
        if area == "orchestration":
            impact_parts.append("enables core platform functionality")
        elif area == "agents":
            impact_parts.append("enables AI-powered contract generation")
        elif area == "frontend":
            impact_parts.append("improves user experience and onboarding")
        elif area == "chain-adapter":
            impact_parts.append(f"enables deployment to {chain or 'target chain'}")
        elif area == "storage-rag":
            impact_parts.append("improves agent knowledge and code quality")
        
        if preset:
            impact_parts.append(f"supports {preset} preset functionality")
        
        if issue_type == "epic":
            impact_parts.append("critical for Phase 1 MVP delivery")
        
        if not impact_parts:
            impact_parts.append("contributes to Phase 1 Foundation goals")
        
        return ", ".join(impact_parts)
    
    def _generate_scope_notes(self, issue_type: str, area: Optional[str], chain: Optional[str], preset: Optional[str]) -> str:
        """Generate scope notes."""
        notes = []
        
        if issue_type == "epic":
            notes.append("This epic may span multiple sprints")
            notes.append("Related issues should be tracked separately")
        
        if chain:
            notes.append(f"Focus on {chain} chain integration")
        
        if preset:
            notes.append(f"Part of {preset} preset implementation")
        
        if area == "frontend":
            notes.append("Out of scope: Backend API changes (track separately)")
        elif area == "orchestration":
            notes.append("Out of scope: Frontend UI changes (track separately)")
        
        if not notes:
            notes.append("Scope limited to this specific task")
        
        return "; ".join(notes)
    
    def _generate_user_story(self, issue_type: str, title: str, area: Optional[str]) -> str:
        """Generate user story."""
        if area == "frontend":
            return f"As a user, I want {title.lower()} so that I can effectively use HyperAgent features"
        elif area == "agents":
            return f"As a developer, I want {title.lower()} so that HyperAgent can generate better contracts"
        elif area == "orchestration":
            return f"As a platform user, I want {title.lower()} so that the system operates reliably"
        else:
            return f"As a developer/user, I want {title.lower()} so that HyperAgent functions as designed"
    
    def _identify_dependencies(self, issue_type: str, area: Optional[str], chain: Optional[str], preset: Optional[str]) -> List[str]:
        """Identify dependencies."""
        deps = []
        
        if area == "frontend":
            deps.append("Backend API endpoints must be ready")
        elif area == "agents":
            deps.append("Orchestration service must be available")
        elif area == "chain-adapter":
            deps.append("Chain RPC endpoints must be configured")
        
        if preset:
            deps.append(f"Related {preset} preset components")
        
        return deps
    
    def _identify_risks(self, issue_type: str, area: Optional[str]) -> str:
        """Identify risks and mitigations."""
        if area == "chain-adapter":
            return "Integration risk with external chain APIs; plan spike first, implement feature flags for gradual rollout"
        elif area == "agents":
            return "LLM API reliability; implement retry logic and fallback mechanisms"
        elif area == "orchestration":
            return "Complex state management; use LangGraph best practices, add comprehensive tests"
        else:
            return "Standard development risks; follow best practices, code review, and testing"
    
    def _get_required_env_vars(self, area: Optional[str], chain: Optional[str]) -> List[str]:
        """Get required environment variables."""
        base_vars = ["DATABASE_URL", "REDIS_URL"]
        
        if area in ["agents", "orchestration"]:
            base_vars.extend(["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"])
        
        if area == "chain-adapter" or chain:
            base_vars.extend([f"{chain.upper()}_RPC_URL" if chain else "CHAIN_RPC_URL"])
        
        if area == "storage-rag":
            base_vars.extend(["PINECONE_API_KEY", "SUPABASE_URL", "SUPABASE_KEY"])
        
        if area == "frontend":
            base_vars.extend(["NEXT_PUBLIC_API_URL"])
        
        return base_vars

    def _generate_architecture_diagram(self, area: Optional[str], issue_type: str, title: str, chain: Optional[str] = None, preset: Optional[str] = None) -> Optional[str]:
        """Generate Mermaid architecture diagram based on issue area and type."""
        if issue_type == "epic":
            # Epics get high-level architecture
            return self._generate_epic_architecture_diagram(area)
        
        if area == "orchestration":
            return self._generate_orchestration_diagram(title)
        elif area == "agents":
            return self._generate_agent_architecture_diagram(title)
        elif area == "frontend":
            return self._generate_frontend_architecture_diagram(title)
        elif area == "chain-adapter":
            return self._generate_chain_adapter_diagram(title, chain)
        elif area == "storage-rag":
            return self._generate_storage_architecture_diagram(title)
        elif area == "infra":
            return self._generate_infra_architecture_diagram(title)
        elif area == "observability":
            return self._generate_observability_diagram(title)
        elif area == "security":
            return self._generate_security_architecture_diagram(title)
        
        return None
    
    def _generate_epic_architecture_diagram(self, area: Optional[str]) -> str:
        """Generate high-level architecture diagram for epics."""
        return """```mermaid
graph TB
    subgraph "Client Layer"
        UI[Web UI<br/>Next.js/React]
        SDK[TypeScript SDK<br/>x402, CLI]
    end
    
    subgraph "API & Orchestration"
        Gateway[API Gateway<br/>FastAPI]
        Orchestrator[LangGraph<br/>Orchestrator]
        Queue[Redis Queue<br/>Celery Workers]
    end
    
    subgraph "Agent Workers"
        SpecAgent[SpecAgent]
        CodeGen[CodeGenAgent]
        Audit[AuditAgent]
        Deploy[DeployAgent]
        Monitor[MonitorAgent]
    end
    
    subgraph "Storage & RAG"
        DB[(Supabase<br/>PostgreSQL)]
        VectorDB[(VectorDB<br/>Pinecone)]
        Redis[(Redis<br/>Cache)]
        IPFS[IPFS/Filecoin<br/>Artifacts]
    end
    
    subgraph "Verification & Deployment"
        Tenderly[Tenderly<br/>Simulation]
        Slither[Slither<br/>Static Analysis]
        ChainAdapter[Chain Adapters<br/>Multi-chain]
    end
    
    UI --> Gateway
    SDK --> Gateway
    Gateway --> Orchestrator
    Orchestrator --> Queue
    Queue --> SpecAgent
    Queue --> CodeGen
    Queue --> Audit
    Queue --> Deploy
    Queue --> Monitor
    
    SpecAgent --> VectorDB
    CodeGen --> VectorDB
    Audit --> Slither
    Audit --> Tenderly
    Deploy --> ChainAdapter
    
    Orchestrator --> DB
    Orchestrator --> Redis
```"""
    
    def _generate_orchestration_diagram(self, title: str) -> str:
        """Generate orchestration architecture diagram."""
        if "FastAPI" in title or "API gateway" in title:
            return """```mermaid
sequenceDiagram
    participant Client
    participant Gateway as API Gateway<br/>(FastAPI)
    participant Auth as Auth Middleware
    participant Orchestrator as LangGraph<br/>Orchestrator
    participant Queue as Redis Queue
    participant Worker as Agent Worker
    
    Client->>Gateway: POST /api/v1/workflows
    Gateway->>Auth: Validate token
    Auth-->>Gateway: User context
    Gateway->>Orchestrator: Create workflow
    Orchestrator->>Queue: Enqueue tasks
    Queue->>Worker: Process task
    Worker-->>Orchestrator: Task result
    Orchestrator-->>Gateway: Workflow status
    Gateway-->>Client: Response
```"""
        elif "LangGraph" in title or "orchestrator" in title.lower():
            return """```mermaid
graph LR
    subgraph "Orchestration Layer"
        Router[Agent Router<br/>Model Selection]
        State[State Manager<br/>Workflow State]
        Graph[LangGraph<br/>Workflow Engine]
    end
    
    subgraph "Agent Pool"
        Spec[SpecAgent]
        CodeGen[CodeGenAgent]
        Audit[AuditAgent]
        Deploy[DeployAgent]
    end
    
    Router --> State
    State --> Graph
    Graph --> Spec
    Graph --> CodeGen
    Graph --> Audit
    Graph --> Deploy
    
    Spec --> State
    CodeGen --> State
    Audit --> State
    Deploy --> State
```"""
        else:
            return """```mermaid
graph TB
    subgraph "Orchestration Service"
        API[FastAPI Gateway]
        Router[Agent Router]
        State[State Manager]
        Queue[Task Queue]
    end
    
    subgraph "External Services"
        DB[(Supabase)]
        Cache[(Redis)]
        VectorDB[(Pinecone)]
    end
    
    API --> Router
    Router --> State
    Router --> Queue
    State --> DB
    Queue --> Cache
    Router --> VectorDB
```"""
    
    def _generate_agent_architecture_diagram(self, title: str) -> str:
        """Generate agent architecture diagram."""
        if "SpecAgent" in title:
            return """```mermaid
graph TB
    subgraph "SpecAgent"
        Input[User Prompt]
        RAG[RAG Retrieval<br/>Solidity Docs]
        LLM[Claude/GPT-4<br/>Reasoning]
        Output[Structured Spec]
    end
    
    Input --> RAG
    RAG --> LLM
    LLM --> Output
    
    RAG -.-> VectorDB[(VectorDB)]
    LLM -.-> API[Anthropic API]
```"""
        elif "CodeGenAgent" in title:
            return """```mermaid
graph LR
    subgraph "CodeGenAgent"
        Spec[Structured Spec]
        Router[Model Router]
        Frontier[Frontier Model<br/>Claude/GPT-4]
        Fast[Fast Model<br/>Gemini]
        Output[Generated Code]
    end
    
    Spec --> Router
    Router -->|Complex| Frontier
    Router -->|Simple| Fast
    Frontier --> Output
    Fast --> Output
```"""
        elif "AuditAgent" in title:
            return """```mermaid
graph TB
    subgraph "AuditAgent"
        Code[Contract Code]
        Slither[Slither<br/>Static Analysis]
        Mythril[Mythril<br/>Symbolic Execution]
        MythX[MythX<br/>Cloud Analysis]
        Report[Audit Report]
    end
    
    Code --> Slither
    Code --> Mythril
    Code --> MythX
    Slither --> Report
    Mythril --> Report
    MythX --> Report
```"""
        elif "DeployAgent" in title:
            return """```mermaid
graph LR
    subgraph "DeployAgent"
        Contract[Compiled Contract]
        Adapter[Chain Adapter]
        Mantle[Mantle]
        Arbitrum[Arbitrum]
        Base[Base]
        Other[Other Chains]
    end
    
    Contract --> Adapter
    Adapter --> Mantle
    Adapter --> Arbitrum
    Adapter --> Base
    Adapter --> Other
```"""
        else:
            return """```mermaid
graph TB
    subgraph "Agent System"
        Orchestrator[Orchestrator]
        Agent[Agent Instance]
        Tools[Agent Tools]
        Memory[Agent Memory]
    end
    
    Orchestrator --> Agent
    Agent --> Tools
    Agent --> Memory
    Tools --> External[External APIs]
```"""
    
    def _generate_frontend_architecture_diagram(self, title: str) -> str:
        """Generate frontend architecture diagram."""
        return """```mermaid
graph TB
    subgraph "Frontend Layer"
        Pages[Next.js Pages<br/>App Router]
        Components[React Components<br/>shadcn/ui]
        State[State Management<br/>Zustand]
        API_Client[API Client<br/>TanStack Query]
    end
    
    subgraph "Backend"
        API[FastAPI Gateway]
        Services[Backend Services]
    end
    
    Pages --> Components
    Components --> State
    Components --> API_Client
    API_Client --> API
    API --> Services
```"""
    
    def _generate_chain_adapter_diagram(self, title: str, chain: Optional[str]) -> str:
        """Generate chain adapter architecture diagram."""
        chain_name = chain or "Target Chain"
        return f"""```mermaid
graph TB
    subgraph "Deploy Service"
        DeployAgent[DeployAgent]
        Adapter[Chain Adapter<br/>{chain_name}]
        Config[Chain Config]
    end
    
    subgraph "{chain_name} Network"
        RPC[RPC Endpoint]
        Explorer[Block Explorer]
        Contracts[Deployed Contracts]
    end
    
    DeployAgent --> Adapter
    Adapter --> Config
    Adapter --> RPC
    RPC --> Contracts
    Contracts -.-> Explorer
```"""
    
    def _generate_storage_architecture_diagram(self, title: str) -> str:
        """Generate storage/RAG architecture diagram."""
        return """```mermaid
graph TB
    subgraph "Storage Layer"
        Supabase[(Supabase<br/>PostgreSQL)]
        VectorDB[(VectorDB<br/>Pinecone)]
        Redis[(Redis<br/>Cache)]
        IPFS[IPFS/Filecoin<br/>Artifacts]
    end
    
    subgraph "RAG System"
        Embedder[Embedding Service]
        Retriever[Retrieval Engine]
        Index[Vector Index]
    end
    
    Embedder --> VectorDB
    Retriever --> Index
    Index --> VectorDB
    Retriever --> Supabase
    Retriever --> Redis
    Supabase --> IPFS
```"""
    
    def _generate_infra_architecture_diagram(self, title: str) -> str:
        """Generate infrastructure architecture diagram."""
        return """```mermaid
graph TB
    subgraph "CI/CD Pipeline"
        GitHub[GitHub Actions]
        Build[Docker Build]
        Test[Test Suite]
        Deploy[Deploy to Staging/Prod]
    end
    
    subgraph "Infrastructure"
        Containers[Docker Containers]
        Database[(Database)]
        Cache[(Redis)]
        Monitoring[Monitoring Stack]
    end
    
    GitHub --> Build
    Build --> Test
    Test --> Deploy
    Deploy --> Containers
    Containers --> Database
    Containers --> Cache
    Containers --> Monitoring
```"""
    
    def _generate_observability_diagram(self, title: str) -> str:
        """Generate observability architecture diagram."""
        return """```mermaid
graph TB
    subgraph "Application"
        Services[Services]
        Agents[Agents]
    end
    
    subgraph "Observability Stack"
        OTel[OpenTelemetry]
        Metrics[Prometheus]
        Traces[Jaeger/Tempo]
        Logs[Loki]
    end
    
    subgraph "Visualization"
        Grafana[Grafana Dashboards]
        MLflow[MLflow Experiments]
    end
    
    Services --> OTel
    Agents --> OTel
    OTel --> Metrics
    OTel --> Traces
    OTel --> Logs
    Metrics --> Grafana
    Traces --> Grafana
    Logs --> Grafana
    Services --> MLflow
```"""
    
    def _generate_security_architecture_diagram(self, title: str) -> str:
        """Generate security architecture diagram."""
        return """```mermaid
graph TB
    subgraph "Security Layers"
        Input[Input Validation]
        Auth[Authentication<br/>JWT/Auth0]
        Guardrails[Prompt Injection<br/>Guardrails]
        Audit[Static Analysis<br/>Slither/Mythril]
        Simulation[Tenderly<br/>Simulation]
    end
    
    subgraph "Security Tools"
        Slither[Slither]
        Mythril[Mythril]
        MythX[MythX]
        Tenderly[Tenderly]
    end
    
    Input --> Guardrails
    Auth --> Guardrails
    Guardrails --> Audit
    Audit --> Slither
    Audit --> Mythril
    Audit --> MythX
    Audit --> Simulation
    Simulation --> Tenderly
```"""

    def _generate_code_examples(self, area: Optional[str], issue_type: str, title: str) -> Optional[str]:
        """Generate code examples based on area and issue type."""
        if issue_type == "epic":
            return None  # Epics don't need code examples
        
        examples = []
        
        if area == "orchestration":
            if "FastAPI" in title or "API gateway" in title:
                examples.append("""**FastAPI Endpoint Example:**
```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from hyperagent.api.middleware.auth import get_current_user

router = APIRouter(prefix="/api/v1/workflows")

class WorkflowRequest(BaseModel):
    prompt: str
    chains: list[str]

@router.post("/")
async def create_workflow(
    request: WorkflowRequest,
    user: User = Depends(get_current_user)
):
    workflow = await orchestrator.create_workflow(
        prompt=request.prompt,
        chains=request.chains,
        workspace_id=user.workspace_id
    )
    return workflow
```""")
            
            if "LangGraph" in title or "orchestrator" in title:
                examples.append("""**LangGraph Workflow Example:**
```python
from langgraph.graph import StateGraph, END

workflow = StateGraph(ProjectState)

# Add nodes
workflow.add_node("spec", spec_agent)
workflow.add_node("generate", codegen_agent)
workflow.add_node("audit", audit_agent)

# Define edges
workflow.set_entry_point("spec")
workflow.add_edge("spec", "generate")
workflow.add_conditional_edges(
    "generate",
    should_audit,
    {"audit": "audit", "deploy": "deploy"}
)
workflow.add_edge("audit", "deploy")
workflow.add_edge("deploy", END)

# Compile and run
app = workflow.compile()
result = await app.ainvoke(initial_state)
```""")
            
            if "Supabase" in title or "schema" in title.lower():
                examples.append("""**Supabase Schema Example:**
```sql
-- Example table structure
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- RLS Policy
CREATE POLICY "Users can only see their workspace projects"
ON projects FOR SELECT
USING (workspace_id = current_setting('app.workspace_id')::uuid);
```""")
        
        elif area == "frontend":
            if "UI" in title or "flow" in title.lower() or "wizard" in title.lower():
                examples.append("""**Next.js Server Component Example:**
```typescript
// app/workflows/page.tsx
export default async function WorkflowsPage() {
  const workflows = await fetchWorkflows();
  
  return (
    <div>
      <h1>Workflows</h1>
      {workflows.map(workflow => (
        <WorkflowCard key={workflow.id} workflow={workflow} />
      ))}
    </div>
  );
}
```""")
            
            examples.append("""**Client Component with State:**
```typescript
// components/workflows/WorkflowProgress.tsx
"use client";

import { useWorkflowProgress } from "@/hooks/useWorkflowProgress";

export function WorkflowProgress({ workflowId }: { workflowId: string }) {
  const { progress, status } = useWorkflowProgress(workflowId);
  
  return (
    <div>
      <ProgressBar value={progress} />
      <StatusBadge status={status} />
    </div>
  );
}
```""")
        
        elif area == "agents":
            if "SpecAgent" in title or "RAG" in title:
                examples.append("""**RAG-based Agent Example:**
```python
from langchain.vectorstores import Pinecone
from langchain.embeddings import OpenAIEmbeddings

class SpecAgent:
    def __init__(self):
        self.vectorstore = Pinecone.from_existing_index(
            index_name="solidity-docs",
            embedding=OpenAIEmbeddings()
        )
    
    async def refine_spec(self, prompt: str):
        # Retrieve relevant docs
        docs = self.vectorstore.similarity_search(prompt, k=5)
        context = "\\n".join([d.page_content for d in docs])
        
        # Generate refined spec with context
        refined = await llm.generate(
            f"Context: {context}\\n\\nUser Prompt: {prompt}"
        )
        return refined
```""")
            
            if "CodeGenAgent" in title:
                examples.append("""**Code Generation Agent Example:**
```python
class CodeGenAgent:
    def __init__(self):
        self.router = MultiModelRouter()
    
    async def generate_contract(self, spec: str):
        # Route to appropriate model
        model = self.router.select_model("solidity_codegen")
        
        # Generate with RAG context
        code = await model.generate(
            prompt=spec,
            context=self.get_rag_context(spec)
        )
        
        return code
```""")
            
            if "AuditAgent" in title:
                examples.append("""**Audit Agent Example:**
```python
from slither import Slither

class AuditAgent:
    async def audit_contract(self, contract_path: str):
        slither = Slither(contract_path)
        results = slither.run_detectors()
        
        findings = []
        for detector in results:
            for finding in detector:
                findings.append({
                    "severity": finding.check,
                    "description": finding.description,
                    "line": finding.line
                })
        
        return findings
```""")
        
        elif area == "chain-adapter":
            examples.append("""**Chain Adapter Example:**
```python
from thirdweb import ThirdwebSDK

class ChainAdapter:
    def __init__(self, chain_id: int):
        self.sdk = ThirdwebSDK.from_private_key(
            private_key=os.getenv("PRIVATE_KEY"),
            chain_id=chain_id
        )
    
    async def deploy_contract(self, contract_name: str, constructor_params: dict):
        contract = await self.sdk.deployer.deploy_contract(
            contract_name,
            constructor_params
        )
        return contract.address
```""")
        
        elif area == "storage-rag":
            if "IPFS" in title or "Pinata" in title:
                examples.append("""**IPFS/Pinata Storage Example:**
```python
from pinata import PinataSDK

pinata = PinataSDK(api_key, secret_key)

# Upload to IPFS
result = pinata.pin_file_to_ipfs(
    file_path="contract.sol",
    pinata_metadata={"name": "MyContract"}
)

ipfs_hash = result["IpfsHash"]
```""")
            
            if "Pinecone" in title or "vector" in title.lower():
                examples.append("""**Pinecone Vector Store Example:**
```python
from pinecone import Pinecone

pc = Pinecone(api_key="your-api-key")
index = pc.Index("hyperagent-docs")

# Upsert vectors
index.upsert(vectors=[{
    "id": "doc-1",
    "values": embedding_vector,
    "metadata": {"title": "ERC20 Guide", "type": "docs"}
}])

# Query
results = index.query(
    vector=query_embedding,
    top_k=5,
    include_metadata=True
)
```""")
        
        elif area == "infra":
            if "Redis" in title or "worker" in title.lower():
                examples.append("""**Redis Worker Pool Example:**
```python
import redis
from rq import Queue

redis_conn = redis.Redis(host='localhost', port=6379)
task_queue = Queue('agent_tasks', connection=redis_conn)

# Enqueue agent task
job = task_queue.enqueue(
    'hyperagent.agents.codegen.generate',
    prompt=prompt,
    timeout=300
)
```""")
        
        elif area == "sdk-cli":
            examples.append("""**TypeScript SDK Example:**
```typescript
import { HyperAgentClient } from '@hyperagent/sdk';

const client = new HyperAgentClient({
  apiUrl: process.env.API_URL,
  apiKey: process.env.API_KEY
});

// Create workspace
const workspace = await client.createWorkspace({
  name: "My Workspace"
});

// Run pipeline
const run = await client.runPipeline({
  workspaceId: workspace.id,
  prompt: "Create ERC20 token",
  chains: ["mantle", "polygon"]
});
```""")
        
        if examples:
            return "\n\n".join(examples)
        return None

    def create_issue(
        self,
        title: str,
        labels: List[str],
        milestone: Optional[str] = None,
        body: Optional[str] = None,
        sprint: Optional[str] = None,
        chain: Optional[str] = None,
        preset: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Create a GitHub issue and return its data."""
        url = f"https://api.github.com/repos/{self.owner}/{self.repo}/issues"

        # Determine assignee based on area, issue type, and sprint
        area = next((l.split(":")[1] for l in labels if l.startswith("area:")), None)
        issue_type = next((l.split(":")[1] for l in labels if l.startswith("type:")), "feature")
        # Extract sprint from milestone or use provided sprint
        sprint_from_milestone = None
        if milestone and "Sprint" in milestone:
            import re
            sprint_match = re.search(r'Sprint (\d+)', milestone)
            if sprint_match:
                sprint_from_milestone = f"Sprint {sprint_match.group(1)}"
        assigned_owner = self._assign_owner(area, issue_type, sprint or sprint_from_milestone)
        
        # Generate body if not provided (body will include the assigned owner)
        if not body:
            body = self.generate_issue_body(title, labels, milestone, sprint, chain, preset)

        data: Dict[str, Any] = {
            "title": title,
            "labels": labels,
            "body": body,
        }

        # Assign issue to owner
        if assigned_owner:
            data["assignees"] = [assigned_owner]

        if milestone:
            milestone_num = self.get_milestone_number(milestone)
            if milestone_num:
                data["milestone"] = milestone_num

        response = requests.post(url, headers=self.headers, json=data)

        if response.status_code == 201:
            issue = response.json()
            logger.info(f"Created issue #{issue['number']}: {title}")
            return issue
        else:
            logger.error(f"Failed to create issue '{title}': {response.status_code} - {response.text}")
            # Handle rate limiting
            if response.status_code == 403 and "rate limit" in response.text.lower():
                logger.warning("Rate limit exceeded. Consider adding retry logic.")
            return None

    def add_issue_to_project(self, issue_node_id: str) -> Optional[str]:
        """Add an issue to the project and return the project item ID."""
        query = """
        mutation AddProjectV2ItemById($projectId: ID!, $contentId: ID!) {
          addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
            item {
              id
            }
          }
        }
        """

        variables = {
            "projectId": self.project_id,
            "contentId": issue_node_id,
        }

        response = requests.post(
            "https://api.github.com/graphql",
            headers=self.graphql_headers,
            json={"query": query, "variables": variables},
        )

        if response.status_code == 200:
            result = response.json()
            if "errors" in result:
                logger.error(f"GraphQL error adding issue to project: {result['errors']}")
                return None
            item_id = result["data"]["addProjectV2ItemById"]["item"]["id"]
            logger.debug(f"Added issue to project, item ID: {item_id}")
            return item_id
        else:
            logger.error(f"Failed to add issue to project: {response.status_code} - {response.text}")
            return None

    def get_field_options(self, field_id: str) -> Dict[str, str]:
        """Fetch options for a single-select field."""
        query = """
        query GetFieldOptions($projectId: ID!, $fieldId: ID!) {
          node(id: $projectId) {
            ... on ProjectV2 {
              field(id: $fieldId) {
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
        """
        variables = {"projectId": self.project_id, "fieldId": field_id}
        response = requests.post(
            "https://api.github.com/graphql",
            headers=self.graphql_headers,
            json={"query": query, "variables": variables},
        )
        if response.status_code == 200:
            result = response.json()
            if "errors" not in result and result.get("data", {}).get("node", {}).get("field"):
                options = result["data"]["node"]["field"].get("options", [])
                return {opt["name"]: opt["id"] for opt in options}
        return {}

    def update_project_field(
        self, item_id: str, field_id: str, value: Any, field_type: str = "text"
    ) -> bool:
        """Update a project field value."""
        field_value = value
        if field_type == "single_select":
            # For single select, we need the option ID
            # Try to fetch options and match by name
            options = self.get_field_options(field_id)
            option_id = options.get(str(value))
            if not option_id:
                logger.warning(f"Option '{value}' not found in field. Available: {list(options.keys())}")
                return False
            value_type = "singleSelectOptionId"
            field_value = option_id
        elif field_type == "text":
            value_type = "text"
        elif field_type == "number":
            value_type = "number"
        else:
            value_type = "text"

        query = """
        mutation UpdateProjectV2ItemFieldValue(
          $projectId: ID!
          $itemId: ID!
          $fieldId: ID!
          $value: ProjectV2FieldValue!
        ) {
          updateProjectV2ItemFieldValue(
            input: {
              projectId: $projectId
              itemId: $itemId
              fieldId: $fieldId
              value: $value
            }
          ) {
            projectV2Item {
              id
            }
          }
        }
        """

        # Build value object based on type
        if value_type == "singleSelectOptionId":
            value_obj = {"singleSelectOptionId": field_value}
        elif value_type == "text":
            value_obj = {"text": str(field_value)}
        elif value_type == "number":
            value_obj = {"number": float(field_value) if "." in str(field_value) else int(field_value)}
        else:
            value_obj = {"text": str(field_value)}

        variables = {
            "projectId": self.project_id,
            "itemId": item_id,
            "fieldId": field_id,
            "value": value_obj,
        }

        response = requests.post(
            "https://api.github.com/graphql",
            headers=self.graphql_headers,
            json={"query": query, "variables": variables},
        )

        if response.status_code == 200:
            result = response.json()
            if "errors" in result:
                logger.warning(f"Error updating field: {result['errors']}")
                return False
            return True
        else:
            logger.warning(f"Failed to update field: {response.status_code} - {response.text}")
            return False

    def process_issue(
        self,
        title: str,
        labels: List[str],
        milestone: str,
        sprint: str,
        chain: Optional[str] = None,
        preset: Optional[str] = None,
        skip_duplicates: bool = True,
    ) -> bool:
        """Create an issue and configure it in the project."""
        # Check for duplicates
        if skip_duplicates:
            duplicate = self.check_duplicate(title, milestone)
            if duplicate:
                logger.info(f"Skipping duplicate issue: '{title}' (already exists as #{duplicate['number']}: {duplicate['url']})")
                return True  # Return True because we successfully handled it (by skipping)
        
        # Generate comprehensive body
        body = self.generate_issue_body(title, labels, milestone, sprint, chain, preset)
        
        # Create the issue
        issue = self.create_issue(title, labels, milestone, body=body, sprint=sprint, chain=chain, preset=preset)
        if not issue:
            return False

        # Get issue node ID from REST API response (it's already included)
        issue_node_id = issue.get("node_id")
        if not issue_node_id:
            logger.error(f"Issue response missing node_id for issue #{issue.get('number', 'unknown')}")
            return False

        # Add to project
        item_id = self.add_issue_to_project(issue_node_id)
        if not item_id:
            logger.error(f"Could not add issue #{issue.get('number', 'unknown')} to project")
            return False

        # Update custom fields
        if "sprint" in self.field_ids and sprint:
            self.update_project_field(
                item_id, self.field_ids["sprint"], sprint, field_type="single_select"
            )

        # Extract type and area from labels
        issue_type = next((l.split(":")[1] for l in labels if l.startswith("type:")), None)
        issue_area = next((l.split(":")[1] for l in labels if l.startswith("area:")), None)

        # Use "Issue Type" field (GitHub Projects uses "Issue Type" not "Type")
        if "type" in self.field_ids and issue_type:
            self.update_project_field(
                item_id, self.field_ids["type"], issue_type, field_type="single_select"
            )

        if "area" in self.field_ids and issue_area:
            self.update_project_field(
                item_id, self.field_ids["area"], issue_area, field_type="single_select"
            )

        if "chain" in self.field_ids and chain:
            self.update_project_field(
                item_id, self.field_ids["chain"], chain, field_type="single_select"
            )

        if "preset" in self.field_ids and preset:
            self.update_project_field(
                item_id, self.field_ids["preset"], preset, field_type="single_select"
            )

        # Rate limiting: wait 1 second between issues
        time.sleep(1)
        return True



def parse_csv(filepath: str) -> List[Dict[str, Any]]:
    """Parse CSV file with issues."""
    issues = []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            labels = [l.strip() for l in row["labels"].split(",")]
            issues.append({
                "title": row["title"],
                "labels": labels,
                "milestone": row["milestone"],
                "sprint": row["sprint"],
                "chain": next((l.split(":")[1] for l in labels if l.startswith("chain:")), None),
                "preset": next((l.split(":")[1] for l in labels if l.startswith("preset:")), None),
            })
    return issues


def parse_yaml(filepath: str) -> List[Dict[str, Any]]:
    """Parse YAML file with issues."""
    with open(filepath, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
        issues = []
        for item in data.get("issues", []):
            labels = item.get("labels", [])
            issues.append({
                "title": item["title"],
                "labels": labels,
                "milestone": item["milestone"],
                "sprint": item["sprint"],
                "chain": next((l.split(":")[1] for l in labels if l.startswith("chain:")), None),
                "preset": next((l.split(":")[1] for l in labels if l.startswith("preset:")), None),
            })
        return issues


def main():
    parser = argparse.ArgumentParser(
        description="Create GitHub issues from CSV/YAML and link to Project 9"
    )
    parser.add_argument("--csv", help="Path to CSV file")
    parser.add_argument("--yaml", help="Path to YAML file")
    parser.add_argument("--dry-run", action="store_true", help="Validate without creating issues")
    parser.add_argument("--skip-duplicates", action="store_true", default=True, help="Skip issues that already exist (default: True)")
    parser.add_argument("--no-skip-duplicates", dest="skip_duplicates", action="store_false", help="Create issues even if duplicates exist")

    args = parser.parse_args()

    # Load configuration from environment
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
        logger.error("Missing required environment variables:")
        for var in missing:
            logger.error(f"  - {var}")
        logger.error("See script header for setup instructions.")
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

    # Parse input file
    if args.csv:
        issues = parse_csv(args.csv)
    elif args.yaml:
        issues = parse_yaml(args.yaml)
    else:
        logger.error("Must provide either --csv or --yaml")
        sys.exit(1)

    if args.dry_run:
        # Initialize automation for assignment testing
        codeowners_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "CODEOWNERS")
        automation = GitHubProjectAutomation(token, owner, repo, project_id, field_ids, codeowners_path)
        
        # Check for duplicates
        logger.info("Checking for existing issues...")
        existing_issues = automation.get_existing_issues()
        duplicates = []
        new_issues = []
        
        for issue in issues:
            duplicate = automation.check_duplicate(issue["title"], issue["milestone"])
            if duplicate:
                duplicates.append((issue["title"], duplicate))
            else:
                new_issues.append(issue)
        
        logger.info(f"Dry run: {len(issues)} issues in CSV")
        logger.info(f"  - {len(duplicates)} duplicates found (would be skipped)")
        logger.info(f"  - {len(new_issues)} new issues (would be created)")
        logger.info("")
        
        if duplicates:
            logger.info("Duplicate issues (would be skipped):")
            for title, dup_info in duplicates[:10]:
                logger.info(f"  - '{title[:60]}' → Already exists as #{dup_info['number']}: {dup_info['url']}")
            if len(duplicates) > 10:
                logger.info(f"  ... and {len(duplicates) - 10} more duplicates")
            logger.info("")
        
        # Count assignments by owner for NEW issues only
        assignment_counts = {"JustineDevs": 0, "ArhonJay": 0, "Tristan-T-Dev": 0}
        
        # Count all assignments for NEW issues first
        for issue in new_issues:
            area = next((l.split(":")[1] for l in issue["labels"] if l.startswith("area:")), None)
            issue_type = next((l.split(":")[1] for l in issue["labels"] if l.startswith("type:")), "feature")
            assigned_owner = automation._assign_owner(area, issue_type, issue.get("sprint"))
            assignment_counts[assigned_owner] = assignment_counts.get(assigned_owner, 0) + 1
        
        # Show first 10 NEW issues with assignment details
        if new_issues:
            logger.info("Sample NEW issues (first 10):")
            for i, issue in enumerate(new_issues[:10], 1):
                area = next((l.split(":")[1] for l in issue["labels"] if l.startswith("area:")), None)
                issue_type = next((l.split(":")[1] for l in issue["labels"] if l.startswith("type:")), "feature")
                assigned_owner = automation._assign_owner(area, issue_type, issue.get("sprint"))
                logger.info(f"  {i}. {issue['title'][:60]}")
                logger.info(f"     → Assigned to: {assigned_owner} (Area: {area}, Type: {issue_type})")
            
            if len(new_issues) > 10:
                logger.info(f"  ... and {len(new_issues) - 10} more new issues")
        else:
            logger.info("No new issues to create - all issues already exist!")
        
        logger.info("")
        logger.info("Assignment Distribution (for NEW issues only):")
        logger.info(f"  JustineDevs: {assignment_counts.get('JustineDevs', 0)} issues")
        logger.info(f"  ArhonJay: {assignment_counts.get('ArhonJay', 0)} issues")
        logger.info(f"  Tristan-T-Dev: {assignment_counts.get('Tristan-T-Dev', 0)} issues")
        logger.info("")
        logger.info("Dry run complete. No issues were created.")
        return

    # Initialize automation (reads CODEOWNERS from repo root)
    # CODEOWNERS is at repo root, not in scripts directory
    codeowners_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "CODEOWNERS")
    automation = GitHubProjectAutomation(token, owner, repo, project_id, field_ids, codeowners_path)

    # Process issues with progress tracking
    logger.info(f"Processing {len(issues)} issues...")
    if args.skip_duplicates:
        logger.info("Duplicate detection enabled - existing issues will be skipped")
    
    success_count = 0
    failed_count = 0
    skipped_count = 0
    
    for i, issue in enumerate(issues, 1):
        logger.info(f"[{i}/{len(issues)}] Processing: {issue['title'][:60]}...")
        result = automation.process_issue(
            issue["title"],
            issue["labels"],
            issue["milestone"],
            issue["sprint"],
            issue.get("chain"),
            issue.get("preset"),
            skip_duplicates=args.skip_duplicates,
        )
        if result:
            # Check if it was skipped (duplicate) or created
            duplicate = automation.check_duplicate(issue["title"], issue["milestone"])
            if duplicate and args.skip_duplicates:
                skipped_count += 1
            else:
                success_count += 1
        else:
            failed_count += 1

    logger.info(f"\n{'='*60}")
    logger.info(f"Summary:")
    logger.info(f"  Created: {success_count} issues")
    logger.info(f"  Skipped (duplicates): {skipped_count} issues")
    logger.info(f"  Failed: {failed_count} issues")
    logger.info(f"  Total processed: {len(issues)} issues")
    logger.info(f"{'='*60}")


if __name__ == "__main__":
    main()

