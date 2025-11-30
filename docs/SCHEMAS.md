# Database Schema Documentation - Nexus AI Auth Service

## Overview

This document describes the PostgreSQL database schema for the Auth service, following the **TaskPulse 2.0 Data Architecture** principle: **PostgreSQL is the System of Record (Truth Layer)**.

**Architecture Principle**: 
> "Postgres stores anything you can't afford to lose or corrupt"

---

## Schema Architecture

### Why PostgreSQL for Auth?

| Requirement | Why PostgreSQL | Alternative Rejected |
|-------------|----------------|---------------------|
| **ACID Compliance** | User accounts require strong consistency | MongoDB (eventual consistency) |
| **Referential Integrity** | Teams → Users → Audit logs must be consistent | NoSQL (no foreign keys) |
| **Regulatory Compliance** | GDPR, SOC2 require immutable audit trails | Document stores (flexible = risky) |
| **Financial Safety** | Billing data must never corrupt | In-memory DBs (data loss risk) |
| **Complex Queries** | Role hierarchies, team memberships need SQL joins | Key-value stores (limited querying) |

**Data Category**: **Truth Layer** - Identity, security, compliance, payments

---

## Entity Relationship Diagram (ERD)

```
┌─────────────────┐           ┌─────────────────┐
│     users       │           │     teams       │
├─────────────────┤           ├─────────────────┤
│ id (PK)         │◄─────┐    │ id (PK)         │
│ email (UNIQUE)  │      │    │ name            │
│ passwordHash    │      │    │ ownerId (FK)────┼──┐
│ name            │      │    │ plan            │  │
│ role            │      │    │ isActive        │  │
│ oauthProvider   │      │    │ createdAt       │  │
│ createdAt       │      │    │ billingCustomerId│  │
└────────┬────────┘      │    └─────────────────┘  │
         │               │                          │
         │               │    ┌──────────────────┐  │
         │               └────┤  team_members    │  │
         │                    ├──────────────────┤  │
         │                    │ id (PK)          │  │
         │                    │ teamId (FK)      │  │
         │              ┌────►│ userId (FK)      │  │
         │              │     │ roleInTeam       │  │
         │              │     │ assignedBy (FK)  │  │
         │              │     │ joinedAt         │  │
         │              │     └──────────────────┘  │
         │              │                            │
         │              │     ┌──────────────────┐  │
         └──────────────┼────►│   audit_logs     │  │
                        │     ├──────────────────┤  │
                        │     │ id (PK)          │  │
                        │     │ userId (FK)      │  │
                        │     │ action           │  │
                        │     │ timestamp        │  │
                        │     │ payload (JSON)   │  │
                        │     └──────────────────┘  │
                        │                            │
                        │     ┌──────────────────┐  │
                        └─────┤ role_permissions │  │
                              ├──────────────────┤  │
                              │ id (PK)          │  │
                              │ role             │  │
                              │ permission       │  │
                              │ canAccess        │  │
                              └──────────────────┘  │
                                                     │
                              Owner Relationship ────┘
```

---

## Tables

### 1. `users` - User Identity & Profile

**Purpose**: Core user accounts with OAuth support

**Storage Principle**: **Truth Layer** - User identity is immutable source of truth

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PRIMARY KEY | Unique user identifier |
| `email` | String | UNIQUE, NOT NULL | Login identifier (indexed) |
| `passwordHash` | String | NULLABLE | bcrypt hash (null for OAuth users) |
| `name` | String | NOT NULL | Display name |
| `phoneNumber` | String | NULLABLE | Optional contact |
| `gender` | Enum | NULLABLE | MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY |
| `dateOfBirth` | DateTime | NULLABLE | For age verification |
| `role` | Enum | DEFAULT MEMBER | System-wide role (see Role enum) |
| `avatarUrl` | String | NULLABLE | Profile picture URL (external) |
| `isActive` | Boolean | DEFAULT TRUE | Soft delete flag |
| `oauthProvider` | Enum | NULLABLE | GOOGLE, GITHUB, MICROSOFT |
| `oauthId` | String | NULLABLE | External provider user ID |
| `createdAt` | DateTime | DEFAULT now() | Account creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last profile update |
| `lastLogin` | DateTime | NULLABLE | Security tracking |
| `assignedTasks` | String[] | ARRAY | MongoDB task IDs (cross-DB ref) |

**Indexes**:
```sql
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_oauth ON users(oauthProvider, oauthId);
CREATE INDEX idx_users_active ON users(isActive) WHERE isActive = TRUE;
```

**Relationships**:
- `users.id` → `team_members.userId` (many-to-many via junction)
- `users.id` → `teams.ownerId` (one-to-many)
- `users.id` → `audit_logs.userId` (one-to-many)

**Business Rules**:
1. Email must be unique across all users
2. OAuth users have `passwordHash = NULL`
3. Password users have `oauthProvider = NULL`
4. Users can have multiple OAuth providers (future: link accounts)
5. `assignedTasks` references MongoDB (Week 2 integration)

**Security**:
- Passwords hashed with bcrypt (cost factor: 10)
- OAuth tokens NOT stored (stateless OAuth flow)
- `isActive = FALSE` for soft deletes (GDPR compliance)

---

### 2. `teams` - Organizations / Workspaces

**Purpose**: Multi-tenancy containers for users and projects

**Storage Principle**: **Truth Layer** - Team ownership is legal/financial truth

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PRIMARY KEY | Unique team identifier |
| `name` | String | NOT NULL | Team display name |
| `description` | String | NULLABLE | Optional team description |
| `ownerId` | String | FOREIGN KEY (users.id) | Single owner (legal entity) |
| `plan` | Enum | DEFAULT FREE | FREE, PRO, ENTERPRISE |
| `isActive` | Boolean | DEFAULT TRUE | Subscription status |
| `createdAt` | DateTime | DEFAULT now() | Team creation timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last modification |
| `billingCustomerId` | String | NULLABLE | Stripe/Razorpay customer ID |

**Indexes**:
```sql
CREATE INDEX idx_teams_owner ON teams(ownerId);
CREATE INDEX idx_teams_active ON teams(isActive) WHERE isActive = TRUE;
```

**Relationships**:
- `teams.ownerId` → `users.id` (many-to-one, owner must exist)
- `teams.id` → `team_members.teamId` (one-to-many)

**Business Rules**:
1. Each team has exactly ONE owner
2. Owner must be an existing user
3. Deleting owner cascades to team (database constraint)
4. Team name is NOT unique (different teams can have same name)
5. `billingCustomerId` links to payment provider (future billing service)

**Design Decision**:
- **Single Owner**: Prevents ownership conflicts in legal/billing scenarios
- **Plan Enum**: Embedded in team (not separate table) for simplicity
- **No Personal Teams**: Users explicitly create teams (see DECISION-LOG.md)

---

### 3. `team_members` - User-Team Relationships

**Purpose**: Many-to-many junction table with role-based access control

**Storage Principle**: **Truth Layer** - Team membership is source of truth for authorization

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PRIMARY KEY | Unique membership identifier |
| `teamId` | String | FOREIGN KEY (teams.id) | Team reference |
| `userId` | String | FOREIGN KEY (users.id) | User reference |
| `roleInTeam` | Enum | DEFAULT MEMBER | Team-specific role (see TeamRole) |
| `assignedBy` | String | FOREIGN KEY (users.id), NULLABLE | Who assigned this role |
| `joinedAt` | DateTime | DEFAULT now() | Membership start timestamp |
| `updatedAt` | DateTime | AUTO UPDATE | Last role change |

**Indexes**:
```sql
CREATE UNIQUE INDEX idx_team_members_unique ON team_members(teamId, userId);
CREATE INDEX idx_team_members_user ON team_members(userId);
CREATE INDEX idx_team_members_team ON team_members(teamId);
```

**Relationships**:
- `team_members.teamId` → `teams.id` (CASCADE DELETE)
- `team_members.userId` → `users.id` (CASCADE DELETE)
- `team_members.assignedBy` → `users.id` (SET NULL on delete)

**Business Rules**:
1. **Unique Constraint**: (teamId, userId) - User can only be in team once
2. **Cascade Delete**: Deleting team removes all memberships
3. **Cascade Delete**: Deleting user removes all their memberships
4. `assignedBy` tracks audit trail (who invited/promoted this user)
5. `roleInTeam` is independent from `users.role` (contextual permissions)

**Permission Model**:
```typescript
// Global role (users.role)
OWNER → Can create/delete any team (system admin)

// Team role (team_members.roleInTeam)
OWNER    → Full team control, billing, delete team
ADMIN    → Invite/remove members, assign roles
TEAM_LEAD → Create projects, assign tasks
DEVELOPER → Edit tasks, collaborate
TESTER   → Create bugs, update test status
MEMBER   → View-only or limited access
```

**Design Decision**:
- **Two-Level Roles**: System role (global) + Team role (contextual)
- **Example**: User is MEMBER globally but OWNER in their personal team
- **Reason**: Prevents privilege escalation across teams

---

### 4. `audit_logs` - Security & Compliance Audit Trail

**Purpose**: Immutable log of all user actions for security and regulatory compliance

**Storage Principle**: **Truth Layer** - Audit logs are legal records (GDPR, SOC2)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PRIMARY KEY | Unique log entry identifier |
| `userId` | String | FOREIGN KEY (users.id) | Who performed action |
| `action` | Enum | NOT NULL | Action type (see AuditAction) |
| `timestamp` | DateTime | DEFAULT now() | When action occurred (indexed) |
| `payload` | JSON | NULLABLE | Contextual data (e.g., teamId, IP) |
| `ipAddress` | String | NULLABLE | Security tracking |
| `userAgent` | String | NULLABLE | Device/browser fingerprint |

**Indexes**:
```sql
CREATE INDEX idx_audit_logs_user_time ON audit_logs(userId, timestamp DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
```

**Relationships**:
- `audit_logs.userId` → `users.id` (CASCADE DELETE for GDPR compliance)

**Tracked Actions** (14 types):
```typescript
enum AuditAction {
  // Authentication
  SIGNUP,              // New account created
  LOGIN,               // Successful login
  LOGOUT,              // User logged out
  
  // Team Management
  INVITE,              // User invited to team
  JOIN_TEAM,           // User accepted invite
  LEAVE_TEAM,          // User left team
  ROLE_CHANGED,        // Role updated
  
  // Profile
  UPDATE_PROFILE,      // User updated profile
  
  // Authorization
  PERMISSION_GRANTED,  // New permission added
  PERMISSION_REVOKED,  // Permission removed
  
  // Projects (Week 2)
  PROJECT_CREATED,     // New project created
  PROJECT_DELETED,     // Project removed
  
  // Tasks (Week 2)
  TASK_ASSIGNED,       // Task assigned to user
  TASK_COMPLETED       // Task marked done
}
```

**Payload Examples**:
```json
// LOGIN
{ "ipAddress": "203.0.113.42", "userAgent": "Mozilla/5.0..." }

// INVITE
{ "teamId": "clx123", "invitedUserId": "clx456", "roleInTeam": "DEVELOPER" }

// ROLE_CHANGED
{ "teamId": "clx123", "oldRole": "MEMBER", "newRole": "ADMIN" }

// TASK_ASSIGNED
{ "taskId": "mongo_id_123", "projectId": "mongo_id_456", "assignedBy": "clx789" }
```

**Business Rules**:
1. **Immutable**: Audit logs are NEVER updated or deleted (except GDPR requests)
2. **Retention**: Keep for 7 years (regulatory compliance)
3. **Privacy**: Anonymize payload data for GDPR compliance
4. **Performance**: Partition by timestamp for large datasets

**Compliance Use Cases**:
- **GDPR Right to Access**: Generate user activity report from audit logs
- **Security Forensics**: Detect suspicious login patterns (multiple IPs, failed attempts)
- **Debugging**: Reproduce user issues from historical actions
- **SLA Tracking**: Measure response times for support tickets

---

### 5. `role_permissions` - RBAC Permission Matrix

**Purpose**: Define which permissions each role has (centralized authorization)

**Storage Principle**: **Truth Layer** - Permissions are security-critical truth

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (CUID) | PRIMARY KEY | Unique permission entry |
| `role` | Enum | NOT NULL | Role type (see Role enum) |
| `permission` | String | NOT NULL | Permission name (e.g., "create_project") |
| `canAccess` | Boolean | DEFAULT FALSE | Access grant flag |

**Indexes**:
```sql
CREATE UNIQUE INDEX idx_role_permissions_unique ON role_permissions(role, permission);
CREATE INDEX idx_role_permissions_role ON role_permissions(role);
```

**Unique Constraint**: (role, permission) - Each role has one entry per permission

**Permission Naming Convention**:
```
{resource}_{action}

Examples:
- create_project
- delete_project
- invite_team_member
- assign_task
- manage_billing
- view_analytics
```

**Sample Permission Matrix**:

| Permission | OWNER | ADMIN | TEAM_LEAD | DEVELOPER | TESTER | MEMBER |
|------------|:-----:|:-----:|:---------:|:---------:|:------:|:------:|
| `create_project` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `delete_project` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `invite_team_member` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `assign_task` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `update_task` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `view_analytics` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `manage_billing` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Usage in Code**:
```typescript
// Check permission
async hasPermission(userId: string, permission: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const rolePermission = await prisma.rolePermission.findUnique({
    where: { role_permission: { role: user.role, permission } }
  });
  return rolePermission?.canAccess ?? false;
}
```

**Design Decision**:
- **Database-Driven RBAC**: Permissions stored in DB (not hardcoded)
- **Reason**: Allows dynamic permission updates without code deployment
- **Future**: Add team-level permission overrides (Week 5)

---

## Enums

### Role (System-Wide User Role)

```prisma
enum Role {
  OWNER        // System administrator, can manage all teams
  ADMIN        // Platform admin, support access
  TEAM_LEAD    // Default role for team creators
  DEVELOPER    // Standard user role
  TESTER       // QA/testing role
  MEMBER       // Default fallback role
}
```

**Usage**: `users.role` (global permissions across platform)

---

### TeamRole (Team-Specific Role)

```prisma
enum TeamRole {
  OWNER        // Team owner, billing, can delete team
  ADMIN        // Team admin, user management
  TEAM_LEAD    // Project manager, task assignments
  DEVELOPER    // Developer, full task access
  TESTER       // QA engineer, bug tracking
  MEMBER       // Limited access
}
```

**Usage**: `team_members.roleInTeam` (contextual permissions within team)

**Key Difference**: Same names, different contexts
- `users.role = OWNER` → Platform admin (rare)
- `team_members.roleInTeam = OWNER` → Team owner (common)

---

### Gender

```prisma
enum Gender {
  MALE
  FEMALE
  OTHER
  PREFER_NOT_TO_SAY
}
```

**Usage**: `users.gender` (optional profile field)

---

### OAuthProvider

```prisma
enum OAuthProvider {
  GOOGLE
  GITHUB
  MICROSOFT    // Future
}
```

**Usage**: `users.oauthProvider` (which OAuth provider was used)

---

### Plan (Billing Plan)

```prisma
enum Plan {
  FREE         // Up to 5 users, 10 projects
  PRO          // Up to 50 users, unlimited projects
  ENTERPRISE   // Unlimited, SSO, SLA support
}
```

**Usage**: `teams.plan` (billing tier)

---

### AuditAction

```prisma
enum AuditAction {
  // Auth
  SIGNUP
  LOGIN
  LOGOUT
  
  // Teams
  INVITE
  JOIN_TEAM
  LEAVE_TEAM
  ROLE_CHANGED
  
  // Profile
  UPDATE_PROFILE
  
  // Permissions
  PERMISSION_GRANTED
  PERMISSION_REVOKED
  
  // Projects (Week 2)
  PROJECT_CREATED
  PROJECT_DELETED
  
  // Tasks (Week 2)
  TASK_ASSIGNED
  TASK_COMPLETED
}
```

**Usage**: `audit_logs.action` (what action was performed)

---

## Relationships & Constraints

### Foreign Keys

```sql
-- Team ownership
ALTER TABLE teams
  ADD CONSTRAINT fk_teams_owner 
  FOREIGN KEY (ownerId) REFERENCES users(id) ON DELETE CASCADE;

-- Team membership
ALTER TABLE team_members
  ADD CONSTRAINT fk_team_members_team 
  FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE;

ALTER TABLE team_members
  ADD CONSTRAINT fk_team_members_user 
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE team_members
  ADD CONSTRAINT fk_team_members_assigner 
  FOREIGN KEY (assignedBy) REFERENCES users(id) ON DELETE SET NULL;

-- Audit logs
ALTER TABLE audit_logs
  ADD CONSTRAINT fk_audit_logs_user 
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE;
```

### Cascade Behavior

| Parent Delete | Child Table | Behavior | Reason |
|--------------|-------------|----------|--------|
| `users.id` | `teams` | CASCADE | Orphaned teams are invalid |
| `users.id` | `team_members` | CASCADE | User memberships must be removed |
| `users.id` | `audit_logs` | CASCADE | GDPR right to be forgotten |
| `teams.id` | `team_members` | CASCADE | Team deletion removes all members |
| `users.id` (assignedBy) | `team_members` | SET NULL | Keep membership even if assigner deleted |

---

## Data Integrity Rules

### Business Constraints

1. **Email Uniqueness**: `UNIQUE INDEX idx_users_email`
2. **Team Membership Uniqueness**: `UNIQUE INDEX idx_team_members_unique`
3. **Role-Permission Uniqueness**: `UNIQUE INDEX idx_role_permissions_unique`
4. **Non-Null Emails**: `email NOT NULL`
5. **Non-Null Team Names**: `name NOT NULL`

### Security Constraints

1. **Password Hashing**: Never store plaintext passwords
2. **OAuth XOR Password**: User has OAuth OR password, never both (application-level)
3. **Audit Immutability**: No UPDATE/DELETE on audit_logs (application-level)
4. **Soft Deletes**: Set `isActive = FALSE` instead of hard deletes

---

## Migration Strategy

### Initial Schema Creation

```bash
# Create Prisma migration
npx prisma migrate dev --name init

# Apply to production
npx prisma migrate deploy
```

### Schema Evolution (Future Weeks)

**Week 4 - Password Reset**:
```sql
ALTER TABLE users ADD COLUMN resetToken VARCHAR(255);
ALTER TABLE users ADD COLUMN resetTokenExpiry TIMESTAMP;
```

**Week 5 - MFA**:
```sql
ALTER TABLE users ADD COLUMN mfaEnabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN mfaSecret VARCHAR(255);
```

**Week 6 - Billing Integration**:
```sql
CREATE TABLE subscriptions (
  id VARCHAR(50) PRIMARY KEY,
  teamId VARCHAR(50) REFERENCES teams(id),
  stripeSubscriptionId VARCHAR(255),
  status VARCHAR(50),
  currentPeriodEnd TIMESTAMP
);
```

---

## Performance Optimization

### Indexing Strategy

**Query Patterns**:
1. "Get user by email" → `idx_users_email` (UNIQUE)
2. "Get user's teams" → `idx_team_members_user`
3. "Get team members" → `idx_team_members_team`
4. "Get user audit history" → `idx_audit_logs_user_time` (DESC for recent-first)
5. "Get active teams" → `idx_teams_active` (partial index)

### Query Examples

```sql
-- Get user's teams with role
SELECT t.*, tm.roleInTeam
FROM teams t
JOIN team_members tm ON t.id = tm.teamId
WHERE tm.userId = 'clx123'
  AND t.isActive = TRUE;

-- Get user audit trail (last 30 days)
SELECT * FROM audit_logs
WHERE userId = 'clx123'
  AND timestamp > NOW() - INTERVAL '30 days'
ORDER BY timestamp DESC
LIMIT 100;

-- Check permission
SELECT canAccess FROM role_permissions
WHERE role = 'ADMIN' AND permission = 'create_project';
```

---

## Data Archival & Cleanup

### Soft Deletes

```sql
-- Deactivate user (GDPR compliance)
UPDATE users SET isActive = FALSE WHERE id = 'clx123';

-- Deactivate team (cancelled subscription)
UPDATE teams SET isActive = FALSE WHERE id = 'clx456';
```

### Hard Deletes (Regulatory Compliance)

```sql
-- GDPR Right to be Forgotten (30-day delay)
DELETE FROM users WHERE id = 'clx123' AND isActive = FALSE AND updatedAt < NOW() - INTERVAL '30 days';
```

---

## Cross-Database References

### MongoDB Integration (Week 2)

**`users.assignedTasks`** → References MongoDB `tasks._id`

**Design Decision**:
- PostgreSQL stores task IDs as string array
- MongoDB stores full task objects
- **Reason**: Tasks are collaborative (MongoDB), but user assignment is truth (PostgreSQL)

**Synchronization**:
```typescript
// When task assigned
await prisma.user.update({
  where: { id: userId },
  data: { assignedTasks: { push: mongoTaskId } }
});

// When task deleted
await prisma.user.update({
  where: { id: userId },
  data: { assignedTasks: { set: tasks.filter(t => t !== deletedTaskId) } }
});
```

---

## Backup & Recovery

### Daily Backups

```bash
# PostgreSQL dump
pg_dump nexus_ai_auth > backup_$(date +%Y%m%d).sql

# Restore
psql nexus_ai_auth < backup_20250101.sql
```

### Point-in-Time Recovery

Enable PostgreSQL WAL archiving for production:
```sql
-- postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /archive/%f'
```

---

## Architecture Validation

### ✅ Following TaskPulse 2.0 Principles

| Data Category | PostgreSQL Storage | Correct? |
|--------------|-------------------|----------|
| **Identity** (users, teams) | ✅ | ✅ Truth layer |
| **Security** (audit logs, permissions) | ✅ | ✅ Immutable truth |
| **Compliance** (audit trail, GDPR) | ✅ | ✅ ACID required |
| **Collaboration** (tasks, docs) | ❌ MongoDB (Week 2) | ✅ Deferred correctly |
| **AI Memory** (embeddings) | ❌ Vector DB (Week 7) | ✅ Not needed yet |
| **Real-Time** (presence, cursors) | ❌ Redis (Week 3) | ✅ Not needed yet |

### Schema Quality: A+

**Strengths**:
- Clear relational structure
- Proper foreign keys and cascade rules
- Comprehensive audit logging
- RBAC permission matrix
- OAuth integration ready
- GDPR compliant soft deletes

**Future Improvements**:
- Partition `audit_logs` by timestamp (when > 1M rows)
- Add composite indexes for complex queries
- Consider read replicas for analytics queries

---

## Quick Reference

### Table Row Estimates (Production)

| Table | Expected Rows | Growth Rate |
|-------|--------------|-------------|
| `users` | 10K - 100K | Medium |
| `teams` | 5K - 50K | Medium |
| `team_members` | 50K - 500K | High (users × teams) |
| `audit_logs` | 1M - 10M | Very High (every action) |
| `role_permissions` | ~100 | Static (6 roles × ~15 perms) |

### Database Size Estimates

- **Small Team (100 users)**: ~50 MB
- **Medium Team (1K users)**: ~500 MB
- **Large Team (10K users)**: ~5 GB
- **Enterprise (100K users)**: ~50 GB

---

## Revision History

| Date | Change | Reason |
|------|--------|--------|
| Week 1 | Initial schema creation | Auth & teams requirements |
| Week 1 | Added `assignedTasks` to users | MongoDB integration prep |
| Week 1 | Removed personal team auto-creation | Ownership conflicts |
| Week 1 | Added comprehensive documentation | Week 1 plan requirement |
