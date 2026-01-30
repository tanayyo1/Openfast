# Architecture Overview

This document provides a detailed overview of the ReditFast architecture.

## System Architecture

For a visual overview, see the system design diagrams in AGENTS.md.

## Core Services

### 1. Authentication Service
- Handles user registration, login, logout
- Manages sessions with JWT
- OAuth integration for Reddit
- Workspace membership and permissions

### 2. Project Service
- CRUD operations for projects
- Brand voice configuration
- Goals and constraints management
- Multi-workspace support

### 3. Reddit Integration Service
- OAuth token management
- Rate limiting and pacing
- Token refresh automation
- Account health monitoring

### 4. Roadmap Service
- AI-powered strategy generation
- Subreddit matching using vector similarity
- Daily task planning
- Progress tracking

### 5. Content Generation Service
- LLM-powered draft creation
- Compliance scoring
- Risk assessment
- Variant generation

### 6. Scheduler & Publisher Service
- Job queue management
- Idempotent publishing
- Retry logic with backoff
- Audit trail

### 7. Analytics Service
- Performance tracking
- Removal detection
- Click attribution
- Conversion tracking

### 8. Notification Service
- Email notifications (Resend)
- In-app alerts
- WebSocket real-time updates
- Push notifications (future)

## Data Flow

```
User Action → API Gateway → Service Layer → Database/Cache
                     ↓
              Background Jobs (Queue)
                     ↓
              External APIs (Reddit, OpenAI, Stripe)
```

## Security Model

### Authentication
- NextAuth.js for session management
- Reddit OAuth for platform integration
- JWT tokens with rotation

### Authorization
- Workspace-based access control
- Role-based permissions (Owner, Admin, Member, Viewer)
- Resource-level scoping (every query includes workspace_id)

### Data Protection
- Encrypted Reddit tokens (AES-256)
- Hashed passwords (bcrypt)
- Hashed IP addresses in logs
- GDPR/CCPA compliant deletion flows

## Scalability Considerations

### Database
- Read replicas for analytics queries
- Partitioning for time-series data
- Connection pooling

### Caching
- Redis for session cache
- Subreddit metadata caching
- Draft generation caching

### Queue Processing
- Horizontal scaling of workers
- Priority queues for scheduled posts
- Dead letter queue for failures

## Compliance Features

### Reddit Compliance
- Human-in-the-loop approval (default)
- Subreddit rule checking
- Pacing controls by account tier
- Promotional language detection
- Duplicate content prevention

### Legal Compliance
- Terms of Service acceptance
- Privacy policy
- Data retention controls
- Export/deletion capabilities

## Technology Stack

See AGENTS.md for complete stack details.

## Deployment

See DEPLOYMENT.md for deployment instructions.
