# Nexus AI Auth Service

Core authentication and authorization microservice for the Nexus AI platform. Handles user identity, token management, and team-based access control with enterprise-grade security.

## Overview

**Stack:** NestJS (TypeScript) | PostgreSQL | JWT | OAuth 2.0 | Redis

**Features:**
- JWT-based authentication with refresh token rotation
- Multi-provider SSO (Google, GitHub)
- Team management and RBAC
- Refresh token revocation with Redis blacklist
- Audit logging for compliance
- Rate limiting and input validation
- Prometheus metrics for observability

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Update DATABASE_URL, JWT_SECRET, OAuth credentials, REDIS_URL

# Run migrations
npx prisma migrate deploy

# Start development server
npm run start:dev
```

Service runs on `http://localhost:3001`

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✓ | PostgreSQL connection string |
| `JWT_SECRET` | ✓ | Access token signing key (min 32 chars) |
| `JWT_REFRESH_SECRET` | ✓ | Refresh token signing key (min 32 chars) |
| `JWT_ACCESS_EXPIRY` | | Default: `15m` |
| `JWT_REFRESH_EXPIRY` | | Default: `7d` |
| `GOOGLE_CLIENT_ID` | | Google OAuth credentials |
| `GOOGLE_CLIENT_SECRET` | | Google OAuth credentials |
| `GITHUB_CLIENT_ID` | | GitHub OAuth credentials |
| `GITHUB_CLIENT_SECRET` | | GitHub OAuth credentials |
| `REDIS_URL` | | Redis connection (for token blacklist) |

## API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/signup` | Register new user |
| POST | `/auth/login` | Authenticate with credentials |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Get current user profile |
| POST | `/auth/logout` | Revoke refresh token |

### OAuth
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/google` | Google OAuth flow initiation |
| GET | `/auth/google/callback` | Google OAuth callback handler |
| GET | `/auth/github` | GitHub OAuth flow initiation |
| GET | `/auth/github/callback` | GitHub OAuth callback handler |

### Teams
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/teams` | Create team |
| GET | `/teams` | List user's teams |
| POST | `/teams/:id/invite` | Invite member to team |
| PATCH | `/teams/:id/members/:userId/role` | Update member role |

### Observability
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/metrics` | Prometheus metrics |
| GET | `/health` | Health check |

## Architecture

**Core Models:**
- **User** - Identity and profile
- **Team** - Organization/workspace container
- **TeamMember** - Role-based team membership
- **AuditLog** - Compliance and security auditing

**Key Services:**
- `AuthService` - Token generation, OAuth flows, logout
- `RedisService` - Refresh token revocation via blacklist
- `AuditService` - Event logging for compliance
- `MetricsService` - Prometheus metrics collection

## Security

- Passwords hashed with bcrypt (cost: 10)
- JWT validation on protected routes
- Refresh tokens stored in Redis with TTL
- Rate limiting: 5 requests/min on auth endpoints
- Audit trail for all authentication events
- CORS enabled for frontend integration

## Build & Deployment

```bash
# Build for production
npm run build

# Start production server
npm run start:prod
```

Docker support available in `/infra/docker/`

## License
Private - Nexus AI Platform