# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

#### [CVE-2025-55182] - React Server Components Remote Code Execution (CRITICAL)

**Date**: December 2025  
**Severity**: Critical

- **Fixed**: Updated React from 19.2.0 to 19.2.1
- **Fixed**: Updated Next.js from 16.0.3 to 16.0.7
- **Fixed**: Updated `eslint-config-next` to match Next.js version
- **Fixed**: Updated reference `x402-starter-kit` package.json with patched versions

**Impact**: Critical vulnerability in React Server Components that could allow remote code execution under certain conditions.

**Action Required**: 
- Run `npm install` or `npm ci` in the `frontend/` directory
- Rebuild Docker images: `make up-build` or `docker-compose build frontend`

**References**:
- [Vercel Security Advisory](https://vercel.com/changelog/cve-2025-55182)
- [React GHSA](https://github.com/facebook/react/security/advisories)
- [Next.js GHSA](https://github.com/vercel/next.js/security/advisories)

See [SECURITY.md](./SECURITY.md) for detailed information.

---

## [1.0.0] - 2025-12-07

### Added

- Initial release of HyperAgent
- AI-powered smart contract generation and auditing
- Multi-chain deployment support (Mantle, Avalanche)
- ERC4337 Smart Account deployment support
- x402 payment gating middleware
- RAG system for template retrieval
- Comprehensive API with FastAPI backend
- Next.js frontend with real-time updates
- Docker Compose development environment
- CI/CD pipeline with GitHub Actions
- Comprehensive documentation

### Security

- Initial security policy and vulnerability reporting process
- Dependency scanning in CI/CD
- Security best practices documentation

