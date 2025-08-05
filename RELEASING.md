# Release Process

This guide explains how to create a new release for @kadreio/mcp-coding-agents.

## Quick Release

```bash
# 1. Make sure you're on master with latest changes
git checkout master
git pull origin master

# 2. Run tests locally
npm test
npm run build

# 3. Update version in package.json
npm version patch  # or minor, major, prepatch, etc.

# 4. Push the commit and tag
git push origin master
git push origin --tags
```

The GitHub Actions workflow will automatically:
- Run tests
- Build the project  
- Publish to NPM
- Create a GitHub release

## Version Types

### Patch Release (1.0.0 → 1.0.1)
For bug fixes and minor updates:
```bash
npm version patch
```

### Minor Release (1.0.0 → 1.1.0)
For new features (backwards compatible):
```bash
npm version minor
```

### Major Release (1.0.0 → 2.0.0)
For breaking changes:
```bash
npm version major
```

### Pre-releases
For beta/alpha releases:
```bash
# Beta release
npm version prerelease --preid=beta  # 1.0.0 → 1.0.1-beta.0

# Alpha release  
npm version prerelease --preid=alpha  # 1.0.0 → 1.0.1-alpha.0

# RC release
npm version prerelease --preid=rc     # 1.0.0 → 1.0.1-rc.0
```

## NPM Distribution Tags

Tags are automatically determined from version:
- `v1.2.3` → `latest` (default)
- `v1.2.3-beta.1` → `beta`
- `v1.2.3-alpha.1` → `alpha`
- `v1.2.3-rc.1` → `rc`
- `v1.2.3-next.1` → `next`

## Manual Changelog Updates

Before creating a release, you may want to update CHANGELOG.md:

```bash
# Install standard-version globally (one time)
npm install -g standard-version

# Generate changelog without creating tag
standard-version --dry-run

# If it looks good, run it for real
standard-version

# Then push
git push origin master
git push origin --tags
```

## Troubleshooting

### Release Failed
1. Check GitHub Actions for error details
2. Fix the issue
3. Delete the tag locally and remotely:
   ```bash
   git tag -d v1.2.3
   git push origin :refs/tags/v1.2.3
   ```
4. Try again

### Wrong Version Published
If you need to unpublish (within 72 hours):
```bash
npm unpublish @kadreio/mcp-coding-agents@1.2.3
```

## Pre-release Workflow Example

```bash
# Start a pre-release cycle
npm version prerelease --preid=beta  # 1.1.0 → 1.2.0-beta.0
git push origin master --tags

# Subsequent beta releases
npm version prerelease  # 1.2.0-beta.0 → 1.2.0-beta.1
git push origin master --tags

# Final release
npm version major  # 1.2.0-beta.1 → 1.2.0
git push origin master --tags
```

## Checklist Before Release

- [ ] All tests passing locally
- [ ] Build completes successfully
- [ ] No uncommitted changes
- [ ] On master branch
- [ ] Branch is up to date with origin
- [ ] Version number makes sense
- [ ] CHANGELOG.md is updated (if manually maintaining)