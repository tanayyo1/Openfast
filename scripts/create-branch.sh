#!/bin/bash

# Helper script for creating feature branches
# Usage: ./scripts/create-branch.sh OAK-123 "add scheduler"

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validate arguments
if [ $# -lt 2 ]; then
    echo -e "${RED}Error: Missing arguments${NC}"
    echo "Usage: ./scripts/create-branch.sh <ISSUE_ID> <description>"
    echo "Example: ./scripts/create-branch.sh OAK-123 'add scheduler service'"
    exit 1
fi

ISSUE_ID=$1
DESCRIPTION=$2
BRANCH_TYPE=${3:-feature}  # Default to 'feature' if not specified

# Validate issue ID format
if [[ ! $ISSUE_ID =~ ^(LIN|RED|OAK)-[0-9]+$ ]]; then
    echo -e "${RED}Error: Invalid issue ID format${NC}"
    echo "Expected format: LIN-XXX, RED-XXX, or OAK-XXX (e.g., OAK-123)"
    exit 1
fi

# Validate branch type
VALID_TYPES=("feature" "bugfix" "hotfix" "docs" "refactor" "test")
if [[ ! " ${VALID_TYPES[@]} " =~ " ${BRANCH_TYPE} " ]]; then
    echo -e "${RED}Error: Invalid branch type${NC}"
    echo "Valid types: ${VALID_TYPES[*]}"
    exit 1
fi

# Convert description to kebab-case
BRANCH_DESC=$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')

# Create full branch name
BRANCH_NAME="${BRANCH_TYPE}/${ISSUE_ID}-${BRANCH_DESC}"

echo -e "${YELLOW}Creating branch: ${BRANCH_NAME}${NC}"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}Error: Not a git repository${NC}"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}Warning: You have uncommitted changes${NC}"
    read -p "Do you want to stash them? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git stash
        echo -e "${GREEN}Changes stashed${NC}"
    else
        echo -e "${RED}Please commit or stash your changes first${NC}"
        exit 1
    fi
fi

# Checkout main and pull latest
echo -e "${YELLOW}Switching to main and pulling latest changes...${NC}"
git checkout main || { echo -e "${RED}Error: Failed to checkout main${NC}"; exit 1; }
git pull origin main || { echo -e "${RED}Error: Failed to pull from origin${NC}"; exit 1; }

# Create and checkout new branch
echo -e "${YELLOW}Creating branch ${BRANCH_NAME}...${NC}"
git checkout -b "$BRANCH_NAME" || { echo -e "${RED}Error: Failed to create branch${NC}"; exit 1; }

echo -e "${GREEN}[OK] Successfully created branch: ${BRANCH_NAME}${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Make your changes"
echo "2. Run quality checks: npm run lint && npm run typecheck && npm run test:unit"
echo "3. Commit: git commit -m \"${ISSUE_ID}: Your description\""
echo "4. Push: git push origin ${BRANCH_NAME}"
echo "5. Create PR on GitHub"
