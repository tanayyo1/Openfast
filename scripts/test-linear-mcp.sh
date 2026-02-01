#!/bin/bash

# Test Linear MCP connection
# Usage: ./scripts/test-linear-mcp.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Testing Linear MCP Connection${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${RED}[FAIL] .env.local not found${NC}"
    echo "Please create .env.local from .env.example"
    exit 1
fi

# Load environment variables
export $(grep -v '^#' .env.local | xargs)

# Check LINEAR_API_KEY
if [ -z "$LINEAR_API_KEY" ]; then
    echo -e "${RED}[FAIL] LINEAR_API_KEY not set in .env.local${NC}"
    exit 1
fi

if [[ ! $LINEAR_API_KEY =~ ^lin_api_ ]]; then
    echo -e "${RED}[FAIL] LINEAR_API_KEY format is invalid${NC}"
    echo "Expected format: lin_api_..."
    exit 1
fi

echo -e "${GREEN}[OK] LINEAR_API_KEY is configured${NC}"

# Check LINEAR_MCP_SERVER_URL
if [ -z "$LINEAR_MCP_SERVER_URL" ]; then
    echo -e "${YELLOW}[WARN] LINEAR_MCP_SERVER_URL not set, using default${NC}"
    LINEAR_MCP_SERVER_URL="https://mcp.linear.app"
fi

echo -e "${GREEN}[OK] LINEAR_MCP_SERVER_URL: $LINEAR_MCP_SERVER_URL${NC}"

# Test API connection
echo ""
echo -e "${YELLOW}Testing Linear API connection...${NC}"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -X POST \
  https://api.linear.app/graphql \
  -d '{"query": "query { viewer { id name email } }"}' 2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}[OK] Linear API connection successful${NC}"
    
    # Extract viewer info if available
    if echo "$BODY" | grep -q "viewer"; then
        VIEWER_NAME=$(echo "$BODY" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
        echo -e "${GREEN}[OK] Authenticated as: $VIEWER_NAME${NC}"
    fi
else
    echo -e "${RED}[FAIL] Linear API connection failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
    exit 1
fi

# Check MCP config file
echo ""
echo -e "${YELLOW}Checking MCP configuration...${NC}"

if [ -f ".linear/mcp.json" ]; then
    echo -e "${GREEN}[OK] MCP config file exists${NC}"
    
    # Validate JSON
    if cat .linear/mcp.json | jq . > /dev/null 2>&1; then
        echo -e "${GREEN}[OK] MCP config is valid JSON${NC}"
    else
        echo -e "${RED}[FAIL] MCP config is invalid JSON${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}[WARN] MCP config file not found at .linear/mcp.json${NC}"
fi

# Check .gitignore
echo ""
echo -e "${YELLOW}Checking .gitignore...${NC}"

if grep -q ".env.local" .gitignore; then
    echo -e "${GREEN}[OK] .env.local is in .gitignore${NC}"
else
    echo -e "${RED}[FAIL] .env.local NOT in .gitignore${NC}"
    echo "Please add .env.local to .gitignore immediately!"
    exit 1
fi

if grep -q ".linear/" .gitignore; then
    echo -e "${GREEN}[OK] .linear/ is in .gitignore${NC}"
else
    echo -e "${YELLOW}[WARN] .linear/ NOT in .gitignore${NC}"
    echo "Consider adding .linear/ to .gitignore"
fi

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}[OK] Linear MCP setup is complete${NC}"
echo ""
echo -e "${YELLOW}Your AI agents can now:${NC}"
echo "  • Create and update Linear issues"
echo "  • Read project information"
echo "  • Add comments to issues"
echo "  • Track cycles and milestones"
echo ""
echo -e "${YELLOW}Usage examples:${NC}"
echo "  'Create a Linear issue for fixing the login bug'"
echo "  'What's assigned to me this week?'"
echo "  'Move issue LIN-123 to In Review'"
echo ""
echo -e "${BLUE}========================================${NC}"
