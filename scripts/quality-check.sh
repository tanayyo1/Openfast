#!/bin/bash

# Helper script to run all quality gates
# Usage: ./scripts/quality-check.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}     Running Quality Gates${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

FAILED=0

# Function to run check
run_check() {
    local name=$1
    local command=$2
    
    echo -e "${YELLOW}Running: ${name}${NC}"
    
    if eval "$command"; then
        echo -e "${GREEN}[OK] ${name} passed${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}[FAIL] ${name} failed${NC}"
        echo ""
        return 1
    fi
}

# Check 1: Linting
if ! run_check "ESLint" "npm run lint"; then
    FAILED=1
fi

# Check 2: TypeScript
if ! run_check "TypeScript" "npm run typecheck"; then
    FAILED=1
fi

# Check 3: Unit Tests
if ! run_check "Unit Tests" "npm run test:unit"; then
    FAILED=1
fi

# Check 4: Formatting
if ! run_check "Prettier" "npm run format:check"; then
    FAILED=1
fi

# Summary
echo -e "${BLUE}========================================${NC}"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}[OK] All quality gates passed${NC}"
    echo -e "${GREEN}You can now commit your changes.${NC}"
    exit 0
else
    echo -e "${RED}[FAIL] Some quality gates failed${NC}"
    echo -e "${RED}Please fix the issues before committing.${NC}"
    echo ""
    echo -e "${YELLOW}Quick fixes:${NC}"
    echo "  npm run lint:fix      - Fix auto-fixable lint errors"
    echo "  npm run format        - Fix formatting"
    echo ""
    exit 1
fi
