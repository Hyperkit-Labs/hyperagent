# Issue Template Refactored to Planning Layers

## Overview

The issue template has been refactored to follow internal planning layers, creating a cognitive reasoning flow that guides developers through problem-solving systematically.

## Planning Layers Structure

### Layer 1: Intent Parsing 🎯
**Understanding the Task**

- Task Title
- Primary Goal
- User Story / Context
- Business Impact
- Task Metadata (Sprint, Epic, Type, Area, Chain, Preset)

**Purpose**: Clearly define what needs to be done and why it matters.

### Layer 2: Knowledge Retrieval 📚
**Gathering Resources**

- Required Skills / Knowledge
- Estimated Effort
- Knowledge Resources (skills/, llm/, docs/)
- Architecture Context (diagrams)
- Code Examples & Patterns

**Purpose**: Identify what information, skills, and resources are needed to complete the task.

### Layer 3: Constraint Analysis ⚠️
**Identifying Limitations**

- Known Dependencies
- Technical Constraints
- Current Blockers
- Risk Assessment & Mitigations
- Resource Constraints (deadline, effort)

**Purpose**: Understand limitations, dependencies, and risks that affect implementation.

### Layer 4: Solution Generation 💡
**Designing Approach**

- Solution Approach
- Design Considerations
- Acceptance Criteria (Solution Validation)

**Purpose**: Design the high-level approach and validate the solution design.

### Layer 5: Execution Planning 📋
**Breaking Down Steps**

- Implementation Steps (concrete subtasks)
- Environment Setup
- Required Environment Variables
- Access & Credentials

**Purpose**: Break down the solution into actionable, concrete steps.

### Layer 6: Output Formatting & Validation ✅
**Delivery & Quality**

- Ownership & Collaboration
- Quality Gates
- Review Checklist
- Delivery Status

**Purpose**: Ensure quality delivery through proper validation and review processes.

## Benefits of Planning Layers Structure

1. **Cognitive Flow**: Follows natural problem-solving reasoning
2. **Systematic Approach**: Ensures all aspects are considered
3. **Better Planning**: Forces thinking through each layer before execution
4. **Reduced Errors**: Identifies constraints and risks early
5. **Clear Progression**: Each layer builds on the previous one

## Comparison with Previous Structure

### Previous (Task-Oriented)
- Task Summary
- Goal & Desired Outcome
- Clear Delegation
- Skill & Scope Alignment
- Context & Resources
- Subtasks
- Risks & Dependencies
- Resource Setup
- Tracking
- Review

### New (Planning Layers)
- **Layer 1**: Intent Parsing (What?)
- **Layer 2**: Knowledge Retrieval (What do I need?)
- **Layer 3**: Constraint Analysis (What limits me?)
- **Layer 4**: Solution Generation (How?)
- **Layer 5**: Execution Planning (What steps?)
- **Layer 6**: Output Formatting (How to validate?)

## Usage

The template is automatically generated when creating issues. Developers work through each layer systematically:

1. **Start with Layer 1**: Understand the task completely
2. **Move to Layer 2**: Gather all necessary resources
3. **Analyze Layer 3**: Identify constraints and risks
4. **Design in Layer 4**: Plan the solution approach
5. **Execute Layer 5**: Follow concrete implementation steps
6. **Validate Layer 6**: Ensure quality delivery

## Integration with AGENT.mdc

The template aligns with AGENT.mdc requirements:
- **Layer 2** explicitly references `.cursor/skills/` and `.cursor/llm/`
- **Layer 4** emphasizes following established patterns
- **Layer 6** ensures compliance with quality standards

This creates a natural workflow that enforces best practices while maintaining cognitive reasoning flow.

