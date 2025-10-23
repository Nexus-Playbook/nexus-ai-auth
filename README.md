# Nexus AI Auth Service

Authentication and user management microservice for Nexus AI platform.

## Features
- User registration and authentication
- JWT token management with refresh tokens
- OAuth SSO integration (Google, GitHub)
- Team/organization management
- Role-based access control (RBAC)
- Multi-tenant architecture

## Tech Stack
- Node.js with NestJS framework
- TypeScript
- PostgreSQL for data persistence
- JWT for authentication
- Passport.js for OAuth strategies
- bcrypt for password hashing

## API Endpoints

### Authentication
- `POST /auth/signup` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token
- `GET /auth/me` - Get current user info
- `POST /auth/logout` - Logout and invalidate tokens

### OAuth
- `GET /auth/google` - Google OAuth initiation
- `GET /auth/google/callback` - Google OAuth callback
- `GET /auth/github` - GitHub OAuth initiation  
- `GET /auth/github/callback` - GitHub OAuth callback

### Teams
- `POST /teams` - Create team/organization
- `GET /teams` - List user's teams
- `POST /teams/:id/invite` - Invite user to team
- `PATCH /teams/:id/members/:userId/role` - Update member role

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation
```bash
npm install
```

### Database Setup
```bash
# Create database
createdb nexus_ai_auth

# Run migrations
npm run migration:run
```

### Development
```bash
npm run start:dev
```

Service runs on [http://localhost:3001](http://localhost:3001)

## Environment Variables
```
DATABASE_URL=postgresql://user:pass@localhost:5432/nexus_ai_auth
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

## Scripts
- `npm run start:dev` - Start development server
- `npm run build` - Build for production
- `npm run start:prod` - Start production server
- `npm run test` - Run tests
- `npm run migration:generate` - Generate new migration
- `npm run migration:run` - Run pending migrations

## Database Schema

### Users Table
- id (UUID, primary key)
- email (string, unique)
- password_hash (string, nullable)
- role (enum: admin, team_lead, member, freelancer, student)
- created_at, updated_at (timestamps)
- metadata (jsonb)

### Teams Table  
- id (UUID, primary key)
- name (string)
- plan (enum: free, pro, enterprise)
- billing_customer_id (string, nullable)
- created_at, updated_at (timestamps)

### Team Members Table
- team_id (UUID, foreign key)
- user_id (UUID, foreign key)
- role (enum: admin, member)
- joined_at (timestamp)

## Security Features
- Password hashing with bcrypt
- JWT with short expiration times
- Refresh token rotation
- Rate limiting on auth endpoints
- Input validation and sanitization
- CORS configuration

## License
Private - Nexus AI Platform