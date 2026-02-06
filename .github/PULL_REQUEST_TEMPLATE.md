## 📋 Description

<!-- Provide a clear and concise description of your changes -->

## 🔗 Related Issues

Closes #ISSUE_NUMBER

<!-- Link related issues:
- Closes #123
- Relates to #456
- Part of #789
-->

## 🏷️ Type of Change

<!-- Check all that apply -->

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] 🔧 Chore (dependency update, refactoring, etc.)
- [ ] 🎨 UI/UX improvement
- [ ] ⚡ Performance improvement
- [ ] 🔒 Security fix
- [ ] 🚀 CI/CD improvement

## ✅ Checklist

<!-- Check all completed items -->

### Code Quality

- [ ] My code follows the style guidelines of this project (ruff, black, isort for Python; ESLint for TypeScript)
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings or errors

### Testing

- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes (`pytest`, `npm test`)
- [ ] I have tested this on my local environment

### Documentation

- [ ] I have updated relevant documentation (README, API docs, comments)
- [ ] I have updated the CHANGELOG.md (if applicable)
- [ ] I have added or updated type hints/annotations

### Dependencies

- [ ] I have reviewed and updated dependencies if needed
- [ ] No new security vulnerabilities introduced (checked with `pip-audit` or `npm audit`)

## 🧪 Testing

<!-- Describe the tests you ran to verify your changes -->

### Test Coverage

```bash
# Add test coverage output here
pytest --cov=hyperagent tests/
# or
npm test -- --coverage
```

### Manual Testing Steps

1. Step 1
2. Step 2
3. Step 3

### Test Environment

- OS: [e.g., Ubuntu 22.04, macOS 14, Windows 11]
- Python version: [e.g., 3.12]
- Node version: [e.g., 20.x]
- Browser (if applicable): [e.g., Chrome 120, Firefox 121]

## 📸 Screenshots (if applicable)

<!-- Add screenshots for UI changes -->

| Before | After |
|--------|-------|
| ![Before]() | ![After]() |

## 🚀 Deployment Notes

<!-- Any special deployment considerations? Database migrations? Environment variables? -->

- [ ] Requires database migration
- [ ] Requires new environment variables (documented in `.env.example`)
- [ ] Requires external service configuration
- [ ] Backward compatible
- [ ] Requires coordination with other services

### Environment Variables Added/Changed

```bash
# Add any new environment variables here
NEW_VAR=value
```

## 📝 Reviewer Notes

<!-- Anything specific reviewers should focus on? Areas of concern? Alternative approaches considered? -->

### Areas of Focus

- [ ] Logic in `file.py:100-150`
- [ ] Performance of database queries
- [ ] Security implications of auth changes
- [ ] API contract changes

### Questions for Reviewers

1. Question 1?
2. Question 2?

## 🔄 Migration Guide (if breaking change)

<!-- How should users migrate from the old API/behavior to the new one? -->

```typescript
// Before
const result = oldAPI();

// After
const result = newAPI({ newParam: true });
```

## 🎯 Related Documentation

<!-- Link to related docs, RFCs, design specs, etc. -->

- [HyperAgent Spec](../docs/HyperAgent%20Spec.md)
- [Architecture Decision Record (ADR)](../docs/adr/XXX-title.md)
- [Figma Design](https://figma.com/file/...)

---

<!-- 
Thank you for contributing to HyperAgent! 🚀

Please ensure:
1. All CI checks pass
2. Code owners have approved (check CODEOWNERS)
3. Branch is up-to-date with base branch
4. All conversations are resolved
-->
