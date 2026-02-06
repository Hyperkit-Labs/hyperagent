# Scripts Directory

This directory contains automation scripts, documentation, and data files for the HyperAgent project.

## Directory Structure

```
scripts/
├── github/                    # GitHub automation scripts
│   ├── create_phase1_issues.py
│   ├── delete_all_issues.py
│   ├── fetch_project_ids.sh
│   └── README.md
├── docs/                      # Documentation
│   ├── github-automation/     # GitHub automation docs
│   ├── compliance/            # Compliance and standards
│   └── utilities/             # Utility script docs
├── data/                      # Data files
│   └── issues.csv
├── git/                       # Git automation
│   └── version/               # Version/commit automation
└── README.md                  # This file
```

## Quick Start

### GitHub Automation

Create Phase 1 issues:
```bash
cd scripts/github
python create_phase1_issues.py --csv ../data/issues.csv
```

See [github/README.md](github/README.md) for detailed instructions.

### Git Automation

Commit automation:
```bash
cd scripts/git/version
npm run commit
```

See [git/version/scripts/COMMIT_GUIDE.md](git/version/scripts/COMMIT_GUIDE.md) for details.

## Documentation

- **GitHub Automation**: [docs/github-automation/](docs/github-automation/)
- **Compliance**: [docs/compliance/](docs/compliance/)
- **Utilities**: [docs/utilities/](docs/utilities/)

## Organization Principles

This directory follows the file-organizer skill patterns:
- **By Type**: Scripts, docs, data separated
- **By Purpose**: GitHub, Git, utilities grouped
- **Clear Structure**: Easy to find and maintain

## Adding New Scripts

1. **GitHub automation** → `github/`
2. **Git automation** → `git/`
3. **Other utilities** → Create new category directory
4. **Documentation** → `docs/` in appropriate subdirectory
5. **Data files** → `data/`

Always include:
- README.md in script directory
- Documentation in `docs/`
- Follow AGENT.mdc patterns

