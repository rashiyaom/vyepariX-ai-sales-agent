# VYAPERI X — Master Backend Build Prompt

> Copy everything below this line into your AI coding agent (Claude Code, etc.) as the build instruction. It fully specifies the backend architecture, stack, schema, and module behavior so the agent can build against a single source of truth instead of improvising decisions.

---

## ROLE

You are building the complete backend for **VYAPERI X**, an autonomous AI sales intelligence and multilingual voice platform. The frontend already exists as a dummy/static UI (React 19 + TanStack Start, Vite, Tailwind v4) with no real backend behind it. Your job is to build the real backend that the existing frontend routes (`dashboard.registry`, `dashboard.simulation`, `dashboard.policies`, `dashboard.inspector`) will eventually call.

Do not modify the frontend unless a specific integration point requires a contract change — flag any such case rather than silently changing frontend code.

---

## TECH STACK (fixed — do not substitute without flagging why)

| Layer | Choice |
|---|---|
| Runtime | Node.js 20+, ESM, TypeScript 5.8 |
| API framework | Express 4.x |
| Database | PostgreSQL 16 + Prisma ORM |
| Cache/queue | Redis + BullMQ (background jobs: discovery, enrichment, retries) |
| Real-time | `ws` for WebSocket telemetry (`/ws/voice-telemetry`) |
| **LLM provider** | **Groq** (OpenAI-compatible API) — replaces any Claude/Anthropic reference. Base URL: `https://api.groq.com/openai/v1` |
| STT/TTS (Hindi/Gujarati/English + code-switching) | **Sarvam AI** (Saaras V3 for STT, Bulbul V3 for TTS) |
| STT/TTS (other languages / fallback) | ElevenLabs (TTS) + Groq-hosted Whisper (STT) as fallback for languages Sarvam doesn't cover |
| Telephony | Twilio (SIP) — confirm with the team whether the real-time media path is a raw Twilio Media Streams WebSocket bridge or LiveKit Agents; default to **LiveKit Agents** if the team hasn't decided, since it has built-in STT→LLM→TTS pipeline plugins and native Groq support |
| Auth | JWT-based, RBAC middleware, org-scoped multi-tenancy |
| Payments | Stripe (global) — add Razorpay as a secondary provider if serving India specifically |

### Explicit substitutions from any prior spec
- **Claude/Anthropic → Groq.** Every LLM call in the backend uses the Groq client, not `@anthropic-ai/sdk`.
- **Model selection per use case** (do not use one model for everything):
  - Real-time voice-agent conversational turns → `llama-3.1-8b-instant` (lowest latency, needed for natural call pacing).
  - Business Understanding, qualification reasoning, market intelligence synthesis → `llama-3.3-70b-versatile`.
  - Lead enrichment field extraction, discovery keyword generation → `openai/gpt-oss-120b`.
- **TTS**: ElevenLabs stays for non-Indian languages; add Sarvam Bulbul V3 for Hindi/Gujarati/English/code-mixed output. Route by requested language code.
- **STT**: Sarvam Saaras V3 primary for Hindi/Gujarati/English; Groq-hosted Whisper as a cheap fallback for other languages the org configures.

---

## ENVIRONMENT VARIABLES

Update `backend/.env.example` to this full set:

```ini
# Server & Origin
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:8080

# Security & JWT
JWT_SECRET=super_secret_jwt_key_32_characters_min
JWT_EXPIRES_IN=7d

# Database & Redis
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vyaperi_x_db?schema=public
REDIS_URL=redis://localhost:6379

# LLM Provider
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx

# Voice: STT/TTS (Indian languages)
SARVAM_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx

# Voice: STT/TTS (fallback / other languages)
ELEVENLABS_API_KEY=el_xxxxxxxxxxxxxxxxxxxxxxxx

# Telephony
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+18005550199
LIVEKIT_URL=wss://livekit.vyaperix.internal
LIVEKIT_API_KEY=APIxxxxxxxx
LIVEKIT_API_SECRET=secretxxxxxxx

# Payments
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here
RAZORPAY_KEY_ID=your_razorpay_key_id_here
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx

# Discovery source integrations (fill in as connectors are built)
LINKEDIN_API_CREDENTIALS=xxxxxxxxxxxxxxxxxxxxxxxx
X_API_BEARER_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxx

# Defaults
DEFAULT_VOICE_LANGUAGE=en-IN
```

Do not commit real values. Confirm `.gitignore` excludes `.env`.

---

## DATABASE SCHEMA (Prisma) — build these models

```prisma
model Organization {
  id            String   @id @default(uuid())
  name          String
  createdAt     DateTime @default(now())
  users         User[]
  businessProfile BusinessProfile?
  leads         Lead[]
  campaigns     Campaign[]
  crmConnections CRMConnection[]
  subscription  Subscription?
  auditLogs     AuditLog[]
  fraudFlags    FraudFlag[]
}

model User {
  id             String   @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  email          String   @unique
  passwordHash   String
  role           Role     @default(SALES_REP)
  createdAt      DateTime @default(now())
}

enum Role {
  OWNER
  SALES_MANAGER
  SALES_REP
  PLATFORM_ADMIN
}

model BusinessProfile {
  id             String   @id @default(uuid())
  organizationId String   @unique
  organization   Organization @relation(fields: [organizationId], references: [id])
  sourceUrl      String?
  description    String?
  derivedServices Json     // AI-derived structured services/products
  icp            Json      // AI-derived ideal customer profile
  keywords       String[]
  updatedAt      DateTime @updatedAt
}

model Lead {
  id               String   @id @default(uuid())
  organizationId   String
  organization     Organization @relation(fields: [organizationId], references: [id])
  source           LeadSource   // UPLOADED | DISCOVERED
  status           LeadStatus   @default(NEW)
  companyName      String?
  contactName      String?
  phone            String?
  email            String?
  timezone         String?
  opportunity      Opportunity?
  enrichment       EnrichmentData?
  qualification    QualificationScore?
  campaignId       String?
  campaign         Campaign?   @relation(fields: [campaignId], references: [id])
  calls            Call[]
  createdAt        DateTime @default(now())
}

enum LeadSource { UPLOADED DISCOVERED }
enum LeadStatus { NEW ENRICHED QUALIFIED CONTACTED INTERESTED NOT_INTERESTED CALLBACK CONVERTED }

model Opportunity {
  id               String   @id @default(uuid())
  leadId           String   @unique
  lead             Lead     @relation(fields: [leadId], references: [id])
  sourcePlatform   String   // 'linkedin' | 'x' | 'job_board' | 'bidding_platform' | 'freelance_platform' | 'directory' | etc.
  originalPostUrl  String
  postText          String
  matchedKeywords  String[]
  discoveredAt     DateTime @default(now())
}

model EnrichmentData {
  id             String   @id @default(uuid())
  leadId         String   @unique
  lead           Lead     @relation(fields: [leadId], references: [id])
  fields         Json     // companySize, industry, techStack, funding, socialLinks, etc.
  dataSource     String
  confidenceScore Float
  updatedAt      DateTime @updatedAt
}

model QualificationScore {
  id             String   @id @default(uuid())
  leadId         String   @unique
  lead           Lead     @relation(fields: [leadId], references: [id])
  fitScore       Float
  intentScore    Float
  reachabilityScore Float
  reasoning      String   // LLM-generated explanation
  priority       String   // HIGH | MEDIUM | LOW
  scoredAt       DateTime @default(now())
}

model Campaign {
  id             String   @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  name           String
  goal           String
  languages      String[]   // e.g. ['hi-IN', 'gu-IN', 'en-IN']
  callingHoursStart String  // e.g. '09:00'
  callingHoursEnd   String  // e.g. '18:00'
  timezonePolicy  String    // e.g. 'lead-local-timezone'
  maxRetries      Int      @default(3)
  retrySpacingHrs Int      @default(24)
  status          CampaignStatus @default(DRAFT)
  leads           Lead[]
  calls           Call[]
  createdAt       DateTime @default(now())
}

enum CampaignStatus { DRAFT SCHEDULED RUNNING PAUSED COMPLETED }

model Call {
  id             String   @id @default(uuid())
  campaignId     String
  campaign       Campaign @relation(fields: [campaignId], references: [id])
  leadId         String
  lead           Lead     @relation(fields: [leadId], references: [id])
  direction      CallDirection
  telephonyCallSid String  @unique
  status         String   // initiated | in-progress | completed | failed | no-answer | voicemail
  language       String
  attemptNumber  Int      @default(1)
  transcript     TranscriptTurn[]
  summary        String?
  sentiment      String?  // interested | not-interested | callback | needs-followup | hostile
  nextBestAction String?
  startedAt      DateTime @default(now())
  endedAt        DateTime?
}

enum CallDirection { OUTBOUND INBOUND }

model TranscriptTurn {
  id        String   @id @default(uuid())
  callId    String
  call      Call     @relation(fields: [callId], references: [id])
  speaker   String   // 'agent' | 'human'
  text      String
  language  String
  createdAt DateTime @default(now())
}

model CRMConnection {
  id             String   @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  provider       String   // 'salesforce' | 'hubspot' | 'zoho'
  credentials    Json
  lastSyncedAt   DateTime?
}

model Subscription {
  id             String   @id @default(uuid())
  organizationId String   @unique
  organization   Organization @relation(fields: [organizationId], references: [id])
  plan           String
  status         String
  voiceMinutesUsed Float  @default(0)
  voiceMinutesCap  Float?
  renewsAt       DateTime?
}

model AuditLog {
  id             String   @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  actorUserId    String?
  action         String
  metadata       Json?
  createdAt      DateTime @default(now())
}

model FraudFlag {
  id             String   @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  type           String   // 'call_volume_anomaly' | 'dnc_violation' | 'login_anomaly' etc.
  details        Json
  resolved       Boolean  @default(false)
  createdAt      DateTime @default(now())
}

model DncEntry {
  phoneNumber String  @id
  reason      String?
  addedAt     DateTime @default(now())
}
```

Run `npx prisma migrate dev --name init` after this schema is in place.

---

## SERVICES TO BUILD (`backend/src/services/`)

Build each as its own module with a clear exported interface. Each should be independently testable.

### 1. `groqClient.ts`
Central Groq client wrapper. Exposes `getCompletion({ model, systemPrompt, messages, maxTokens })`. All other services call this rather than instantiating their own client.

### 2. `businessUnderstanding.ts`
- Input: URL and/or free text and/or uploaded doc text.
- Crawl the URL (or accept pre-extracted doc text), chunk, and call Groq (`llama-3.3-70b-versatile`) to produce: `derivedServices`, `icp` (industry, company size range, geography, buying-signal keywords).
- Persist to `BusinessProfile`.
- Expose an edit/override endpoint so a human can correct the AI output before it's used downstream.

### 3. `discoveryEngine.ts`
- BullMQ worker, scheduled per organization.
- For each configured source connector (LinkedIn, X, job boards, bidding/freelance platforms, directories), run a keyword-driven query built from `BusinessProfile.keywords`.
- Normalize each hit into a `Lead` + `Opportunity` record with `sourcePlatform`, `originalPostUrl`, `postText`, `matchedKeywords`.
- **Mandatory**: never persist an Opportunity without a working `originalPostUrl` — source transparency is non-negotiable per product spec.
- Respect each source's ToS; prefer official APIs (flag any connector that currently only has a scraping path, don't silently ship it as production-ready).

### 4. `enrichmentEngine.ts`
- BullMQ worker triggered after a lead is created (uploaded or discovered).
- Calls third-party enrichment API(s) + Groq (`gpt-oss-120b`) to extract structured fields from unstructured public data.
- Persist to `EnrichmentData` with `dataSource` and `confidenceScore` always populated.

### 5. `qualificationEngine.ts`
- Input: a lead's `EnrichmentData` + `Opportunity` + the org's `BusinessProfile.icp`.
- Calls Groq (`llama-3.3-70b-versatile`) to produce `fitScore`, `intentScore`, `reachabilityScore`, and a plain-language `reasoning` string.
- Configurable weighting per organization (store weight config on `Organization` or a settings table if not already present).

### 6. `campaignScheduler.ts`
- Given a `Campaign`, resolve each lead's timezone and only enqueue calls within `callingHoursStart`/`callingHoursEnd` in the lead's local time.
- Enforce `maxRetries` / `retrySpacingHrs` via BullMQ delayed jobs.
- Check every number against `DncEntry` before enqueueing — hard fail (skip + log) if present.

### 7. `voiceAgentService.ts` (the core real-time engine)
- Handles both outbound (triggered by `campaignScheduler`) and inbound calls.
- Pipeline per turn: telephony audio → STT (Sarvam primary, Groq Whisper fallback by language) → Groq LLM (`llama-3.1-8b-instant`, system prompt built from `BusinessProfile` + `Campaign.goal` + language) → TTS (Sarvam or ElevenLabs by language) → audio back to caller.
- Must implement barge-in (stop TTS playback immediately if STT detects caller speech mid-response).
- Must implement voicemail detection and a distinct voicemail-message flow.
- Every turn writes a `TranscriptTurn` as it happens, not just at call end (so a dropped call still leaves a partial transcript).
- On call end: generate `summary`, `sentiment`, and `nextBestAction` via one final Groq call over the full transcript; update `Call` and cascade `Lead.status` if the outcome warrants it (e.g. sentiment = interested → `Lead.status = INTERESTED`).
- Stream live call state over `/ws/voice-telemetry` (call started, turn completed, sentiment update, call ended) for the `dashboard.simulation` / `dashboard.inspector` frontend routes to consume.
- **Decide and document** whether this is implemented as a raw Twilio Media Streams WebSocket bridge or as a LiveKit Agent pipeline before writing code — do not mix both patterns in the same service.

### 8. `crmSyncService.ts`
- Two-way sync per connected CRM: push `INTERESTED`/`CONVERTED` leads and call outcomes out; pull existing contacts in on a schedule and via webhook where the CRM supports it.

### 9. `analyticsService.ts`
- Aggregation queries (funnel stage counts, campaign performance, voice metrics: connect rate, avg call duration, sentiment distribution, cost per call) exposed via `/api/v1/intelligence/insights` and campaign-specific endpoints.

### 10. `billingService.ts`
- Stripe/Razorpay integration: subscription create/update/cancel, webhook handlers, usage metering writes to `Subscription.voiceMinutesUsed` after each call, cap enforcement (block new outbound calls if `voiceMinutesUsed >= voiceMinutesCap`).

### 11. `auditService.ts` + `fraudDetectionService.ts`
- `auditService`: a single `logAction(orgId, actorUserId, action, metadata)` helper called from every mutating controller.
- `fraudDetectionService`: scheduled job scanning recent `Call`/`AuditLog` volume per org for anomalies (spike detection, repeated DNC-list hits, login anomalies); writes `FraudFlag` and triggers a notification.

### 12. `notificationService.ts`
- Channels: in-app (DB-backed, polled or pushed via the existing WebSocket hub), email, and mobile push (FCM/APNs) once mobile clients exist.
- Trigger points: interested-prospect found, campaign completed, voice usage nearing cap, billing failure, fraud flag raised.

---

## API ROUTES (`backend/src/routes/`, mounted under `/api/v1`)

Match and extend the existing documented endpoints:

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/auth/me

POST   /api/v1/business-profile/enrich
POST   /api/v1/business-profile/validate-products
GET    /api/v1/business-profile

POST   /api/v1/leads/discover
POST   /api/v1/leads/upload            (CSV/Excel — new, needed for "Calling Only" mode)
GET    /api/v1/leads
GET    /api/v1/leads/:id
POST   /api/v1/leads/export

GET    /api/v1/intelligence/insights

POST   /api/v1/campaigns
GET    /api/v1/campaigns
GET    /api/v1/campaigns/:id
PATCH  /api/v1/campaigns/:id

POST   /api/v1/voice-agents            (config: languages, voice, script/goal per campaign)
GET    /api/v1/calls/:id
GET    /api/v1/calls/:id/transcript

POST   /api/v1/crm/connect
POST   /api/v1/crm/sync

GET    /api/v1/billing/subscription
POST   /api/v1/billing/checkout
POST   /api/v1/billing/webhook

GET    /api/v1/audit-logs
GET    /api/v1/fraud-flags
```

All routes except `/auth/register` and `/auth/login` require JWT auth + org-scoped RBAC middleware.

---

## MIDDLEWARE REQUIREMENTS (`backend/src/middleware/`)

- `authJwt.ts` — verifies JWT, attaches `req.user` and `req.organizationId`.
- `rbac.ts` — role-gate decorator/middleware, e.g. `requireRole(['OWNER', 'SALES_MANAGER'])`.
- `rateLimiter.ts` — per-org and per-IP limits, stricter on `/leads/discover` and `/voice-agents` (cost-bearing operations) than read endpoints.
- `errorBoundary.ts` — centralized error handler; never leak stack traces to clients in production; log full detail server-side.
- `auditMiddleware.ts` — auto-log mutating requests (POST/PATCH/DELETE) via `auditService.logAction`.

---

## SECURITY REQUIREMENTS

- Encrypt PII fields (phone, email) and call recordings/transcripts at rest (Postgres column-level encryption or application-layer encryption before write — pick one and apply consistently).
- TLS everywhere in transit (assumed via hosting, but WebSocket must be WSS in any non-local environment).
- Secrets only via environment variables / a secrets manager — never hardcoded, never logged.
- Every DNC/consent check happens server-side before a call is enqueued — never trust a client-side check.

---

## CODING CONVENTIONS

- ESM throughout (`"type": "module"` already implied by ES2022 TS config).
- Each service exports a plain object/class with typed method signatures — no implicit `any`.
- All Groq/Sarvam/ElevenLabs/Twilio/LiveKit calls wrapped in try/catch with typed error results, never unhandled rejections in a WebSocket handler (a crash there takes down a live call).
- Background jobs (BullMQ) must be idempotent — a retried job should not double-create leads or double-send a call.

---

## BUILD ORDER (do this sequentially, not all at once)

1. Prisma schema + migration.
2. Auth + RBAC + org scoping (everything else depends on this).
3. `businessUnderstanding` service + route (needed before discovery/qualification can be meaningfully tested).
4. Lead upload (CSV) + `Lead` CRUD — unblocks "Calling Only" mode end-to-end without discovery being finished yet.
5. `voiceAgentService` core loop (STT→LLM→TTS→transcript) — the highest-risk, most novel piece; get one full call working before building anything downstream of it.
6. `campaignScheduler` wired to `voiceAgentService`.
7. `discoveryEngine` + `enrichmentEngine` + `qualificationEngine` (can be built in parallel by a second contributor once step 3 is done).
8. Analytics, notifications, audit/fraud, billing, CRM sync — back-office layer, build last.

---

## ACCEPTANCE CRITERIA FOR "DONE"

- A user can submit a business URL and get back a derived `BusinessProfile` they can edit.
- A user can upload a CSV of leads and launch a "Calling Only" campaign that places real outbound calls, in at least one of Hindi/Gujarati/English, and produces a stored transcript + summary + sentiment + next-best-action per call.
- The `/ws/voice-telemetry` socket streams live call state consumable by the existing `dashboard.simulation` frontend route without frontend changes.
- Every discovered lead (once discovery is built) shows a working source link — no exceptions.
- DNC numbers are provably never called (test by adding a number to `DncEntry` and confirming the scheduler skips it).

---

*If any instruction above conflicts with a decision the team makes as they build (e.g. choosing LiveKit Agents vs. raw Twilio bridge), update this document rather than letting the code and this spec drift apart.*
