# Security Policy

## Supported Versions

We actively maintain and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Security Advisories

### CVE-2025-55182 - React Server Components Remote Code Execution (CRITICAL)

**Date**: December 2025  
**Severity**: Critical  
**Status**: ✅ Patched

#### Summary

A critical-severity vulnerability in React Server Components (CVE-2025-55182) affects React 19 and frameworks that use it, including Next.js (CVE-2025-66478). Under certain conditions, specially crafted requests could lead to unintended remote code execution.

**Reference**: [Vercel Security Advisory](https://vercel.com/changelog/cve-2025-55182)

#### Affected Versions

- **React**: 19.0.0, 19.1.0, 19.1.1, 19.2.0
- **Next.js**: ≥14.3.0-canary.77, ≥15.0.0, ≥16.0.0 (before 16.0.7)

#### Resolution

**Fixed in**:
- **React**: 19.0.1, 19.1.2, **19.2.1** ✅
- **Next.js**: 15.0.5, 15.1.9, 15.2.6, 15.3.6, 15.4.8, 15.5.7, 15.6.0-canary.58, **16.0.7** ✅

**Action Taken**:
- ✅ Updated `frontend/package.json`: React 19.2.0 → 19.2.1
- ✅ Updated `frontend/package.json`: Next.js 16.0.3 → 16.0.7
- ✅ Updated `reference/x402-starter-kit/package.json`: React 19.2.0 → 19.2.1, Next.js 16.0.1 → 16.0.7
- ✅ Updated `eslint-config-next` to match Next.js version

**Immediate Action Required**:
1. Update dependencies: `npm install` or `npm ci` in the `frontend/` directory
2. Rebuild Docker images: `make up-build` or `docker-compose build frontend`
3. Verify versions: `npm list react react-dom next` should show patched versions

#### Impact

Applications using affected versions may process untrusted input in a way that allows an attacker to perform remote code execution. The vulnerability affects React Server Components implementations in:
- `react-server-dom-parcel`
- `react-server-dom-webpack`
- `react-server-dom-turbopack`

#### Additional Recommendations

- Do not rely solely on WAF/CDN protection; upgrade to patched versions
- Review and audit any custom React Server Components implementations
- Monitor for additional security advisories from React and Next.js teams

## Reporting a Vulnerability

If you discover a security vulnerability, please **DO NOT** open a public issue. Instead, please report it via one of the following methods:

1. **Email**: Send details to [security@yourdomain.com] (replace with actual security contact)
2. **GitHub Security Advisory**: Use GitHub's private vulnerability reporting feature
3. **Direct Contact**: Contact the maintainers directly

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if available)
- Your contact information

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: Depends on severity and complexity

## Security Best Practices

1. **Keep Dependencies Updated**: Regularly update all dependencies to latest patched versions
2. **Use Dependency Scanning**: Run `npm audit` and `npm audit fix` regularly
3. **Review Security Advisories**: Monitor security feeds for React, Next.js, and other dependencies
4. **Follow Principle of Least Privilege**: Limit access and permissions where possible
5. **Input Validation**: Always validate and sanitize user inputs
6. **Secure Configuration**: Never commit secrets, API keys, or private keys to version control
7. **Regular Security Audits**: Conduct periodic security reviews and penetration testing

## Dependency Security

### Automated Scanning

We use automated dependency scanning in CI/CD:

```bash
# Frontend
cd frontend && npm audit

# Backend
pip-audit  # or safety check
```

### Manual Checks

Regularly check for security updates:

```bash
# Check for outdated packages
npm outdated

# Check for known vulnerabilities
npm audit

# Update dependencies
npm update
```

## Additional Resources

- [React Security](https://react.dev/learn/escape-hatches)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

**Last Updated**: December 2025  
**Maintained By**: HyperAgent Security Team

