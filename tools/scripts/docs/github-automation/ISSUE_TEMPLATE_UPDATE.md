# Issue Template Update

## Summary

The `create_phase1_issues.py` script has been updated to generate comprehensive, detailed issue bodies following the standard task assignment template. All 57 issues for Sprint 1-3 will now include complete documentation.

## What Changed

### Before
- Issues were created with minimal bodies (1-2 lines)
- No structured information
- Missing delegation, skills, resources, etc.

### After
- Each issue includes all 10 sections of the template:
  1. Task Summary
  2. Goal & Desired Outcome
  3. Clear Delegation
  4. Skill & Scope Alignment
  5. Context & Resources
  6. Subtasks (Execution Plan)
  7. Risks, Blockers & Dependencies
  8. Resource & Environment Setup
  9. Tracking & Status Updates
  10. Review & Sign-off

## Template Sections Explained

### 1. Task Summary
- Title, Sprint, and Related Epic/Project
- Automatically populated from CSV data

### 2. Goal & Desired Outcome
- Goal description based on issue type and title
- Business/Product Impact contextualized by area
- Acceptance Criteria tailored to issue type (Epic, Feature, Chore)

### 3. Clear Delegation
- Owner: TBD (to be assigned during sprint planning)
- Deadline: Extracted from milestone date range
- Communication channel: Standard channels

### 4. Skill & Scope Alignment
- Required Skills: Determined by area (Frontend, Backend, Smart Contracts, etc.)
- Estimated Effort: Based on issue type (S/M/L)
- Scope Notes: Context-specific boundaries

### 5. Context & Resources
- User Story: Generated based on area and issue type
- Relevant Links: Links to spec docs, design files, tech docs
- Attachments: Placeholder for additional files

### 6. Subtasks (Execution Plan)
- Standard workflow: Define → Implement → Test → Docs → Demo
- Area-specific subtasks (e.g., UI components for frontend)

### 7. Risks, Blockers & Dependencies
- Dependencies: Identified based on area (e.g., frontend needs backend APIs)
- Blockers: None identified (to be updated during work)
- Risk Notes: Area-specific risks and mitigations

### 8. Resource & Environment Setup
- Repos/Services: Relevant repositories based on area
- Environment Variables: Required env vars for the task
- API Keys: Where to get access

### 9. Tracking & Status Updates
- Initial Status: To Do
- Checkpoints: Instructions for progress updates

### 10. Review & Sign-off
- Reviewers: TBD
- Review Checklist: Standard quality gates
- Sign-off: Placeholder for approval

## Context-Aware Generation

The body generation is intelligent and contextual:

### Issue Type Awareness
- **Epic**: Larger scope, multiple sprints, integration focus
- **Feature**: Standard implementation with tests and docs
- **Chore**: Simpler tasks, minimal breaking changes

### Area Awareness
- **Frontend**: UI/UX skills, design files, responsive design
- **Orchestration**: Backend/API, DevOps, state management
- **Agents**: LLM integration, RAG, model routing
- **Chain-Adapter**: Smart contracts, deployment, RPC config
- **Storage-RAG**: Vector DB, embeddings, knowledge bases
- **Infra**: CI/CD, Docker, deployment pipelines

### Chain/Preset Awareness
- Chain-specific environment variables
- Preset-specific dependencies
- Integration requirements

## Usage

The script works exactly the same way:

```bash
# Dry run to preview
cd scripts/github && python create_phase1_issues.py --csv ../data/issues.csv --dry-run

# Create issues with full bodies
cd scripts/github && python create_phase1_issues.py --csv ../data/issues.csv
```

## Example Generated Body

For a feature issue like "Implement FastAPI API gateway skeleton":

- **Goal**: Successfully implement FastAPI API gateway skeleton with full functionality
- **Skills**: Backend/API (FastAPI, Python), DevOps/Infra (CI/CD, Docker)
- **Effort**: M (Medium - 3-5 days)
- **Acceptance Criteria**: Implementation complete, unit tests, integration tests, error handling, docs updated
- **Subtasks**: Define requirements, implement, write tests, update docs, demo
- **Dependencies**: None identified (or area-specific)
- **Env Vars**: DATABASE_URL, REDIS_URL, ANTHROPIC_API_KEY, etc.

## Next Steps

1. Run the script to create issues with full bodies
2. Review generated issues for accuracy
3. Assign owners during sprint planning
4. Update blockers/dependencies as work progresses
5. Fill in reviewers when ready for review

## Customization

To customize the generated bodies, modify the helper methods in `GitHubProjectAutomation`:

- `_generate_goal()`: Customize goal descriptions
- `_generate_business_impact()`: Adjust impact statements
- `_generate_acceptance_criteria()`: Modify criteria per type/area
- `_generate_subtasks()`: Add area-specific subtasks
- `_get_required_skills()`: Update skill requirements
- `_get_required_env_vars()`: Add/remove environment variables

