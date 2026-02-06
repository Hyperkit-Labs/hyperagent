#!/usr/bin/env python3
"""
Automated script to apply skill patterns across the HyperAgent codebase.

Usage:
    python scripts/apply_skills_patterns.py --check       # Dry run, show issues
    python scripts/apply_skills_patterns.py --fix         # Apply fixes
    python scripts/apply_skills_patterns.py --report      # Generate report
"""

import re
import ast
import sys
from pathlib import Path
from typing import List, Dict, Tuple
from dataclasses import dataclass
import argparse


@dataclass
class PatternIssue:
    """Represents a pattern violation"""
    file_path: str
    line_number: int
    issue_type: str
    description: str
    severity: str  # critical, high, medium, low
    fix_suggestion: str


class SkillPatternAnalyzer:
    """Analyzes code for skill pattern violations"""
    
    def __init__(self, root_dir: Path):
        self.root_dir = root_dir
        self.issues: List[PatternIssue] = []
    
    def analyze_all(self) -> List[PatternIssue]:
        """Run all analyses"""
        print("[*] Analyzing codebase for skill pattern violations...")
        
        # Backend patterns
        self.check_backend_async_patterns()
        self.check_backend_error_handling()
        self.check_wallet_signatures()
        
        # Frontend patterns
        self.check_barrel_imports()
        self.check_missing_dynamic_imports()
        
        # LLM patterns
        self.check_llm_prompts()
        
        return self.issues
    
    def check_backend_async_patterns(self):
        """Check for sequential awaits that could be parallel"""
        print("  [*] Checking backend async patterns...")
        
        backend_files = list((self.root_dir / "hyperagent").rglob("*.py"))
        
        for file_path in backend_files:
            try:
                content = file_path.read_text()
                lines = content.split('\n')
                
                # Look for consecutive await statements
                for i, line in enumerate(lines[:-1]):
                    if 'await ' in line and not line.strip().startswith('#'):
                        next_line = lines[i + 1]
                        if 'await ' in next_line and not next_line.strip().startswith('#'):
                            # Check if they could be parallelized
                            if not any(dep in line for dep in ['asyncio.gather', 'Promise.all']):
                                self.issues.append(PatternIssue(
                                    file_path=str(file_path.relative_to(self.root_dir)),
                                    line_number=i + 1,
                                    issue_type="async_sequential",
                                    description="Sequential awaits detected - could use asyncio.gather()",
                                    severity="high",
                                    fix_suggestion="Replace with: result1, result2 = await asyncio.gather(call1(), call2())"
                                ))
            except Exception as e:
                print(f"    [!] Error analyzing {file_path}: {e}")
    
    def check_backend_error_handling(self):
        """Check for generic exception handling"""
        print("  [*] Checking backend error handling...")
        
        backend_files = list((self.root_dir / "hyperagent").rglob("*.py"))
        
        for file_path in backend_files:
            try:
                content = file_path.read_text()
                lines = content.split('\n')
                
                for i, line in enumerate(lines):
                    # Check for bare except
                    if re.match(r'\s*except\s*:', line):
                        self.issues.append(PatternIssue(
                            file_path=str(file_path.relative_to(self.root_dir)),
                            line_number=i + 1,
                            issue_type="error_handling_generic",
                            description="Bare except clause - should catch specific exceptions",
                            severity="medium",
                            fix_suggestion="Use specific exceptions: except WalletError, except NetworkError"
                        ))
                    
                    # Check for generic Exception catch
                    if re.match(r'\s*except Exception as', line):
                        self.issues.append(PatternIssue(
                            file_path=str(file_path.relative_to(self.root_dir)),
                            line_number=i + 1,
                            issue_type="error_handling_generic",
                            description="Generic Exception catch - use specific exception types",
                            severity="medium",
                            fix_suggestion="Use custom exceptions from hyperagent/exceptions.py"
                        ))
            except Exception as e:
                print(f"    [!] Error analyzing {file_path}: {e}")
    
    def check_wallet_signatures(self):
        """Check for server-side private key usage"""
        print("  [*] Checking wallet signature patterns...")
        
        backend_files = list((self.root_dir / "hyperagent").rglob("*.py"))
        
        for file_path in backend_files:
            try:
                content = file_path.read_text()
                lines = content.split('\n')
                
                for i, line in enumerate(lines):
                    # Check for PRIVATE_KEY usage
                    if 'PRIVATE_KEY' in line and not line.strip().startswith('#'):
                        self.issues.append(PatternIssue(
                            file_path=str(file_path.relative_to(self.root_dir)),
                            line_number=i + 1,
                            issue_type="security_private_key",
                            description="Server-side private key usage detected (FORBIDDEN)",
                            severity="critical",
                            fix_suggestion="Remove PRIVATE_KEY. Use user wallet signatures only."
                        ))
                    
                    # Check for .env private key references
                    if 'getenv' in line and 'PRIVATE' in line and 'KEY' in line:
                        self.issues.append(PatternIssue(
                            file_path=str(file_path.relative_to(self.root_dir)),
                            line_number=i + 1,
                            issue_type="security_private_key",
                            description="Private key from environment detected (FORBIDDEN)",
                            severity="critical",
                            fix_suggestion="Remove private key usage. Implement user-signed transactions."
                        ))
            except Exception as e:
                print(f"    [!] Error analyzing {file_path}: {e}")
    
    def check_barrel_imports(self):
        """Check for barrel file imports in frontend"""
        print("  [*] Checking frontend barrel imports...")
        
        if not (self.root_dir / "frontend").exists():
            return
        
        frontend_files = list((self.root_dir / "frontend").rglob("*.tsx")) + \
                         list((self.root_dir / "frontend").rglob("*.ts"))
        
        barrel_patterns = [
            (r"from ['\"]lucide-react['\"]", "lucide-react/dist/esm/icons/"),
            (r"from ['\"]@mui/material['\"]", "@mui/material/"),
            (r"from ['\"]@emotion/react['\"]", "@emotion/react/"),
        ]
        
        for file_path in frontend_files:
            if 'node_modules' in str(file_path):
                continue
            
            try:
                content = file_path.read_text()
                lines = content.split('\n')
                
                for i, line in enumerate(lines):
                    for pattern, fix_prefix in barrel_patterns:
                        if re.search(pattern, line):
                            self.issues.append(PatternIssue(
                                file_path=str(file_path.relative_to(self.root_dir)),
                                line_number=i + 1,
                                issue_type="frontend_barrel_import",
                                description=f"Barrel import detected (loads entire library)",
                                severity="critical",
                                fix_suggestion=f"Use direct import: import Icon from '{fix_prefix}icon'"
                            ))
            except Exception as e:
                print(f"    [!] Error analyzing {file_path}: {e}")
    
    def check_missing_dynamic_imports(self):
        """Check for heavy components that should be dynamically imported"""
        print("  [*] Checking for missing dynamic imports...")
        
        if not (self.root_dir / "frontend").exists():
            return
        
        frontend_files = list((self.root_dir / "frontend").rglob("*.tsx"))
        heavy_components = ['Monaco', 'Editor', 'Chart', 'Graph', 'PDF', 'Viewer']
        
        for file_path in frontend_files:
            if 'node_modules' in str(file_path):
                continue
            
            try:
                content = file_path.read_text()
                
                # Check if file imports heavy components without dynamic()
                for component in heavy_components:
                    if component in content and 'dynamic(' not in content:
                        # Find the import line
                        lines = content.split('\n')
                        for i, line in enumerate(lines):
                            if f'import' in line and component in line and 'from' in line:
                                self.issues.append(PatternIssue(
                                    file_path=str(file_path.relative_to(self.root_dir)),
                                    line_number=i + 1,
                                    issue_type="frontend_missing_dynamic",
                                    description=f"Heavy component '{component}' should use dynamic import",
                                    severity="high",
                                    fix_suggestion="Use: const Component = dynamic(() => import('...'), { ssr: false })"
                                ))
                                break
            except Exception as e:
                print(f"    [!] Error analyzing {file_path}: {e}")
    
    def check_llm_prompts(self):
        """Check LLM prompt structure"""
        print("  [*] Checking LLM prompt patterns...")
        
        service_files = list((self.root_dir / "hyperagent" / "core" / "services").rglob("*.py"))
        
        for file_path in service_files:
            try:
                content = file_path.read_text()
                
                # Check for LLM calls without structured prompts
                if 'openai' in content or 'anthropic' in content or 'llm' in content.lower():
                    if 'prompt' in content.lower() and 'f"""' not in content:
                        self.issues.append(PatternIssue(
                            file_path=str(file_path.relative_to(self.root_dir)),
                            line_number=1,
                            issue_type="llm_unstructured_prompt",
                            description="LLM service without structured prompt template",
                            severity="medium",
                            fix_suggestion="Create prompt template in hyperagent/prompts/ with examples"
                        ))
            except Exception as e:
                print(f"    ⚠️  Error analyzing {file_path}: {e}")
    
    def generate_report(self) -> str:
        """Generate markdown report"""
        report = ["# Skill Pattern Analysis Report\n"]
        report.append(f"**Total Issues Found:** {len(self.issues)}\n")
        
        # Group by severity
        by_severity = {
            'critical': [],
            'high': [],
            'medium': [],
            'low': []
        }
        
        for issue in self.issues:
            by_severity[issue.severity].append(issue)
        
        for severity, issues in by_severity.items():
            if not issues:
                continue
            
            report.append(f"\n## {severity.upper()} Priority ({len(issues)} issues)\n")
            
            # Group by type
            by_type = {}
            for issue in issues:
                if issue.issue_type not in by_type:
                    by_type[issue.issue_type] = []
                by_type[issue.issue_type].append(issue)
            
            for issue_type, type_issues in by_type.items():
                report.append(f"\n### {issue_type.replace('_', ' ').title()} ({len(type_issues)} issues)\n")
                
                for issue in type_issues:
                    report.append(f"- **{issue.file_path}:{issue.line_number}**")
                    report.append(f"  - {issue.description}")
                    report.append(f"  - Fix: {issue.fix_suggestion}\n")
        
        return '\n'.join(report)


def main():
    parser = argparse.ArgumentParser(description='Apply skill patterns to codebase')
    parser.add_argument('--check', action='store_true', help='Check for issues (dry run)')
    parser.add_argument('--fix', action='store_true', help='Apply fixes automatically')
    parser.add_argument('--report', action='store_true', help='Generate markdown report')
    
    args = parser.parse_args()
    
    if not any([args.check, args.fix, args.report]):
        parser.print_help()
        sys.exit(1)
    
    root_dir = Path(__file__).parent.parent
    analyzer = SkillPatternAnalyzer(root_dir)
    
    # Analyze
    issues = analyzer.analyze_all()
    
    print(f"\n[=] Analysis complete: {len(issues)} issues found\n")
    
    # Print summary
    by_severity = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}
    for issue in issues:
        by_severity[issue.severity] += 1
    
    print("Severity breakdown:")
    print(f"  [!] Critical: {by_severity['critical']}")
    print(f"  [*] High: {by_severity['high']}")
    print(f"  [*] Medium: {by_severity['medium']}")
    print(f"  [+] Low: {by_severity['low']}")
    
    if args.report or args.check:
        report = analyzer.generate_report()
        
        if args.report:
            report_path = root_dir / "SKILL_PATTERN_ANALYSIS.md"
            report_path.write_text(report)
            print(f"\n[=] Report saved to: {report_path}")
        else:
            print("\n" + report)
    
    if args.fix:
        print("\n[*] Auto-fix not yet implemented. Please review issues and fix manually.")
        print("   Use the fix suggestions in the report to guide manual fixes.")
        return 1
    
    # Exit with error code if critical issues found
    if by_severity['critical'] > 0:
        print("\n[!] Critical issues found! These must be fixed immediately.")
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())

