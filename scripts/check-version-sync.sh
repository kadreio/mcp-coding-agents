#!/bin/bash

# Script to check if package.json version matches the latest git tag

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get package.json version
PACKAGE_VERSION=$(node -p "require('./package.json').version")

# Get latest git tag (removing 'v' prefix if present)
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [[ "$LATEST_TAG" == v* ]]; then
    TAG_VERSION="${LATEST_TAG:1}"
else
    TAG_VERSION="$LATEST_TAG"
fi

echo "Package.json version: $PACKAGE_VERSION"
echo "Latest git tag: $LATEST_TAG (version: $TAG_VERSION)"

# Check if they match
if [ "$PACKAGE_VERSION" == "$TAG_VERSION" ]; then
    echo -e "${GREEN}✅ Version and tag are in sync!${NC}"
    exit 0
else
    echo -e "${RED}❌ Version mismatch detected!${NC}"
    echo ""
    echo "To fix this, you can:"
    echo "1. If package.json is correct, create a new tag:"
    echo "   git tag v$PACKAGE_VERSION"
    echo "   git push origin v$PACKAGE_VERSION"
    echo ""
    echo "2. If the tag is correct, update package.json:"
    echo "   npm version $TAG_VERSION --no-git-tag-version"
    echo "   git add package.json package-lock.json"
    echo "   git commit -m \"fix: Sync package.json version with tag\""
    echo ""
    exit 1
fi