# VYAPERI X — AI Sales Intelligence & Voice Agent Platform
## Backend Technical Specification & Architecture Guide

---

## 1. System Overview & Architecture

**VYAPERI X** is an enterprise-grade AI Sales Intelligence and Autonomous Voice Agent Platform. The backend is designed as an **API-first, event-driven Node.js & TypeScript micro-service architecture** that automates the entire sales lifecycle:

1. **Lead Discovery Radar**: Continuously scans public channels (LinkedIn, X, company boards, public directories, freelance portals) for high-intent prospect posts.
2. **AI Business & Product Validation**: Automatically researches client business documentation and runs compliance/suitability checks for automated AI voice selling.
3. **Lead Enrichment & Market Intelligence**: Gathers verified emails, phone numbers, funding signals, hiring data, and tech stack telemetry.
4. **Multilingual AI Voice Fleet Engine**: Executes autonomous outbound/inbound phone calls via WebRTC/SIP trunks, handles FAQs, qualifies prospects, leaves voicemails, retries unanswered calls, and logs transcripts with next-best action recommendations.
5. **Real-time Telemetry & A2A Firewall Audit**: Uses WebSockets to stream live call states, delegation audit logs, and prompt-injection firewall alerts.

```
                  ┌─────────────────────────────────────────┐
                  │        Frontend Web / Mobile App        │
                  └────────────────────┬────────────────────┘
                                       │ HTTP / REST / WebSockets
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VYAPERI X Node.js API                             │
│  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────────────┐  │
│  │ Auth & Org Module │ │ Lead Radar Engine │ │ Business Validation AI    │  │
│  └───────────────────┘ └───────────────────┘ └───────────────────────────┘  │
│  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────────────┐  │
│  │ Voice Fleet Engine│ │ Market Intel      │ │ Realtime WS Telemetry     │  │
│  └───────────────────┘ └───────────────────┘ └───────────────────────────┘  │
└──────┬───────────────────────┬──────────────────────────────┬───────────────┘
       │                       │                              │
       ▼                       ▼                              ▼
┌──────────────┐      ┌─────────────────┐           ┌──────────────────┐
│ PostgreSQL   │      │ Redis + BullMQ  │           │ AI & Voice APIs  │
│ (Prisma ORM) │      │ (Job Queues)    │           │ OpenAI/ElevenLabs│
└──────────────┘      └─────────────────┘           │ Twilio/LiveKit   │
                                                    └──────────────────┘
```

---

## 2. Directory Structure

```
design-haven/
├── frontend/                     # Modern React / TanStack / Vite UI Application
│   ├── src/
│   ├── public/
│   ├── vite.config.ts
│   └── package.json
├── backend/                      # Node.js + Express + TypeScript API Server
│   ├── src/
│   │   ├── config/               # Database, Redis, and Environment setup
│   │   ├── controllers/          # Route handlers
│   │   ├── middleware/           # Auth, RBAC, Rate-limiting, Error boundaries
│   │   ├── models/               # Data transfer objects & TS interfaces
│   │   ├── routes/               # API endpoints (/api/v1/...)
│   │   ├── services/             # Core business logic (AI, Telephony, Scrapers)
│   │   ├── websockets/           # Live voice telemetry & audit handlers
│   │   └── index.ts              # HTTP & WS server initialization
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── BACKEND_GUIDE.md              # Exhaustive Backend Specification (This Document)
├── requirments.md                # Product Requirements Document
├── package.json                  # Root Monorepo Helper Package
└── README.md                     # Root Project Setup Guide
```

---

## 3. Technology Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Runtime & Language** | Node.js (v20+) + TypeScript 5.7 | High-performance async I/O with type safety |
| **HTTP Framework** | Express 4.x / Fastify | Robust routing, middleware ecosystem, and fast execution |
| **Real-time Protocol** | `ws` (WebSockets) | Sub-100ms streaming telemetry for live voice interactions |
| **Database & ORM** | PostgreSQL 16 + Prisma ORM | ACID compliance, complex relational queries, migration management |
| **Caching & Queues** | Redis + BullMQ | Asynchronous lead discovery, batch call dispatch, rate-limit control |
| **AI LLM Services** | OpenAI GPT-4o / Anthropic Claude 3.5 | Requirements extraction, lead scoring, conversation handling |
| **Voice Synthesis** | ElevenLabs API / Cartesia | Ultra-low latency multilingual voice generation |
| **Telephony Gateway** | Twilio SIP Trunking / LiveKit WebRTC | Inbound/outbound call routing, WebRTC audio streaming |

---

## 4. Complete API Endpoint Specification

All REST endpoints are prefixed with `/api/v1`. JSON is used for request/response payloads.

### 4.1 Authentication & User Management

#### `POST /api/v1/auth/register`
Registers a new client business account and starts a 14-day free trial.

* **Request Body**:
```json
{
  "email": "sarah@acmecorp.io",
  "password": "SecurePassword123!",
  "fullName": "Sarah Jenkins",
  "companyName": "Acme Solutions",
  "companyWebsite": "https://acmesolutions.io"
}
```
* **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "usr_99210",
      "email": "sarah@acmecorp.io",
      "role": "CLIENT_ADMIN",
      "organizationId": "org_48102"
    },
    "trial": {
      "active": true,
      "expiresAt": "2026-09-16T10:00:00.000Z",
      "includedVoiceMinutes": 100
    }
  }
}
```

#### `POST /api/v1/auth/login`
Authenticates existing users and returns JWT token.

#### `GET /api/v1/auth/me`
Retrieves currently logged-in user profile, permissions, and organization status.

---

### 4.2 Business Profile & Product AI Validation

#### `POST /api/v1/business-profile/enrich`
Submits company website and business documents to AI to automatically extract products, services, target audience, and selling points.

* **Request Body**:
```json
{
  "websiteUrl": "https://acmesolutions.io",
  "documentUrls": [
    "https://storage.vyaperix.io/docs/acme-brochure.pdf"
  ],
  "industry": "Enterprise SaaS"
}
```
* **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "organizationId": "org_48102",
    "extractedProducts": [
      {
        "name": "Cloud CRM Automation",
        "description": "AI-powered sales pipeline management tool",
        "targetAudience": "B2B Sales Teams",
        "usp": "Automates 80% of manual data entry"
      }
    ],
    "suggestedKeywords": ["CRM", "Sales Automation", "Pipeline Intelligence"]
  }
}
```

#### `POST /api/v1/business-profile/validate-products`
Runs AI safety and compliance checks on submitted products/services to ensure suitability for autonomous voice outreach.

* **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "status": "APPROVED", // "APPROVED" | "REJECTED" | "PENDING_ADMIN_APPROVAL"
    "confidenceScore": 0.96,
    "checks": {
      "prohibitedContent": false,
      "regulatoryCompliance": true,
      "aiVoiceSuitability": true
    },
    "reasoning": "Product adheres to standard B2B software sales guidelines."
  }
}
```

---

### 4.3 AI Lead Discovery & Radar

#### `POST /api/v1/leads/discover`
Triggers an automated discovery job to scan public requirement posts across LinkedIn, X, company websites, public directories, and freelance platforms.

* **Request Body**:
```json
{
  "keywords": ["looking for CRM", "need sales automation agency"],
  "targetIndustries": ["Healthcare", "Software", "Fintech"],
  "locations": ["United States", "India", "United Kingdom"],
  "sourcePlatforms": ["LINKEDIN", "X_TWITTER", "PUBLIC_DIRECTORY", "FREELANCE"]
}
```
* **Response (202 Accepted)**:
```json
{
  "success": true,
  "data": {
    "jobId": "job_disc_88492",
    "estimatedCompletionTime": "45 seconds",
    "status": "PROCESSING"
  }
}
```

#### `GET /api/v1/leads`
Fetches discovered leads with filtering, pagination, and enrichment status.

* **Query Parameters**: `page=1&limit=20&source=LINKEDIN&minIntentScore=80&search=CRM`
* **Response (200 OK)**:
```json
{
  "success": true,
  "meta": {
    "total": 142,
    "page": 1,
    "limit": 20
  },
  "data": [
    {
      "id": "lead_10482",
      "prospectName": "David Miller",
      "jobTitle": "VP of Revenue Operations",
      "companyName": "Apex Technologies",
      "companySize": "50-200",
      "verifiedEmail": "d.miller@apextech.com",
      "phone": "+14155552671",
      "linkedinUrl": "https://linkedin.com/in/david-miller-apex",
      "originalPostUrl": "https://linkedin.com/posts/david-miller-requirement-9921",
      "sourcePlatform": "LINKEDIN",
      "intentScore": 94,
      "requirementSnippet": "We are actively looking for an AI voice agent platform to handle outbound sales qualification...",
      "discoveryDate": "2026-09-02T08:15:00.000Z",
      "enrichmentStatus": "COMPLETED"
    }
  ]
}
```

#### `POST /api/v1/leads/export`
Exports selected leads to CSV or Excel.

---

### 4.4 Market Intelligence & Signal Radar

#### `GET /api/v1/intelligence/insights`
Provides aggregated market trends, funding announcements, hiring velocity, and competitor adoption signals.

* **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "recentFundingEvents": [
      {
        "company": "Apex Technologies",
        "amount": "$12.5M",
        "round": "Series A",
        "date": "2026-08-28"
      }
    ],
    "hiringVelocity": [
      { "department": "Sales", "openRoles": 14, "growthPercentage": "+35%" }
    ],
    "competitorTechStack": ["Salesforce", "Outreach.io", "Gong"]
  }
}
```

---

### 4.5 AI Voice Fleet & Campaign Engine

#### `POST /api/v1/voice-agents`
Configures a specialized AI voice agent persona for outbound or inbound campaigns.

* **Request Body**:
```json
{
  "agentName": "Aria — Enterprise Qualifier",
  "language": "en-US", // Multilingual support: "en-US", "es-ES", "hi-IN", "de-DE", "fr-FR"
  "voiceModel": "eleven_multilingual_v2",
  "voiceId": "21m00Tcm4TlvDq8ikWAM",
  "scriptInstructions": "Qualify prospects for SaaS CRM automation. Ask about team size and budget.",
  "fallbackBehavior": "SCHEDULE_CALLBACK"
}
```

#### `POST /api/v1/campaigns`
Creates a batch outbound calling campaign.

* **Request Body**:
```json
{
  "campaignName": "Q3 US Tech Prospecting",
  "voiceAgentId": "agent_v9901",
  "leadIds": ["lead_10482", "lead_10483", "lead_10484"],
  "schedule": {
    "timezone": "America/New_York",
    "startTime": "2026-09-03T09:00:00.000Z",
    "allowedCallingHours": { "start": "09:00", "end": "17:00" }
  },
  "maxRetryAttempts": 3
}
```

#### `GET /api/v1/calls/:id/transcript`
Returns complete transcript, emotion analysis, and AI recommended next steps for a call.

* **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "callId": "call_77102",
    "prospectName": "David Miller",
    "durationSeconds": 142,
    "status": "QUALIFIED",
    "summary": "Prospect expressed high interest in CRM automation. Requested a live demo on Thursday.",
    "nextBestAction": "Send calendar link via email and notify account executive.",
    "transcript": [
      { "speaker": "AI_AGENT", "text": "Hello David, this is Aria from Acme. I noticed your post regarding sales automation...", "timestamp": "00:02" },
      { "speaker": "PROSPECT", "text": "Hi Aria, yes! We are currently struggling with manual lead qualification...", "timestamp": "00:09" }
    ]
  }
}
```

---

### 4.6 Real-Time Telemetry WebSockets

* **Endpoint**: `ws://localhost:5000/ws/voice-telemetry`
* **Event Payload**:
```json
{
  "event": "CALL_STATE_UPDATE",
  "callId": "call_77102",
  "agentId": "agent_v9901",
  "state": "IN_PROGRESS", // "INITIATED" | "CONNECTED" | "IN_PROGRESS" | "COMPLETED" | "FAILED"
  "sentiment": "POSITIVE",
  "currentTopic": "Pricing & Integration",
  "timestamp": "2026-09-02T10:34:00.000Z"
}
```

---

## 5. Database Schema (Prisma Format)

Create `backend/prisma/schema.prisma` with the following entities:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  SUPER_ADMIN
  CLIENT_ADMIN
  SALES_REP
}

enum ValidationStatus {
  PENDING
  APPROVED
  REJECTED
}

enum SourcePlatform {
  LINKEDIN
  X_TWITTER
  PUBLIC_DIRECTORY
  FREELANCE
  CRM_IMPORT
}

enum CallStatus {
  SCHEDULED
  DIALING
  CONNECTED
  QUALIFIED
  NOT_INTERESTED
  VOICEMAIL
  FAILED
}

model Organization {
  id              String             @id @default(cuid())
  name            String
  website         String?
  industry        String?
  createdAt       DateTime           @default(now())
  users           User[]
  products        ProductService[]
  leads           Lead[]
  campaigns       Campaign[]
  subscriptions   Subscription[]
}

model User {
  id              String        @id @default(cuid())
  organizationId  String
  organization    Organization  @relation(fields: [organizationId], references: [id])
  email           String        @unique
  passwordHash    String
  fullName        String
  role            Role          @default(CLIENT_ADMIN)
  createdAt       DateTime      @default(now())
}

model ProductService {
  id              String           @id @default(cuid())
  organizationId  String
  organization    Organization     @relation(fields: [organizationId], references: [id])
  name            String
  description     String
  usp             String?
  validation      ValidationStatus @default(PENDING)
  createdAt       DateTime         @default(now())
}

model Lead {
  id                  String         @id @default(cuid())
  organizationId      String
  organization        Organization   @relation(fields: [organizationId], references: [id])
  prospectName        String
  jobTitle            String?
  companyName         String
  companySize         String?
  verifiedEmail       String?
  phone               String?
  linkedinUrl         String?
  originalPostUrl     String
  sourcePlatform      SourcePlatform
  intentScore         Int            @default(0)
  requirementSnippet  String
  createdAt           DateTime       @default(now())
  calls               CallLog[]
}

model Campaign {
  id              String        @id @default(cuid())
  organizationId  String
  organization    Organization  @relation(fields: [organizationId], references: [id])
  name            String
  voiceAgentId    String
  voiceAgent      VoiceAgent    @relation(fields: [voiceAgentId], references: [id])
  status          String        @default("DRAFT")
  createdAt       DateTime      @default(now())
  calls           CallLog[]
}

model VoiceAgent {
  id                  String     @id @default(cuid())
  name                String
  language            String     @default("en-US")
  voiceId             String
  scriptInstructions  String
  campaigns           Campaign[]
}

model CallLog {
  id              String      @id @default(cuid())
  campaignId      String
  campaign        Campaign    @relation(fields: [campaignId], references: [id])
  leadId          String
  lead            Lead        @relation(fields: [leadId], references: [id])
  status          CallStatus  @default(SCHEDULED)
  durationSeconds Int         @default(0)
  summary         String?
  nextBestAction  String?
  createdAt       DateTime    @default(now())
  transcripts     TranscriptEntry[]
}

model TranscriptEntry {
  id        String   @id @default(cuid())
  callId    String
  call      CallLog  @relation(fields: [callId], references: [id])
  speaker   String
  text      String
  timestamp String
}

model Subscription {
  id                  String       @id @default(cuid())
  organizationId      String
  organization        Organization @relation(fields: [organizationId], references: [id])
  plan                String       @default("STARTER")
  voiceMinutesQuota   Int          @default(100)
  voiceMinutesUsed    Int          @default(0)
  active              Boolean      @default(true)
}
```

---

## 6. How to Run Frontend & Backend Independently

### 6.1 Running the Frontend
```bash
cd frontend
npm run dev
# Opens Vite Dev Server at http://localhost:8080
```

### 6.2 Running the Backend
```bash
cd backend
npm run dev
# Starts Express API & WebSocket Server at http://localhost:5000
```

### 6.3 Root Monorepo Commands
From the project root directory:
* Run Frontend Dev: `npm run dev:frontend`
* Run Backend Dev: `npm run dev:backend`
* Build Frontend: `npm run build:frontend`
* Build Backend: `npm run build:backend`

---

## 7. Next Steps & Implementation Roadmap

1. **Database Initialization**: Setup PostgreSQL connection string in `backend/.env` and run `npx prisma db push`.
2. **Controller Wiring**: Connect Express controller modules to Prisma services for Lead Discovery and Voice Agent management.
3. **Queue Activation**: Configure BullMQ workers for continuous public requirement scraping and batch outbound calling.
