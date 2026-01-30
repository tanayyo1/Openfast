# ReditFast

> **AI-Powered Reddit Marketing Platform**  
> Grow on Reddit without getting banned. Generate personalized roadmaps, create engaging content, and schedule posts—all while staying compliant with Reddit's rules.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.0-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-Upstash-DC382D?style=flat-square&logo=redis)](https://upstash.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4-412991?style=flat-square&logo=openai)](https://openai.com/)

[Demo](https://reditfast.com) • [Documentation](./docs) • [API Reference](./docs/API.md)

---

## ✨ Features

### 🎯 Smart Roadmap Generation
- AI analyzes your product and finds the best subreddits
- Personalized 30-day posting strategy
- Daily task recommendations with optimal timing
- Karma-building progression for new accounts

### 📝 AI Content Creation
- Generate post drafts tailored to each subreddit
- Comment suggestions for high-engagement threads
- Multiple variants to choose from
- Compliance scoring to prevent removals

### ⏰ Scheduling & Automation
- Queue posts for optimal times
- Human-in-the-loop approval (never auto-post)
- Automatic publishing at scheduled time
- Retry logic with exponential backoff

### 🔍 Smart Thread Discovery
- Find trending discussions in your niche
- Comment opportunity scoring
- Real-time alerts for high-value threads
- Competitor mention tracking

### 📊 Analytics & Insights
- Track karma growth and post performance
- Removal detection and account health
- Click attribution with UTM tracking
- Conversion funnel analysis

### 🛡️ Ban Prevention
- Subreddit rule checking before every post
- Pacing controls based on account tier
- Promotional language detection
- Duplicate content prevention

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Reddit OAuth App credentials
- OpenAI API key
- Stripe account (for payments)

### Installation

```bash
# Clone the repository
git clone https://github.com/tanayyo1/ReditFast.git
cd ReditFast

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Set up database
npx prisma migrate dev
npx prisma db seed

# Run development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the app.

### Environment Variables

Create `.env.local` with:

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/reditfast"

# Redis
REDIS_URL="redis://localhost:6379"

# Reddit OAuth
REDDIT_CLIENT_ID="your_client_id"
REDDIT_CLIENT_SECRET="your_client_secret"
REDDIT_REDIRECT_URI="http://localhost:3000/api/auth/callback/reddit"

# OpenAI
OPENAI_API_KEY="sk-..."

# Stripe
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# NextAuth
NEXTAUTH_SECRET="your_secret_key"
NEXTAUTH_URL="http://localhost:3000"

# Email
RESEND_API_KEY="re_..."
```

---

## 🏗️ Architecture

### High-Level Overview

```
Frontend (Next.js 14)
    ↓
API Gateway (Rate Limiting, Auth)
    ↓
Microservices
├── Auth Service
├── Project Service
├── Reddit Integration
├── Roadmap Generator
├── Content AI (LLM)
├── Scheduler & Publisher
├── Analytics Engine
└── Notification Service
    ↓
Data Layer
├── PostgreSQL (Primary)
├── Redis (Cache + Queue)
├── Vector DB (Embeddings)
└── Object Storage (R2)
```

### Key Technologies

- **Frontend**: Next.js 14, TailwindCSS, shadcn/ui
- **Backend**: Node.js, Next.js API Routes
- **Database**: PostgreSQL + Prisma ORM
- **Queue**: BullMQ (Redis-based)
- **AI**: OpenAI GPT-4, LangChain, pgvector
- **Auth**: NextAuth.js + Reddit OAuth
- **Payments**: Stripe
- **Email**: Resend

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed design.

---

## 📖 Documentation

- [Architecture](./docs/ARCHITECTURE.md) - System design and patterns
- [API Reference](./docs/API.md) - REST API documentation
- [Database Schema](./prisma/schema.prisma) - Prisma schema
- [Deployment](./docs/DEPLOYMENT.md) - Production setup guide
- [Contributing](./CONTRIBUTING.md) - Contribution guidelines

---

## 🧪 Testing

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run all tests
npm run test
```

---

## 📦 Deployment

### Vercel (Recommended for Frontend)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Railway/Render (Backend Workers)

```bash
# Deploy workers
npm run deploy:workers
```

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for detailed instructions.

---

## 🎯 Roadmap

### MVP (Current)
- [x] User authentication & workspaces
- [x] Reddit OAuth integration
- [x] Project creation & management
- [x] AI roadmap generation
- [x] Draft creation with compliance scoring
- [x] Post scheduling & publishing
- [x] Basic analytics

### Upcoming
- [ ] Smart thread finder
- [ ] Team collaboration
- [ ] Advanced analytics dashboard
- [ ] Multi-platform (LinkedIn, X)
- [ ] AI assistant (Bear)
- [ ] Mobile app

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) for details.

---

## 🙏 Acknowledgments

- Inspired by [MediaFast](https://www.mediafa.st/) and the need for safe Reddit marketing
- Built with modern open-source tools
- Thanks to all contributors and early users

---

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/tanayyo1/ReditFast/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tanayyo1/ReditFast/discussions)
- **Email**: support@reditfast.com

---

<p align="center">
  Built with ❤️ for the indie founder community
</p>
