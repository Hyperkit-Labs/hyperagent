# GitHub Issue Template - Contributors Guide

This guide explains how to use the 6-Layer Planning Structure when creating or working on GitHub issues for HyperAgent.

## Overview

All issues in this repository follow a structured 6-layer planning approach. This ensures comprehensive planning, clear execution, and quality delivery. Whether you're creating a new issue or working on an existing one, follow this structure.

---

## 🎯 Layer 1: Intent Parsing
**What needs to be done?**

Before starting any work, clearly define the intent and scope.

**Task Title:**  
> Use clear, descriptive titles that explain what needs to be done

**Primary Goal:**  
> Describe the primary objective. What problem are we solving? What value are we delivering?

**User Story / Context:**  
> Format: "As a [user/developer/system], I want [goal] so that [benefit]"
> This helps understand the "why" behind the task

**Business Impact:**  
> Explain how completing this task impacts the product, users, or business goals

**Task Metadata:**
- **Sprint**: Current sprint number or TBD if not yet planned
- **Related Epic/Project**: Link to related epic or project (e.g., **GitHub Project 9**)
- **Issue Type**: Feature/Epic/Chore/Bug
- **Area**: frontend/orchestration/agents/chain-adapter/storage-rag/infra/sdk-cli/security/observability/contracts
- **Chain**: Blockchain network name if applicable
- **Preset**: Preset name if applicable

**Project Board (Required):**
- Add the issue to **GitHub Project 9** (Phase tracking)
- Apply a phase label (e.g., `phase:foundation` or `phase:1/2/3`) and set the appropriate milestone

**Contributor Action:**
- Fill in all metadata fields accurately
- Ensure the goal is clear and measurable
- Link to related issues or epics

---

## 📚 Layer 2: Knowledge Retrieval
**What information do I need?**

Before implementing, gather all necessary knowledge and resources.

**Required Skills / Knowledge:**
- [ ] List all skills needed (e.g., "FastAPI", "React", "Solidity", "LangGraph")
- [ ] Identify any skills you need to learn
- [ ] Note if you need mentorship or pairing

**Estimated Effort:**  
> S (Small - 1-2 days) / M (Medium - 3-5 days) / L (Large - 1+ weeks)
> Be realistic about time estimates

**Knowledge Resources:**
- [ ] Review `.cursor/skills/` for relevant patterns and best practices
- [ ] Check `.cursor/llm/docs/` for implementation examples and documentation
- [ ] Read Product spec: `docs/planning/0-Master-Index.md` (see [Planning Docs](../../docs/planning/) for details)
- [ ] Review design files / Figma (if available)
- [ ] Study tech docs / ADRs in `docs/adrs/` directory
- [ ] Review API / schema references for relevant services

**Architecture Context:**
**System Architecture Diagram:**

```mermaid
[Insert architecture diagram here if needed]
```

**Code Examples & Patterns:**
```[language]
[Reference existing code patterns or examples]
```

OR

> Review existing codebase for similar implementations in:
> - `apps/` for frontend patterns
> - `services/` for backend patterns
> - `libs/` for shared library patterns

**Contributor Action:**
- Check off resources as you review them
- Document any patterns you discover
- Ask questions in issue comments if something is unclear

---

## ⚠️ Layer 3: Constraint Analysis
**What constraints and dependencies exist?**

Identify what might block or limit your work.

**Known Dependencies:**
- [ ] List any work that must be completed first
- [ ] Note any external dependencies (APIs, services, libraries)
- [ ] Identify cross-team dependencies
- [ ] Mark as "None identified" if no dependencies

**Technical Constraints:**
> Document technical limitations, scope boundaries, or constraints:
> - Performance requirements
> - Compatibility requirements
> - Security constraints
> - Resource limitations

**Current Blockers:**
> Update this section as work progresses:
> - None identified (initial state)
> - List any blockers that arise
> - Note when blockers are resolved

**Risk Assessment & Mitigations:**
> Identify potential risks and how to mitigate them:
> - Technical risks (complexity, unknowns)
> - Integration risks (breaking changes)
> - Timeline risks (scope creep)
> - Mitigation strategies for each risk

**Resource Constraints:**
- **Deadline**: Date or TBD
- **Effort Estimate**: S/M/L (should match Layer 2 estimate)

**Contributor Action:**
- Be honest about dependencies and blockers
- Update blockers section as you discover them
- Communicate early if risks materialize

---

## 💡 Layer 4: Solution Generation
**How should this be implemented?**

Design the solution before coding.

**Solution Approach:**
> Describe the high-level approach:
> - Architecture decisions
> - Design patterns to use
> - Key design choices and rationale
> - Alternative approaches considered

**Design Considerations:**
- [ ] Follow established patterns from `.cursor/skills/`
- [ ] Maintain consistency with existing codebase
- [ ] Consider scalability and maintainability
- [ ] Ensure proper error handling
- [ ] Plan for testing and validation
- [ ] Consider security implications
- [ ] Think about observability and monitoring

**Acceptance Criteria (Solution Validation):**
- [ ] [Criterion 1 - e.g., "Feature works as specified"]
- [ ] [Criterion 2 - e.g., "All tests pass (80%+ coverage)"]
- [ ] [Criterion 3 - e.g., "Documentation updated"]
- [ ] [Criterion 4 - e.g., "Code review approved"]
- [ ] [Additional criteria specific to the task...]

**Contributor Action:**
- Get design reviewed before heavy implementation
- Ensure acceptance criteria are testable and measurable
- Update criteria if scope changes

---

## 📋 Layer 5: Execution Planning
**What are the concrete steps?**

Break down the work into actionable steps.

**Implementation Steps:**
1. [ ] [Step 1 - e.g., "Define requirements and API contracts"]
2. [ ] [Step 2 - e.g., "Set up development environment"]
3. [ ] [Step 3 - e.g., "Implement core functionality"]
4. [ ] [Step 4 - e.g., "Write unit tests (80%+ coverage)"]
5. [ ] [Step 5 - e.g., "Write integration tests"]
6. [ ] [Step 6 - e.g., "Update documentation"]
7. [ ] [Step 7 - e.g., "Code review and feedback"]
8. [ ] [Step 8 - e.g., "Demo and sign-off"]

**Environment Setup:**
**Repos / Services:**
- Backend repo: `hyperagent/` *(if applicable)*
- Frontend repo: `hyperagent/apps/hyperagent-web/` *(if applicable)*
- Infra / IaC repo: `hyperagent/infra/` *(if applicable)*

**Required Environment Variables:**
- `[ENV_VAR_1]=` (get from internal vault or `.env.example`)
- `[ENV_VAR_2]=` (get from internal vault or `.env.example`)
- [Additional env vars...]
- See `.env.example` for all available environment variables

**Contributor Action:**
- Check off steps as you complete them
- Update the issue with progress comments
- Ask for help if stuck on any step

---

## ✅ Layer 6: Output Formatting & Validation
**How do we ensure quality delivery?**

Ensure your work meets quality standards before submission.

**Ownership & Collaboration:**
- **Owner**: @[username] - The person responsible for implementation
- **Reviewer**: @[username] - Code reviewer (assigned during review)
- **Access Request**: @JustineDevs or @ArhonJay - For access to resources
- **Deadline**: [Date or TBD]
- **Communication**: 
  - Daily stand-up updates
  - GitHub issue comments for questions/updates
  - Slack/Discord for quick questions

**Quality Gates:**
- [ ] Code follows project style guide (see `.cursor/rules/rules.mdc`)
- [ ] All tests pass (unit, integration, e2e)
- [ ] Test coverage is 80%+ (check with coverage tools)
- [ ] No critical lint/security issues
- [ ] Documentation updated (README, code comments, ADRs if needed)
- [ ] Meets all acceptance criteria from Layer 4
- [ ] Follows production standards (see `.cursor/rules/production.mdc`)

**Review Checklist:**
- [ ] Code review approved by @[reviewer]
- [ ] CI/CD pipeline passes (GitHub Actions)
- [ ] Performance benchmarks met (if applicable)
- [ ] Security scan passes (no critical vulnerabilities)
- [ ] No breaking changes (or breaking changes documented)
- [ ] Migration scripts provided (if database changes)

**Delivery Status:**
- **Initial Status**: To Do
- **Progress Tracking**: 
  - Update status: To Do → In Progress → In Review → Done
  - Use issue comments for progress updates
  - Link to PRs as you create them
- **Sign-off**: Approved by @Hyperionkit on [YYYY-MM-DD]
- **PR Link**: [Link to merged PR(s)]

**Contributor Action:**
- Check off quality gates as you complete them
- Request review when all gates are met
- Update delivery status as work progresses
- Link PRs to the issue

---

## How to Use This Template

### For Issue Creators

1. **Copy this template** when creating a new issue
2. **Fill in each layer** with relevant information
3. **Be thorough** - more detail helps contributors
4. **Link related issues** and resources
5. **Set appropriate labels** and assignees (phase + area + type)
6. Ensure Project 9 automation can pick it up (see `docs/playbook/GitHub Project 9 Automation.md`)

### For Contributors

1. **Read the entire issue** before starting work
2. **Check off knowledge resources** as you review them
3. **Update blockers** if you encounter any
4. **Follow the implementation steps** in order
5. **Update progress** in issue comments
6. **Ensure quality gates** are met before requesting review

### For Reviewers

1. **Verify all layers** are addressed
2. **Check quality gates** are met
3. **Ensure acceptance criteria** are satisfied
4. **Provide constructive feedback** in comments
5. **Approve when ready** and update delivery status

---

## Best Practices

### Do's ✅
- Be specific and detailed in each layer
- Update the issue as you learn more
- Communicate blockers early
- Follow the established patterns
- Write tests before requesting review
- Document your changes

### Don'ts ❌
- Don't skip layers - they're all important
- Don't start coding without understanding constraints
- Don't ignore dependencies
- Don't skip tests or documentation
- Don't merge without review approval

---

## Getting Help

If you need help at any layer:

- **Questions about requirements**: Comment on the issue
- **Technical questions**: Ask in Slack/Discord or create a discussion
- **Access requests**: Contact @JustineDevs or @ArhonJay
- **Code review**: Request review from the assigned reviewer
- **Blockers**: Update the issue and tag the project lead

---

## Related Resources

- [Project Planning Docs](../../docs/planning/0-Master-Index.md)
- [Code Standards](.cursor/rules/rules.mdc)
- [Production Standards](.cursor/rules/production.mdc)
- [Contributing Guidelines](../../CONTRIBUTING.md)
- [Skills Documentation](.cursor/skills/)
- [LLM Context Documentation](.cursor/llm/)

---

**Remember**: This structure exists to help you succeed. Take time to fill it out properly, and it will guide you through successful implementation.
