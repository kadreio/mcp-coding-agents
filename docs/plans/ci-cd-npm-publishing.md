---

Created Date 2025-08-05

# Feature Plan: Automated CI/CD Pipeline for NPM Publishing with Semantic Versioning

# Overview

Currently, the @kadreio/mcp-coding-agents package is published manually to NPM. This requires manual version bumping, building, testing, and publishing steps. By implementing an automated CI/CD pipeline, we can streamline releases, ensure consistent versioning following semantic versioning principles, and reduce the risk of human error during the release process. The pipeline will automatically determine version bumps based on commit messages, run tests, build the package, and publish to NPM when changes are merged to the main branch.

# Outcomes

- Automated version bumping based on conventional commit messages
- Automated NPM publishing on successful merges to master branch
- Consistent semantic versioning across all releases
- Automated changelog generation
- Automated GitHub releases with release notes
- Pre-release support for beta/alpha versions
- Comprehensive testing before each release
- Zero manual intervention required for standard releases

# Open Questions

[x] Which semantic versioning tool should we use? (semantic-release, standard-version, release-it, or custom)

**Decision: Tag-based with standard-version for local version management**

[x] Should we enforce conventional commits or make it optional with manual version override?

**Decision: Recommended but not enforced, use conventional commits for changelog generation**

[x] How should we handle pre-release versions (alpha, beta, rc)?

**Decision: Manual tags with pre-release suffixes (v1.2.0-beta.1)**

[x] Should we publish on every merge to master or only on explicit release triggers?

**Decision: Only on explicit tag pushes (v* tags)**

[x] Do we want to support multiple release channels (latest, next, beta)?

**Decision: Yes, using npm dist-tags based on tag format**

[x] Should we generate GitHub releases in addition to NPM releases?

**Decision: Yes, automatically create GitHub releases from tags**

[x] How do we want to handle the changelog format and where should it be stored?

**Decision: CHANGELOG.md using Keep a Changelog format, generated with standard-version**

[x] Should we sign commits and releases with GPG?

**Decision: Optional, not required initially**

[x] Do we want to implement a manual approval step for major version bumps?

**Decision: Not needed since all releases are manual tags**

[x] Should we implement automated dependency updates (Dependabot/Renovate)?

**Decision: Yes, using Renovate for automated dependency PRs**

# Tasks

## Initial Setup

[ ] Create `.github/workflows` directory structure
[ ] Set up NPM automation token in GitHub repository secrets
[ ] Choose and configure semantic versioning tool
[ ] Set up commit message linting (commitlint + husky)
[ ] Create release configuration file

## CI Pipeline (Build & Test)

[ ] Create `ci.yml` workflow for pull requests
[ ] Configure Node.js environment setup (multiple versions if needed)
[ ] Implement dependency caching for faster builds
[ ] Add build step with TypeScript compilation
[ ] Add linting step (ESLint/Prettier if applicable)
[ ] Add unit test execution with coverage reporting
[ ] Add integration test execution
[ ] Configure test result reporting in PR comments
[ ] Add bundle size analysis and reporting

## CD Pipeline (Release & Publish)

[ ] Create `release.yml` workflow for master branch
[ ] Implement version determination based on commit messages
[ ] Add automated changelog generation
[ ] Configure NPM publishing with proper authentication
[ ] Set up GitHub release creation with assets
[ ] Implement git tagging with version numbers
[ ] Add post-release notifications (Discord/Slack webhook if desired)
[ ] Configure release branch protection rules

## Semantic Versioning Setup

[ ] Install and configure conventional-changelog tooling
[ ] Create `.versionrc` or `release.config.js` configuration
[ ] Define commit message conventions in CONTRIBUTING.md
[ ] Set up commit message validation hooks
[ ] Configure version bump rules (feat→minor, fix→patch, BREAKING→major)
[ ] Implement pre-release version handling

## Documentation & Developer Experience

[ ] Update README with CI/CD badges
[ ] Document release process for maintainers
[ ] Create CONTRIBUTING.md with commit conventions
[ ] Add example conventional commits to documentation
[ ] Create troubleshooting guide for failed releases
[ ] Document manual release override process

## Testing & Validation

[ ] Test dry-run releases without publishing
[ ] Validate version bumping logic with various commit types
[ ] Test pre-release version workflows
[ ] Verify NPM package contents before automation
[ ] Test rollback procedures for failed releases

# Security

- **NPM Token Security**: Use NPM automation tokens with minimal required permissions, stored in GitHub Secrets
- **Branch Protection**: Protect master branch to ensure all changes go through PR review
- **GITHUB_TOKEN Permissions**: Use minimal required permissions for GitHub Actions
- **Dependency Security**: Implement automated security scanning for dependencies
- **Signed Releases**: Consider implementing GPG signing for git tags and commits
- **Audit Trail**: Ensure all automated actions are properly logged and traceable
- **Secret Rotation**: Implement process for regular rotation of NPM tokens
- **Third-party Action Security**: Pin GitHub Actions to specific versions/commits

# Implementation Details

## Recommended Tooling Stack

1. **Semantic Release Tool**: `semantic-release`
   - Most mature and widely adopted
   - Extensive plugin ecosystem
   - Built-in support for multiple release channels

2. **Commit Linting**: `@commitlint/cli` + `@commitlint/config-conventional`
   - Enforces conventional commit format
   - Integrates with husky for pre-commit hooks

3. **Changelog Generation**: `@semantic-release/changelog`
   - Automatic CHANGELOG.md updates
   - Customizable format

4. **GitHub Actions**: Native GitHub CI/CD
   - Free for public repositories
   - Good NPM integration
   - Supports matrix builds

## Version Bumping Logic

```
BREAKING CHANGE: → Major version (1.0.0 → 2.0.0)
feat:           → Minor version (1.0.0 → 1.1.0)
fix:            → Patch version (1.0.0 → 1.0.1)
docs:           → No version bump
style:          → No version bump
refactor:       → No version bump
perf:           → Patch version
test:           → No version bump
chore:          → No version bump
```

## Release Channels

- `master` → `latest` tag on NPM
- `next` → `next` tag on NPM (for pre-releases)
- `beta` → `beta` tag on NPM (for beta testing)

# Rollback Strategy

In case of failed or problematic releases:

1. Revert the merge commit on master
2. Force push to remove the problematic commit (if necessary)
3. Delete the problematic git tag
4. Unpublish the NPM version (within 72 hours)
5. Manually publish previous version if needed

# Monitoring & Alerts

- Set up GitHub Actions failure notifications
- Monitor NPM download statistics
- Track bundle size over time
- Alert on security vulnerabilities in dependencies