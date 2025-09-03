#!/bin/bash

# Release helper script for @kadreio/mcp-coding-agents

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're on master branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "master" ] && [ "$CURRENT_BRANCH" != "main" ]; then
    print_error "You must be on master/main branch to release. Current branch: $CURRENT_BRANCH"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    print_error "You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Pull latest changes
print_info "Pulling latest changes..."
git pull origin $CURRENT_BRANCH

# Check version sync before proceeding
print_info "Checking version sync..."
if ! ./scripts/check-version-sync.sh; then
    print_error "Version sync check failed. Please fix the version mismatch before releasing."
    exit 1
fi

# Run tests
print_info "Running tests..."
npm test

# Run build
print_info "Building project..."
npm run build

# Get version type from argument
VERSION_TYPE=${1:-patch}

# Show current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_info "Current version: $CURRENT_VERSION"

# Preview new version
if [[ "$VERSION_TYPE" == "pre"* ]]; then
    print_info "Creating pre-release version..."
    NEW_VERSION=$(npm version $VERSION_TYPE --preid=${2:-beta} --no-git-tag-version | sed 's/^v//')
else
    NEW_VERSION=$(npm version $VERSION_TYPE --no-git-tag-version | sed 's/^v//')
fi

# Reset the version change
git checkout -- package.json package-lock.json

print_info "New version will be: $NEW_VERSION"
echo ""
read -p "Do you want to proceed with this release? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warn "Release cancelled"
    exit 0
fi

# Create version and tag
print_info "Creating version $NEW_VERSION..."
npm version $VERSION_TYPE ${2:+--preid=$2}

# Push changes and tag
print_info "Pushing to origin..."
git push origin $CURRENT_BRANCH
git push origin --tags

print_info "✅ Release tag v$NEW_VERSION created and pushed!"
print_info "GitHub Actions will now:"
print_info "  - Run tests"
print_info "  - Build the project"
print_info "  - Publish to NPM"
print_info "  - Create GitHub release"
echo ""
print_info "Monitor the release at: https://github.com/kadreio/mcp-coding-agents/actions"