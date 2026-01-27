# Contributing to HyperAgent

Thank you for your interest in contributing to HyperAgent! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Making Changes](#making-changes)
- [Testing Requirements](#testing-requirements)
- [Submitting Changes](#submitting-changes)
- [Code Style Guidelines](#code-style-guidelines)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Development environment set up (see [Developer Guide](./GUIDE/DEVELOPER_GUIDE.md))
- Access to the codebase and repository
- Understanding of HyperAgent architecture (see [Architecture Diagrams](./docs/ARCHITECTURE_DIAGRAMS.md))
- Familiarity with Python, async/await, and pytest

### Setting Up Development Environment

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/JustineDevs/HyperAgent.git
   cd Hyperkit_agent
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   pip install -r requirements-dev.txt  # If available
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Initialize database**
   ```bash
   alembic upgrade head
   ```

6. **Run tests to verify setup**
   ```bash
   pytest tests/ -v
   ```

## Development Workflow

HyperAgent follows a structured, test-driven development workflow. See [Standard Development Workflow](./.cursor/rules/dev-workflow.mdc) for complete details.

### Workflow Overview

1. **Understand the Requirement**
   - Read the issue or feature request
   - Review technical specification in `docs/complete-tech-spec.md`
   - Clarify any ambiguities

2. **Plan the Implementation**
   - Research affected files and services
   - Analyze impact on architecture (SOA, A2A, SOP patterns)
   - Create detailed implementation plan

3. **Project and Feature Scaffolding**
   - Create necessary boilerplate (agents, services, API endpoints)
   - Follow existing patterns and conventions

4. **Test-Driven Development**
   - Write tests first (unit, integration, or agent tests)
   - Ensure tests fail initially
   - Write code to make tests pass

5. **Implement the Solution**
   - Follow HyperAgent coding standards
   - Use ASCII symbols for CLI output (`[+]`, `[-]`, `[*]`)
   - Follow SOA patterns and A2A protocol
   - Handle errors gracefully

6. **Final Review and Verification**
   - Review edge cases
   - Verify agent SLA compliance
   - Run full test suite
   - Check for security issues

7. **Commit and Create Pull Request**
   - Write clear commit messages
   - Open PR with detailed description
   - Ensure CI/CD checks pass

## Making Changes

### Creating a Branch

```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### Branch Naming Convention

- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates
- `test/` - Test additions or updates

### Making Code Changes

1. **Follow Architecture Patterns**
   - **SOA**: Services should be stateless and composable
   - **A2A**: Use event bus for agent-to-agent communication
   - **SOP**: Follow service orchestration patterns

2. **Agent Development**
   - Define agents using `AgentDefinition` dataclass
   - Implement agent logic as services following `ServiceInterface`
   - Use event bus for agent communication
   - Respect agent timeouts and retry limits

3. **Service Development**
   - Services must implement `ServiceInterface` protocol
   - Register services in `ServiceRegistry`
   - Services should be stateless and composable
   - Use dependency injection for external dependencies

4. **Blockchain Integration**
   - Support EVM multichain deployments (Mantle-first, then Base/Arbitrum/etc.)
   - Integrate EigenDA for data availability when needed
   - Never hardcode private keys (use environment variables)

## Testing Requirements

### Test Types

1. **Unit Tests**
   - Test isolated logic (functions, methods, utilities)
   - Mock external dependencies (LLM, blockchain, Redis)
   - Location: `tests/unit/`
   - Run: `pytest tests/unit/ -v`

2. **Integration Tests**
   - Test service interactions and workflows
   - Use real database connections (test database)
   - Mock external services
   - Location: `tests/integration/`
   - Run: `pytest tests/integration/ -v`

3. **Agent Tests**
   - Test complete agent workflows
   - Verify inputs/outputs match AgentDefinition
   - Test error handling and retries
   - Verify SLA compliance
   - Location: `tests/agents/`
   - Run: `pytest tests/agents/ -v`

### Writing Tests

```python
# Example unit test
import pytest
from hyperagent.agents.generation import GenerationAgent

@pytest.mark.asyncio
async def test_generation_agent():
    """Test contract generation from NLP input"""
    agent = GenerationAgent(...)
    result = await agent.process({
        "nlp_description": "Create ERC20 token",
        "network": "mantle_testnet"
    })
    assert result["status"] == "success"
    assert "contract_code" in result
```

### Test Coverage

- Aim for 80%+ code coverage
- Focus on core business logic
- Test error scenarios and edge cases
- Verify agent SLA compliance

## Submitting Changes

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `docs`: Documentation changes
- `test`: Test additions or updates
- `chore`: Maintenance tasks

**Examples**:
```
feat(agent-generation): Add support for ERC1155 contract generation
fix(agent-audit): Resolve Slither timeout issue
refactor(soa): Improve service orchestration pattern
test(agent-deployment): Add integration tests for Mantle deployment
docs(readme): Update installation instructions
```

### Pull Request Process

1. **Update your branch**
   ```bash
   git checkout main
   git pull origin main
   git checkout feature/your-feature-name
   git rebase main
   ```

2. **Run tests and linting**
   ```bash
   # Backend
   pytest tests/ -v
   black --check hyperagent/
   isort --check-only hyperagent/
   mypy hyperagent/
   
   # Frontend
   cd frontend
   npm ci
   npm run lint
   npm run format:check
   npm test
   ```

3. **Create Pull Request**
   - Use the [Pull Request Template](.github/pull_request_template.md) - automatically loaded when creating PR
   - Use clear, descriptive title following conventional commits
   - Link to related issue or feature request using `Closes #issue_number`
   - Describe changes in detail
   - List affected agents/services
   - Include test coverage information
   - Note any breaking changes
   - Complete all checklist items in the PR template

4. **PR Requirements**
   - All CI checks must pass (see [Branch Protection](./docs/BRANCH_PROTECTION.md))
   - 2+ reviewers must approve (CODEOWNERS file auto-assigns reviewers)
   - Code must follow style guidelines (Black, isort, ESLint, Prettier)
   - Tests must pass with 80%+ coverage (enforced in CI)
   - Documentation must be updated if needed
   - No hardcoded secrets or credentials
   - Security scan must pass (Bandit, Trivy)

5. **Respond to Review**
   - Address review comments promptly
   - Make requested changes
   - Update PR description if needed
   - Re-request review when ready

### Code Owners

The repository uses a [CODEOWNERS file](.github/CODEOWNERS) to automatically assign reviewers based on code paths. Reviewers are automatically requested when you open a PR.

**How it works:**
- GitHub automatically requests reviews from code owners based on file paths
- Different code areas have different owners (backend, frontend, tests, docs)
- At least 2 approvals are required, including from code owners

### Required CI Checks

Before merging, the following checks must pass:

**Code Quality:**
- `[*] Code Quality Checks` - Black, isort, MyPy type checking
- `[*] Frontend Code Quality` - ESLint, Prettier formatting

**Security:**
- `[*] Security Scan` - Bandit (Python), Trivy (vulnerability scanning)

**Testing:**
- `[TEST] Unit Tests` - 80%+ coverage required (job fails if below threshold)
- `[TEST] Integration Tests` - Full integration test suite
- `[TEST] Frontend Tests` - Frontend test suite (Jest)

**Build & Deployment:**
- `[BUILD] Docker Image` - Docker image builds successfully
- `[TEST] Docker Compose Integration` - Services start and health checks pass

**See [Branch Protection Documentation](./docs/BRANCH_PROTECTION.md) for complete setup instructions and troubleshooting.**

## Code Style Guidelines

### Python Style

- Follow **PEP 8** Python style guide
- Use **type hints** for all function signatures
- Write **comprehensive docstrings** for public APIs
- Use **async/await** for all I/O operations

### CLI Output

- Use **ASCII symbols** instead of emojis:
  - `[+]` for success
  - `[-]` for error
  - `[*]` for information
  - `[!]` for warning
  - `[...]` for processing/waiting

### Code Comments

- Explain **WHY**, not **WHAT**
- Use comments for non-obvious logic
- Keep comments up-to-date with code changes

### Example

```python
def generate_contract(
    nlp_input: str,
    network: str,
    contract_type: str = "ERC20"
) -> Dict[str, Any]:
    """
    Generate a Solidity contract from natural language input.
    
    This function uses the GenerationAgent to parse user intent and
    produce audited, deployment-ready smart contracts.
    
    Args:
        nlp_input: Natural language description of contract requirements
        network: Target blockchain (e.g., "mantle_testnet")
        contract_type: Type of contract to generate (default: "ERC20")
        
    Returns:
        Dict containing contract_code, abi, and metadata
        
    Raises:
        ValueError: If network is not supported or input is empty
        TimeoutError: If generation exceeds SLA timeout
    """
    # Implementation
```

## Documentation

### When to Update Documentation

- New features or capabilities
- API changes
- Architecture changes
- Configuration changes
- Breaking changes

### Documentation Standards

- Follow [Documentation Standards](./.cursor/rules/Documentation.mdc)
- Use Diátaxis framework (Tutorials, How-To, Explanation, Reference)
- Keep examples current and tested
- Update related documentation together

### Documentation Locations

- **User Guides**: `GUIDE/` directory
- **Technical Docs**: `docs/` directory
- **API Reference**: `GUIDE/API.md`
- **Architecture**: `docs/ARCHITECTURE_DIAGRAMS.md`

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open a GitHub Issue with `bug` label
- **Feature Requests**: Open a GitHub Issue with `enhancement` label
- **Documentation Issues**: Open a GitHub Issue with `docs` label
- **Security Issues**: Do not open a public issue. Contact the maintainers privately.

## Recognition

Contributors will be:

- Listed in project documentation
- Credited in release notes
- Acknowledged in the project README
- Invited to join the maintainer team (for significant contributions)

Thank you for contributing to HyperAgent! 🚀

---

**Last Updated**: 2025-11-18  
**Maintained By**: HyperAgent Team

