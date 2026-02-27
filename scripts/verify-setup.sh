#!/bin/bash

# Helper script to verify setup is correct
# Usage: ./scripts/verify-setup.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}     Verifying ReditFast Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

ERRORS=0

# Function to check command exists
check_command() {
    local cmd=$1
    local name=$2
    
    if command -v "$cmd" &> /dev/null; then
        echo -e "${GREEN}[OK] ${name} is installed${NC}"
        return 0
    else
        echo -e "${RED}[FAIL] ${name} is not installed${NC}"
        return 1
    fi
}

# Function to check file exists
check_file() {
    local file=$1
    local name=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}[OK] ${name} exists${NC}"
        return 0
    else
        echo -e "${RED}[FAIL] ${name} is missing${NC}"
        return 1
    fi
}

# Function to check .env.local variable existence
get_env_var() {
    local name=$1
    local line
    line=$(grep -E "^[[:space:]]*${name}=" .env.local | tail -n 1 || true)
    if [ -z "$line" ]; then
        echo ""
        return 0
    fi
    local value="${line#*=}"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    echo "$value"
}

has_env_var() {
    local name=$1
    local value
    value=$(get_env_var "$name")
    [ -n "$value" ]
}

# Function to check if git hook is executable
check_hook_executable() {
    local file=$1
    local name=$2
    if [ -x "$file" ]; then
        echo -e "${GREEN}[OK] ${name} is executable${NC}"
        return 0
    fi

    echo -e "${RED}[FAIL] ${name} is not executable (run: chmod +x ${file})${NC}"
    return 1
}

has_valid_reddit_redirect_uri() {
    local value=$1
    [[ "$value" =~ ^https?://[^[:space:]]+/api/reddit/oauth/callback/?$ ]]
}

# Function to check directory exists
check_dir() {
    local dir=$1
    local name=$2
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}[OK] ${name} exists${NC}"
        return 0
    else
        echo -e "${RED}[FAIL] ${name} is missing${NC}"
        return 1
    fi
}

echo -e "${YELLOW}Checking system requirements...${NC}"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}[OK] Node.js ${NODE_VERSION} is installed${NC}"
    
    # Check version is >= 18
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        echo -e "${GREEN}[OK] Node.js version is >= 18${NC}"
    else
        echo -e "${RED}[FAIL] Node.js version must be >= 18${NC}"
        ERRORS=$((ERRORS+1))
    fi
else
    echo -e "${RED}[FAIL] Node.js is not installed${NC}"
    ERRORS=$((ERRORS+1))
fi

# Check npm
if ! check_command "npm" "npm"; then
    ERRORS=$((ERRORS+1))
fi

# Check git
if ! check_command "git" "Git"; then
    ERRORS=$((ERRORS+1))
fi

echo ""
echo -e "${YELLOW}Checking project structure...${NC}"

# Check essential files
if ! check_file "package.json" "package.json"; then ERRORS=$((ERRORS+1)); fi
if ! check_file "AGENTS.md" "AGENTS.md"; then ERRORS=$((ERRORS+1)); fi
if ! check_file ".env.example" ".env.example"; then ERRORS=$((ERRORS+1)); fi
if ! check_file "prisma/schema.prisma" "Prisma schema"; then ERRORS=$((ERRORS+1)); fi

# Check directories
if ! check_dir "src" "src directory"; then ERRORS=$((ERRORS+1)); fi
if ! check_dir "docs" "docs directory"; then ERRORS=$((ERRORS+1)); fi
if ! check_dir ".github" ".github directory"; then ERRORS=$((ERRORS+1)); fi
if ! check_dir ".husky" ".husky directory"; then ERRORS=$((ERRORS+1)); fi

echo ""
echo -e "${YELLOW}Checking dependencies...${NC}"

if [ -d "node_modules" ]; then
    echo -e "${GREEN}[OK] node_modules exists${NC}"
else
    echo -e "${RED}[FAIL] node_modules missing - run: npm install${NC}"
    ERRORS=$((ERRORS+1))
fi

echo ""
echo -e "${YELLOW}Checking git hooks...${NC}"

if [ -f ".husky/pre-commit" ]; then
    echo -e "${GREEN}[OK] pre-commit hook is configured${NC}"
else
    echo -e "${RED}[FAIL] pre-commit hook missing - run: npm run prepare${NC}"
    ERRORS=$((ERRORS+1))
fi

if [ -f ".husky/commit-msg" ]; then
    echo -e "${GREEN}[OK] commit-msg hook is configured${NC}"
else
    echo -e "${RED}[FAIL] commit-msg hook missing${NC}"
    ERRORS=$((ERRORS+1))
fi

if [ -f ".husky/pre-push" ]; then
    echo -e "${GREEN}[OK] pre-push hook is configured${NC}"
else
    echo -e "${RED}[FAIL] pre-push hook missing${NC}"
    ERRORS=$((ERRORS+1))
fi

if [ -f ".husky/pre-commit" ]; then
    if ! check_hook_executable ".husky/pre-commit" "pre-commit hook"; then
        ERRORS=$((ERRORS+1))
    fi
fi
if [ -f ".husky/commit-msg" ]; then
    if ! check_hook_executable ".husky/commit-msg" "commit-msg hook"; then
        ERRORS=$((ERRORS+1))
    fi
fi
if [ -f ".husky/pre-push" ]; then
    if ! check_hook_executable ".husky/pre-push" "pre-push hook"; then
        ERRORS=$((ERRORS+1))
    fi
fi

echo ""
echo -e "${YELLOW}Checking environment...${NC}"

if [ -f ".env.local" ]; then
    echo -e "${GREEN}[OK] .env.local exists${NC}"
    
    # Check for required variables
    if has_env_var "DATABASE_URL"; then
        echo -e "${GREEN}[OK] DATABASE_URL is set${NC}"
    else
        echo -e "${RED}[FAIL] DATABASE_URL is missing in .env.local${NC}"
        ERRORS=$((ERRORS+1))
    fi

    if has_env_var "REDIS_URL"; then
        echo -e "${GREEN}[OK] REDIS_URL is set${NC}"
    else
        echo -e "${RED}[FAIL] REDIS_URL is missing in .env.local${NC}"
        ERRORS=$((ERRORS+1))
    fi

    if has_env_var "APP_URL"; then
        echo -e "${GREEN}[OK] APP_URL is set${NC}"
    else
        echo -e "${RED}[FAIL] APP_URL is missing in .env.local${NC}"
        ERRORS=$((ERRORS+1))
    fi

    if has_env_var "NEXT_PUBLIC_SUPABASE_URL"; then
        echo -e "${GREEN}[OK] NEXT_PUBLIC_SUPABASE_URL is set${NC}"
    else
        echo -e "${RED}[FAIL] NEXT_PUBLIC_SUPABASE_URL is missing${NC}"
        ERRORS=$((ERRORS+1))
    fi

    if has_env_var "NEXT_PUBLIC_SUPABASE_ANON_KEY"; then
        echo -e "${GREEN}[OK] NEXT_PUBLIC_SUPABASE_ANON_KEY is set${NC}"
    else
        echo -e "${RED}[FAIL] NEXT_PUBLIC_SUPABASE_ANON_KEY is missing${NC}"
        ERRORS=$((ERRORS+1))
    fi

    if has_env_var "TOKEN_ENCRYPTION_KEYS"; then
        echo -e "${GREEN}[OK] TOKEN_ENCRYPTION_KEYS is set${NC}"
    else
        echo -e "${YELLOW}[WARN] TOKEN_ENCRYPTION_KEYS missing (Reddit token encryption will fail)${NC}"
    fi

    if has_env_var "REDDIT_CLIENT_ID" && has_env_var "REDDIT_CLIENT_SECRET" && has_env_var "REDDIT_REDIRECT_URI"; then
        echo -e "${GREEN}[OK] Reddit OAuth credentials are set${NC}"
        REDDIT_REDIRECT_URI_VALUE=$(get_env_var "REDDIT_REDIRECT_URI")
        if has_valid_reddit_redirect_uri "$REDDIT_REDIRECT_URI_VALUE"; then
            echo -e "${GREEN}[OK] REDDIT_REDIRECT_URI format looks correct${NC}"
        else
            echo -e "${YELLOW}[WARN] REDDIT_REDIRECT_URI should be a valid URL ending with /api/reddit/oauth/callback${NC}"
        fi
    else
        echo -e "${YELLOW}[WARN] Reddit OAuth credentials not set (needed for Reddit integration)${NC}"
    fi

    if has_env_var "OPENAI_API_KEY"; then
        echo -e "${GREEN}[OK] OPENAI_API_KEY is set${NC}"
    else
        echo -e "${YELLOW}[WARN] OPENAI_API_KEY missing (AI quality/features may degrade)${NC}"
    fi
else
    echo -e "${RED}[FAIL] .env.local is missing - copy from .env.example${NC}"
    ERRORS=$((ERRORS+1))
fi

echo ""
echo -e "${BLUE}========================================${NC}"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}[OK] Setup verification complete${NC}"
    echo -e "${GREEN}Your development environment is ready.${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Set up your environment variables in .env.local"
    echo "2. Run launch readiness checks: npm run check:launch"
    echo "3. Start development: npm run dev"
    exit 0
else
    echo -e "${RED}[FAIL] Setup verification found ${ERRORS} issue(s)${NC}"
    echo -e "${RED}Please fix the issues above.${NC}"
    echo ""
    echo -e "${YELLOW}Common fixes:${NC}"
    echo "  npm install              - Install dependencies"
    echo "  npm run prepare          - Set up git hooks"
    echo "  cp .env.example .env.local  - Create environment file"
    exit 1
fi
