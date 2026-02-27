#!/bin/bash

# ReditFast Local Development Setup Script
# This script sets up local PostgreSQL and Redis for development

set -e

echo "🚀 Setting up ReditFast local development environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first:"
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install it:"
    echo "   https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker found"
echo ""

# Start services
echo "🐳 Starting PostgreSQL and Redis..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Check if PostgreSQL is accepting connections
until docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo "   PostgreSQL is starting..."
    sleep 2
done

echo ""
echo -e "${GREEN}✅ PostgreSQL is ready!${NC}"
echo ""

# Run Prisma migrations
echo "🗄️  Setting up database schema..."
npx prisma generate
npx prisma db push --accept-data-loss

echo ""
echo -e "${GREEN}✅ Database schema applied!${NC}"
echo ""

# Seed database (optional)
if [ -f "scripts/seed.ts" ]; then
    echo "🌱 Seeding database..."
    npx tsx scripts/seed.ts
    echo -e "${GREEN}✅ Database seeded!${NC}"
    echo ""
fi

# Verify setup
echo "🔍 Verifying setup..."
npx tsx scripts/verify-auth.ts

echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "   1. Ensure .env.local is configured (copy from .env.example if needed)"
echo ""
echo "   2. Run launch readiness check:"
echo "      npm run check:launch"
echo ""
echo "   3. Start the development server:"
echo "      npm run dev"
echo ""
echo "   4. Open http://localhost:3000/signup"
echo ""
echo "💡 Useful commands:"
echo "   - View logs: docker-compose logs -f"
echo "   - Stop services: docker-compose down"
echo "   - Reset database: docker-compose down -v && ./scripts/setup-local.sh"
echo ""
echo "📚 Documentation:"
echo "   - TASK_ASSIGNMENTS.md - Team tasks"
echo "   - TODO.md - Project tracking"
echo "   - AGENTS.md - Technical context"
