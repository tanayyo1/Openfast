# API Reference

Complete REST API documentation for ReditFast.

## Base URL

```
Development: http://localhost:3000/api
Production: https://reditfast.com/api
```

## Authentication

All API requests (except auth endpoints) require a valid session cookie or JWT token.

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  }
}
```

## Rate Limiting

Headers included in responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Endpoints

### Authentication

#### POST /auth/register
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_xxx",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "workspace": {
      "id": "ws_xxx",
      "name": "Personal"
    }
  }
}
```

#### POST /auth/login
Authenticate user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### POST /auth/logout
End user session.

### Projects

#### GET /projects
List all projects in workspace.

**Query Parameters:**
- `status`: Filter by status (active, paused, archived)
- `limit`: Number of results (default: 20, max: 100)
- `cursor`: Pagination cursor

**Response:**
```json
{
  "success": true,
  "data": {
    "projects": [...],
    "pagination": {
      "nextCursor": "...",
      "hasMore": true
    }
  }
}
```

#### POST /projects
Create a new project.

**Request:**
```json
{
  "name": "My SaaS",
  "description": "AI-powered analytics tool",
  "url": "https://mysaas.com",
  "niche": "saas",
  "goals": {
    "primary": "traffic",
    "targets": ["founders", "marketers"],
    "kpis": ["signups", "demo_bookings"]
  },
  "brandVoice": {
    "tone": "professional",
    "do": ["be helpful", "share data"],
    "dont": ["be salesy", "use hype"]
  }
}
```

#### GET /projects/:id
Get project details.

#### PATCH /projects/:id
Update project.

#### DELETE /projects/:id
Archive project.

### Reddit Integration

#### GET /reddit/oauth/start
Initiate Reddit OAuth flow.

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://www.reddit.com/api/v1/authorize?..."
  }
}
```

#### GET /reddit/oauth/callback
OAuth callback handler (internal use).

#### GET /reddit/accounts
List connected Reddit accounts.

**Response:**
```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": "ra_xxx",
        "redditUsername": "myusername",
        "linkKarma": 1500,
        "commentKarma": 3000,
        "safetyTier": "TRUSTED",
        "isActive": true
      }
    ]
  }
}
```

#### DELETE /reddit/accounts/:id
Disconnect Reddit account.

### Roadmaps

#### POST /roadmaps/generate
Generate a new roadmap for project.

**Request:**
```json
{
  "projectId": "proj_xxx",
  "horizonDays": 30
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "roadmap": {
      "id": "rm_xxx",
      "status": "ACTIVE",
      "tasks": [
        {
          "id": "task_xxx",
          "dayIndex": 1,
          "type": "KARMA_BUILDING",
          "instructions": "Comment on 3 posts in r/startups",
          "subreddit": { ... }
        }
      ]
    }
  }
}
```

#### GET /roadmaps/:id
Get roadmap with tasks.

#### GET /roadmaps/:id/tasks
Get tasks for roadmap.

**Query Parameters:**
- `status`: Filter by status (pending, in_progress, completed)
- `day`: Filter by day index

### Drafts

#### POST /drafts
Generate draft content.

**Request:**
```json
{
  "taskId": "task_xxx",
  "type": "POST",
  "knobs": {
    "tone": "casual",
    "length": "medium",
    "variantCount": 3
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "drafts": [
      {
        "id": "draft_xxx",
        "title": "How I bootstrapped to $10k MRR",
        "body": "...",
        "riskScore": 15,
        "riskReasons": ["Contains promotional link"],
        "suggestedFixes": ["Remove direct link", "Use profile bio instead"]
      }
    ]
  }
}
```

#### POST /drafts/:id/rewrite
Rewrite draft to comply.

**Request:**
```json
{
  "target": "comply", // or "no-link", "shorter", "friendlier"
  "instructions": "Make it less promotional"
}
```

#### PATCH /drafts/:id
Update draft (user edits).

**Request:**
```json
{
  "title": "Updated title",
  "body": "Updated body content"
}
```

#### POST /drafts/:id/approve
Approve draft for scheduling.

### Scheduled Posts

#### POST /scheduled-posts
Schedule a post.

**Request:**
```json
{
  "draftId": "draft_xxx",
  "redditAccountId": "ra_xxx",
  "scheduledAt": "2026-02-15T14:00:00Z",
  "timezone": "America/New_York"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "scheduledPost": {
      "id": "sp_xxx",
      "status": "SCHEDULED",
      "scheduledAt": "2026-02-15T14:00:00Z",
      "draft": { ... }
    }
  }
}
```

#### GET /scheduled-posts
List scheduled posts.

**Query Parameters:**
- `status`: Filter by status
- `from`: Start date
- `to`: End date
- `redditAccountId`: Filter by account

#### PATCH /scheduled-posts/:id/cancel
Cancel scheduled post.

#### DELETE /scheduled-posts/:id
Delete scheduled post.

### Analytics

#### GET /analytics/projects/:id
Get project analytics.

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalPosts": 45,
      "totalComments": 120,
      "avgScore": 25,
      "totalClicks": 1500,
      "conversions": 30
    },
    "trends": {
      "karmaGrowth": [ ... ],
      "postPerformance": [ ... ],
      "trafficSources": [ ... ]
    }
  }
}
```

#### GET /analytics/accounts/:id
Get Reddit account analytics.

#### GET /analytics/dashboard
Get dashboard overview.

### Webhooks

#### POST /webhooks/stripe
Stripe webhook handler.

**Headers:**
- `Stripe-Signature`: Webhook signature

## Error Codes

### 400 - Bad Request
- `INVALID_INPUT`: Request validation failed
- `MISSING_FIELD`: Required field missing
- `INVALID_FORMAT`: Incorrect data format

### 401 - Unauthorized
- `UNAUTHENTICATED`: No valid session
- `TOKEN_EXPIRED`: Session expired
- `INVALID_CREDENTIALS`: Login failed

### 403 - Forbidden
- `UNAUTHORIZED`: Insufficient permissions
- `WORKSPACE_MISMATCH`: Resource not in workspace
- `RATE_LIMITED`: Too many requests

### 404 - Not Found
- `RESOURCE_NOT_FOUND`: Resource doesn't exist
- `USER_NOT_FOUND`: User not found
- `PROJECT_NOT_FOUND`: Project not found

### 409 - Conflict
- `DUPLICATE_RESOURCE`: Resource already exists
- `ALREADY_SCHEDULED`: Post already scheduled
- `CONCURRENT_MODIFICATION`: Resource modified by another request

### 422 - Unprocessable Entity
- `VALIDATION_ERROR`: Business logic validation failed
- `INSUFFICIENT_KARMA`: Account doesn't meet karma requirements
- `SUBREDDIT_NOT_ALLOWED`: Cannot post to this subreddit
- `CONTENT_RISK_TOO_HIGH`: Risk score exceeds threshold

### 429 - Too Many Requests
- `RATE_LIMIT_EXCEEDED`: API rate limit hit
- `REDDIT_RATE_LIMIT`: Reddit API rate limit

### 500 - Internal Server Error
- `INTERNAL_ERROR`: Unexpected server error
- `DATABASE_ERROR`: Database operation failed
- `EXTERNAL_API_ERROR`: External service error

## WebSocket Events

Connect to `/api/socket` for real-time updates.

### Events

#### roadmap:generated
Roadmap generation complete.

```json
{
  "event": "roadmap:generated",
  "data": {
    "roadmapId": "rm_xxx",
    "projectId": "proj_xxx"
  }
}
```

#### draft:ready
Draft generation complete.

#### post:published
Scheduled post published.

```json
{
  "event": "post:published",
  "data": {
    "scheduledPostId": "sp_xxx",
    "publishedItemId": "pi_xxx",
    "url": "https://reddit.com/r/..."
  }
}
```

#### post:failed
Scheduled post failed to publish.

#### notification:new
New notification for user.

## Pagination

Cursor-based pagination for list endpoints.

**Request:**
```
GET /projects?limit=20&cursor=eyJpZCI6InByb2pfMTIzIn0
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "nextCursor": "eyJpZCI6InByb2pfNDU2In0",
      "hasMore": true
    }
  }
}
```

To get next page:
```
GET /projects?limit=20&cursor=eyJpZCI6InByb2pfNDU2In0
```

## Versioning

API version is included in URL path:
- Current: `/api/v1/...` (implicit, no version prefix needed)
- Future: `/api/v2/...`

Breaking changes will be announced 30 days in advance.

## SDKs

Coming soon:
- JavaScript/TypeScript SDK
- Python SDK
- CLI tool

## Support

- API questions: [GitHub Discussions](https://github.com/tanayyo1/ReditFast/discussions)
- Bug reports: [GitHub Issues](https://github.com/tanayyo1/ReditFast/issues)
- Email: api@reditfast.com
