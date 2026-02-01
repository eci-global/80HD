# Two-Claude Review Examples

This document provides detailed examples of the two-Claude pattern in action, showing how the review process improves plans before implementation.

## Example 1: Rate Limiting System

### Initial Plan (Claude A)

```markdown
# Rate Limiting Implementation Plan

## Overview
Implement rate limiting for the API to prevent abuse.

## Implementation
1. Add Redis dependency
2. Create middleware that checks request count
3. Return 429 Too Many Requests if limit exceeded
4. Configure limits:
   - Free tier: 100 requests/minute
   - Paid tier: 1000 requests/minute

## Steps
1. Install `ioredis` package
2. Create `RateLimitMiddleware` class
3. Implement rate check logic
4. Add middleware to API routes
5. Add tests
```

### Review (Claude B)

```markdown
# Staff Engineer Review

## Critical Issues

**1. Missing graceful degradation**
The plan states "Add Redis dependency" but doesn't address what happens when Redis is unavailable. This will cause API outages.

Required: Fallback strategy (in-memory limits, allow-all, or circuit breaker)

**2. No key strategy defined**
How are requests identified? IP address? User ID? API key?
- IP: Shared IPs (NAT, offices) will hit limits incorrectly
- User ID: Unauthenticated requests can't be rate-limited
- API Key: Not all endpoints require auth

Required: Specify rate limiting key per endpoint type

**3. Distributed rate limiting not addressed**
Multiple API servers will each have their own counters in Redis.
Need atomic increment operations and proper key TTLs.

## Important Improvements

**4. Missing metrics/monitoring**
No mention of emitting metrics for:
- Rate limit hits
- Redis errors
- False positive rates

Should add: DataDog/CloudWatch metrics integration

**5. No gradual backoff**
429 immediately cuts off users. Consider:
- Warning headers at 80% usage
- Gradual backoff (429 for 1 min, then 5 min, etc.)

**6. Per-endpoint limits undefined**
Some endpoints are more expensive (e.g., AI processing vs. health checks).
Should allow different limits per route.

## Nice-to-haves

**7. Admin bypass**
Internal tools should bypass rate limits.
Consider API key flag or IP whitelist.

**8. Rate limit info in headers**
Return `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
Standard practice for developer experience.
```

### Improved Plan (Claude A, Revision 2)

```markdown
# Rate Limiting Implementation Plan v2

## Overview
Implement distributed rate limiting with graceful degradation and comprehensive monitoring.

## Architecture Decisions

**Rate Limiting Keys**:
- Authenticated requests: User ID
- Unauthenticated requests: IP address (with shared IP detection)
- Admin API keys: Bypass flag in key metadata

**Graceful Degradation**:
- Primary: Redis-based distributed limiting
- Fallback: In-memory limiting per instance (if Redis unavailable)
- Circuit breaker: After 3 Redis failures, fall back for 60 seconds

**Per-Endpoint Configuration**:
```typescript
const rateLimits = {
  '/api/health': { limit: 1000, window: '1m' },
  '/api/ai/generate': { limit: 10, window: '1m' },
  '/api/auth/*': { limit: 100, window: '1m' },
};
```

## Implementation Steps

### 1. Redis Client with Fallback
```typescript
class RateLimitStore {
  async increment(key: string): Promise<number> {
    try {
      return await this.redis.incr(key);
    } catch (err) {
      this.circuitBreaker.recordFailure();
      return this.inMemoryStore.increment(key);
    }
  }
}
```

### 2. Rate Limiting Middleware
```typescript
class RateLimitMiddleware {
  async handle(req: Request): Promise<Response | null> {
    const key = this.getKey(req); // user ID or IP
    const limit = this.getLimit(req.path, req.user?.tier);

    const count = await this.store.increment(key);

    // Warning headers at 80%
    if (count > limit * 0.8) {
      req.headers.set('X-RateLimit-Warning', 'Approaching limit');
    }

    if (count > limit) {
      this.metrics.recordLimitHit(key, req.path);
      return new Response('Rate limit exceeded', {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': this.getResetTime().toString(),
          'Retry-After': '60',
        },
      });
    }

    return null; // Continue request
  }
}
```

### 3. Shared IP Detection
```typescript
async getKey(req: Request): Promise<string> {
  const ip = req.headers.get('x-forwarded-for') || req.ip;

  // Check if IP is in shared IP range (NAT, corporate)
  if (await this.isSharedIP(ip)) {
    // Require authentication for shared IPs
    if (!req.user) {
      throw new Error('Authentication required from shared IP');
    }
    return `user:${req.user.id}`;
  }

  return `ip:${ip}`;
}
```

### 4. Metrics Integration
```typescript
class RateLimitMetrics {
  recordLimitHit(key: string, path: string) {
    statsd.increment('rate_limit.exceeded', {
      key_type: key.startsWith('user:') ? 'user' : 'ip',
      endpoint: path,
    });
  }

  recordRedisFallback() {
    statsd.increment('rate_limit.redis.fallback');
  }
}
```

### 5. Admin Bypass
```typescript
if (req.user?.apiKey?.bypassRateLimit) {
  return null; // Skip rate limiting
}

if (this.ipWhitelist.includes(ip)) {
  return null; // Internal tools
}
```

## Testing Strategy

### Unit Tests
- Rate limit counting (in-memory and Redis)
- Circuit breaker behavior
- Shared IP detection
- Per-endpoint limits

### Integration Tests
- Redis failure scenarios
- Multi-instance coordination
- Rate limit headers correctness

### Load Tests
- Verify limits under concurrent load
- Redis performance under load
- Fallback performance

## Rollout Plan

1. **Phase 1**: Deploy with monitoring only (log but don't block)
2. **Phase 2**: Enable for free tier only
3. **Phase 3**: Enable for all tiers
4. **Phase 4**: Tune limits based on metrics

## Monitoring

**Dashboards**:
- Rate limit hit rate by endpoint
- Redis availability
- Fallback activation frequency
- False positive rate (support tickets about incorrect limits)

**Alerts**:
- Redis unavailable > 5 minutes
- Rate limit hit rate > 10% of requests
- Fallback mode active

## Documentation

Update API docs with:
- Rate limit tiers
- Rate limit headers
- How to request limit increase
- Best practices for handling 429 responses
```

### What Changed

The review caught:
1. **Critical**: Redis fallback strategy
2. **Critical**: Rate limiting key strategy
3. **Critical**: Distributed counter handling
4. **Important**: Monitoring and metrics
5. **Important**: Gradual degradation
6. **Important**: Per-endpoint configuration
7. **Nice**: Admin bypass
8. **Nice**: Standard rate limit headers

The improved plan is production-ready. The original plan would have created an outage when Redis failed.

---

## Example 2: Authentication Refactor (JWT Migration)

### Initial Plan (Claude A)

```markdown
# JWT Authentication Migration

## Goal
Replace session-based auth with JWT tokens.

## Steps
1. Install `jsonwebtoken` library
2. Create token generation endpoint
3. Update login to return JWT
4. Create middleware to verify JWT
5. Replace session checks with JWT checks
6. Remove session storage

## Implementation
- Generate JWT on successful login
- Include user ID and email in token
- 24 hour expiration
- Verify signature on each request
```

### Review (Claude B)

```markdown
# Security-Focused Review

## Critical Issues

**1. No refresh token strategy**
24 hour expiration means users stay logged in for a full day even after password change, account compromise, or permission revocation.

Security risk: High
Required: Implement refresh tokens with shorter access token lifespan (15 min access, 7 day refresh)

**2. No token revocation mechanism**
JWT is stateless - you can't revoke tokens. If a token is compromised, it's valid until expiration.

Required: Add token blacklist (Redis) or include version number that increments on password change

**3. Secrets management undefined**
Where is JWT signing key stored? If hardcoded or in env file, rotating it invalidates all tokens.

Required: Use KMS or secrets manager, plan for key rotation

**4. Missing token scope/permissions**
Including just "user ID and email" means all tokens have full access. No way to create limited-scope tokens for API integrations.

Required: Add `scope` or `permissions` claim

## Important Improvements

**5. No migration strategy**
"Remove session storage" - what about currently logged-in users? They'll all be logged out.

Should: Support both auth types during migration, gradually deprecate sessions

**6. Missing token binding**
JWTs are bearer tokens - anyone with the token can use it. No device binding or IP validation.

Consider: Add `device_id` claim and verify on requests

**7. No rate limiting on token generation**
Login endpoint returning JWTs needs rate limiting to prevent brute force.

Should: Add rate limiting to login endpoint

**8. Logging sensitive data risk**
Plan doesn't specify what NOT to log. JWTs in logs = security breach.

Required: Mask tokens in logs, never log full tokens

## Security Concerns

**9. XSS vulnerability**
Where is JWT stored client-side? LocalStorage? Vulnerable to XSS.

Should: Use httpOnly cookies for web clients, or document secure storage requirements

**10. No CSRF protection**
If using cookies for JWT, need CSRF tokens.

Required: CSRF protection strategy

**11. Signature algorithm not specified**
Using HS256 (symmetric) vs RS256 (asymmetric) has security implications.

Recommend: RS256 for public/private key separation
```

### Improved Plan (Claude A, Revision 2)

```markdown
# JWT Authentication Migration - Security Hardened

## Architecture

**Token Strategy**:
- Short-lived access tokens (15 minutes, JWT)
- Long-lived refresh tokens (7 days, opaque, stored in DB)
- Refresh endpoint to get new access token

**Secrets Management**:
- Signing keys in AWS KMS
- Automatic key rotation every 90 days
- Support multiple active keys for rotation overlap

**Token Structure**:
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "scope": ["read:profile", "write:data"],
  "device_id": "device_uuid",
  "key_version": 2,
  "iat": 1234567890,
  "exp": 1234568790
}
```

## Security Controls

### 1. Token Revocation
```typescript
// Check token version against user's current version
if (token.key_version < user.token_version) {
  throw new UnauthorizedError('Token revoked');
}

// Increment version on password change
async function changePassword(userId: string, newPassword: string) {
  await db.user.update({
    where: { id: userId },
    data: {
      password: await hash(newPassword),
      token_version: { increment: 1 }, // Invalidates all tokens
    },
  });
}
```

### 2. Refresh Token Rotation
```typescript
// Each refresh generates new access + refresh token
async function refresh(oldRefreshToken: string): Promise<Tokens> {
  const refresh = await db.refreshToken.findUnique({
    where: { token: oldRefreshToken },
  });

  if (!refresh || refresh.expiresAt < new Date()) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Revoke old refresh token (single use)
  await db.refreshToken.delete({ where: { id: refresh.id } });

  // Create new pair
  return generateTokenPair(refresh.userId);
}
```

### 3. Device Binding
```typescript
// Bind token to device fingerprint
function generateAccessToken(user: User, device: Device) {
  return jwt.sign({
    sub: user.id,
    device_id: device.id,
    // ... other claims
  }, signingKey);
}

// Verify device matches
if (token.device_id !== req.device.id) {
  this.audit.log('token_device_mismatch', { user, token, device });
  throw new UnauthorizedError('Token/device mismatch');
}
```

### 4. XSS Protection
```typescript
// Store access token in memory (not localStorage)
// Store refresh token in httpOnly cookie
res.cookie('refresh_token', refreshToken, {
  httpOnly: true,
  secure: true, // HTTPS only
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

// Return access token in response body
return { access_token: accessToken };
```

### 5. Rate Limiting
```typescript
// Login endpoint: 5 attempts per 15 minutes
rateLimiter.configure('/auth/login', {
  limit: 5,
  window: '15m',
  keyBy: (req) => req.ip,
});

// Refresh endpoint: 10 per hour
rateLimiter.configure('/auth/refresh', {
  limit: 10,
  window: '1h',
  keyBy: (req) => req.cookies.refresh_token,
});
```

### 6. Audit Logging
```typescript
// Log auth events (but not tokens!)
audit.log('jwt_issued', {
  user_id: user.id,
  device_id: device.id,
  ip: req.ip,
  scope: token.scope,
  // Never log the actual token
});

audit.log('jwt_verified', {
  user_id: token.sub,
  endpoint: req.path,
  // Never log the actual token
});
```

## Migration Strategy

### Phase 1: Dual Authentication (Week 1-2)
```typescript
// Support both session and JWT
async function authenticate(req: Request): Promise<User> {
  // Try JWT first
  const jwt = extractJWT(req);
  if (jwt) {
    return await verifyJWT(jwt);
  }

  // Fall back to session
  const session = extractSession(req);
  if (session) {
    return await verifySession(session);
  }

  throw new UnauthorizedError();
}
```

### Phase 2: JWT Default (Week 3-4)
- New logins get JWT
- Existing sessions continue to work
- Add banner: "Your session will expire in X days, please re-login"

### Phase 3: Session Deprecation (Week 5-6)
- Stop creating new sessions
- Existing sessions expire naturally
- Monitor session usage (should trend to 0)

### Phase 4: Cleanup (Week 7)
- Remove session code
- Remove session storage

## Testing

### Security Tests
- [ ] Expired token rejected
- [ ] Revoked token (via version) rejected
- [ ] Token with wrong device_id rejected
- [ ] Token with invalid signature rejected
- [ ] Refresh token single-use enforced
- [ ] Rate limiting on login works
- [ ] XSS attack doesn't steal refresh token

### Migration Tests
- [ ] Users with sessions can still authenticate
- [ ] Users with JWTs can authenticate
- [ ] Session users can upgrade to JWT
- [ ] No users logged out during migration

## Rollout Monitoring

**Metrics**:
- JWT vs session authentication split
- Token verification failures by reason
- Refresh token usage rate
- Device mismatch rate
- Key rotation success rate

**Alerts**:
- Token verification failure rate > 5%
- Device mismatch rate > 1%
- KMS unavailable
- Refresh token database errors
```

### What Changed

The security review caught:
1. **Critical**: Missing refresh token strategy
2. **Critical**: No token revocation mechanism
3. **Critical**: Undefined secrets management
4. **Critical**: Missing token scope
5. **Important**: No migration strategy (users logged out)
6. **Important**: Missing device binding
7. **Important**: No rate limiting
8. **Important**: Risk of logging sensitive data
9. **Security**: XSS vulnerability via localStorage
10. **Security**: Missing CSRF protection
11. **Security**: Unspecified signature algorithm

The original plan would have created multiple security vulnerabilities and logged out all users during migration.

---

## Example 3: Database Schema Migration

### Initial Plan (Claude A)

```markdown
# Add User Preferences Table

## Goal
Store user preferences (theme, notifications, timezone).

## Schema
```sql
CREATE TABLE user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  theme VARCHAR(20),
  notifications BOOLEAN,
  timezone VARCHAR(50)
);
```

## Migration
1. Create table
2. Add default preferences for existing users
3. Update API to use preferences
```

### Review (Claude B)

```markdown
# Database Design Review

## Critical Issues

**1. No constraints on valid values**
`theme VARCHAR(20)` accepts any string. What are valid themes? 'dark', 'light', 'blue-raspberry'?

Required: Use ENUM or CHECK constraint

**2. No unique constraint**
A user can have multiple preference rows. Is that intentional?

Required: UNIQUE constraint on user_id or composite key

**3. Nullable columns undefined**
Can theme be NULL? Can timezone be NULL? What are the defaults?

Required: Specify NOT NULL and DEFAULT for each column

**4. Foreign key missing ON DELETE**
If user is deleted, preferences are orphaned.

Required: Add ON DELETE CASCADE

## Important Improvements

**5. No created_at/updated_at**
Can't audit when preferences changed.

Should: Add timestamp columns

**6. Rigid schema**
Adding new preferences requires schema migration. Consider JSONB column for flexibility.

Should: Add `settings JSONB` for ad-hoc preferences

**7. No indexes**
Looking up preferences by user_id will be slow.

Should: CREATE INDEX ON user_preferences(user_id)

**8. Migration not idempotent**
Running migration twice will error. Need IF NOT EXISTS.

Required: Idempotent migrations

**9. No rollback plan**
If migration fails halfway, how do you recover?

Should: Transaction wrapping, rollback script

## Schema Improvements

**Recommended schema**:
```sql
CREATE TYPE theme_type AS ENUM ('light', 'dark', 'system');

CREATE TABLE user_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme theme_type NOT NULL DEFAULT 'system',
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  push_notifications BOOLEAN NOT NULL DEFAULT true,
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
```

**Better**: Use user_id as primary key (one preference per user)
```

### Improved Plan (Claude A, Revision 2)

```markdown
# User Preferences Schema Migration

## Schema Design

### Type Definitions
```sql
-- Theme enum (extensible)
CREATE TYPE theme_type AS ENUM ('light', 'dark', 'system', 'high_contrast');

-- Notification types
CREATE TYPE notification_channel AS ENUM ('email', 'push', 'sms', 'slack');
```

### Table Structure
```sql
CREATE TABLE user_preferences (
  -- Primary key is user_id (one preference per user)
  user_id INTEGER PRIMARY KEY
    REFERENCES users(id) ON DELETE CASCADE,

  -- Typed preferences with defaults
  theme theme_type NOT NULL DEFAULT 'system',
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',

  -- Notification preferences (per channel)
  notification_settings JSONB NOT NULL DEFAULT '{
    "email": {"enabled": true, "frequency": "realtime"},
    "push": {"enabled": true, "frequency": "realtime"},
    "sms": {"enabled": false},
    "slack": {"enabled": false}
  }'::jsonb,

  -- Flexible settings for future preferences
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_timezone CHECK (
    timezone IN (SELECT name FROM pg_timezone_names)
  ),
  CONSTRAINT valid_notification_settings CHECK (
    jsonb_typeof(notification_settings) = 'object'
  )
);

-- Index for fast lookups (though PK already indexed)
CREATE INDEX idx_user_preferences_updated
  ON user_preferences(updated_at DESC);

-- GIN index for JSONB queries
CREATE INDEX idx_user_preferences_settings
  ON user_preferences USING GIN (settings);
```

## Migration Scripts

### Up Migration (V1__add_user_preferences.sql)
```sql
BEGIN;

-- Create types (idempotent)
DO $$ BEGIN
  CREATE TYPE theme_type AS ENUM ('light', 'dark', 'system', 'high_contrast');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create table (idempotent)
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INTEGER PRIMARY KEY
    REFERENCES users(id) ON DELETE CASCADE,
  theme theme_type NOT NULL DEFAULT 'system',
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  notification_settings JSONB NOT NULL DEFAULT '{
    "email": {"enabled": true, "frequency": "realtime"},
    "push": {"enabled": true, "frequency": "realtime"},
    "sms": {"enabled": false},
    "slack": {"enabled": false}
  }'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_timezone CHECK (
    timezone IN (SELECT name FROM pg_timezone_names)
  ),
  CONSTRAINT valid_notification_settings CHECK (
    jsonb_typeof(notification_settings) = 'object'
  )
);

-- Create indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_user_preferences_updated
  ON user_preferences(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_preferences_settings
  ON user_preferences USING GIN (settings);

-- Backfill existing users with default preferences
INSERT INTO user_preferences (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

-- Verify backfill
DO $$
DECLARE
  user_count INTEGER;
  pref_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM users;
  SELECT COUNT(*) INTO pref_count FROM user_preferences;

  IF user_count != pref_count THEN
    RAISE EXCEPTION 'Preference backfill incomplete: % users, % preferences',
      user_count, pref_count;
  END IF;
END $$;

COMMIT;
```

### Down Migration (V1__add_user_preferences_rollback.sql)
```sql
BEGIN;

-- Drop in reverse order
DROP INDEX IF EXISTS idx_user_preferences_settings;
DROP INDEX IF EXISTS idx_user_preferences_updated;
DROP TABLE IF EXISTS user_preferences;
DROP TYPE IF EXISTS theme_type;

COMMIT;
```

### Trigger for updated_at
```sql
-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Testing Strategy

### Pre-Migration Tests
```sql
-- Count existing users
SELECT COUNT(*) FROM users;

-- Verify no orphaned data
SELECT COUNT(*) FROM user_preferences; -- Should be 0
```

### Post-Migration Tests
```sql
-- Verify all users have preferences
SELECT COUNT(*) FROM users u
LEFT JOIN user_preferences up ON u.id = up.user_id
WHERE up.user_id IS NULL;
-- Should return 0

-- Verify defaults applied
SELECT theme, COUNT(*) FROM user_preferences GROUP BY theme;
-- Should show all 'system'

-- Verify constraints work
INSERT INTO user_preferences (user_id, theme)
VALUES (1, 'invalid'); -- Should fail

-- Verify ON DELETE CASCADE
DELETE FROM users WHERE id = 999; -- Should cascade to preferences
```

### Application Tests
```typescript
describe('UserPreferences', () => {
  it('creates preferences for new users', async () => {
    const user = await createUser();
    const prefs = await UserPreferences.findByUserId(user.id);
    expect(prefs.theme).toBe('system');
  });

  it('enforces one preference per user', async () => {
    const user = await createUser();
    await UserPreferences.create({ userId: user.id });
    await expect(
      UserPreferences.create({ userId: user.id })
    ).rejects.toThrow('duplicate key');
  });

  it('cascades delete', async () => {
    const user = await createUser();
    await user.delete();
    const prefs = await UserPreferences.findByUserId(user.id);
    expect(prefs).toBeNull();
  });
});
```

## Rollout Plan

### Phase 1: Schema Migration (Off-Peak Hours)
1. Run migration in transaction
2. Verify backfill count matches user count
3. If error: Rollback automatically (transaction fails)
4. If success: Commit

### Phase 2: Application Deployment
1. Deploy code that READS preferences (but still uses old defaults)
2. Monitor for errors
3. If stable for 24 hours, proceed

### Phase 3: Preference Writes
1. Deploy code that WRITES user preference changes
2. Monitor write patterns
3. Verify updated_at trigger working

### Phase 4: Remove Old Default Logic
1. Remove hardcoded defaults from application
2. Fully rely on database preferences

## Monitoring

### Migration Monitoring
- Row count in user_preferences (should equal users count)
- Migration execution time
- Database lock duration
- Rollback triggers

### Application Monitoring
- Preference read latency
- Preference write errors
- Invalid timezone attempts
- JSONB query performance

## Rollback Strategy

### If migration fails mid-transaction:
- Automatic rollback (COMMIT never executed)
- No data corruption

### If discovered issues post-migration:
1. Run down migration script
2. Users revert to application defaults
3. Fix issues
4. Re-run migration

### If only partial backfill:
```sql
-- Re-run backfill (idempotent)
INSERT INTO user_preferences (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;
```
```

### What Changed

The database review caught:
1. **Critical**: No constraints on valid values
2. **Critical**: No unique constraint (duplicate preferences)
3. **Critical**: Undefined NULL handling
4. **Critical**: Missing ON DELETE CASCADE
5. **Important**: No audit timestamps
6. **Important**: Rigid schema (no flexibility)
7. **Important**: Missing indexes
8. **Important**: Migration not idempotent
9. **Important**: No rollback plan

The improved plan has proper constraints, idempotent migrations, rollback strategy, and testing.

---

## Key Patterns Across Examples

### Common Issues Caught by Reviews

1. **Graceful degradation** - What happens when dependencies fail?
2. **Migration strategy** - How do existing users/data transition?
3. **Security gaps** - Authentication, authorization, secrets management
4. **Missing constraints** - Validation, uniqueness, referential integrity
5. **No monitoring** - Metrics, logging, alerts
6. **Rollback plans** - What if something goes wrong?
7. **Performance** - Indexes, caching, N+1 queries
8. **Testing strategy** - What needs to be tested?

### Review Checklist Template

For any plan, the reviewer should ask:

**Architecture**:
- [ ] What happens when each dependency fails?
- [ ] How does this scale?
- [ ] What are the performance implications?

**Security**:
- [ ] What are the security risks?
- [ ] How is sensitive data protected?
- [ ] What's the attack surface?

**Migration**:
- [ ] How do existing users/data transition?
- [ ] Can this be rolled back?
- [ ] Is the migration idempotent?

**Operations**:
- [ ] What metrics should we track?
- [ ] What should we alert on?
- [ ] How do we debug issues?

**Testing**:
- [ ] What's the testing strategy?
- [ ] How do we verify correctness?
- [ ] What edge cases exist?

**Alternatives**:
- [ ] Is there a simpler approach?
- [ ] What are we over-engineering?
- [ ] What can we defer?
