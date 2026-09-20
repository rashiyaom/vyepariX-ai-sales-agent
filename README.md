# VYAPERI X — Autonomous AI Sales Intelligence & Multilingual Voice Fleet Platform

> An enterprise-grade, AI-powered sales automation and voice intelligence platform designed to autonomously discover high-intent prospects from public requirement posts, enrich lead data, validate business compliance, and execute automated multilingual voice campaigns.

---

## 📋 Table of Contents

- [Overview & Key Features](#-overview--key-features)
- [Monorepo Project Structure](#-monorepo-project-structure)
- [System Architecture & Data Flow](#-system-architecture--data-flow)
- [Technology Stack](#-technology-stack)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Frontend Setup](#1-frontend-setup)
  - [Backend Setup](#2-backend-setup)
- [Available Commands](#-available-commands)
- [Environment Configuration](#-environment-configuration)
- [API & WebSocket Telemetry Reference](#-api--websocket-telemetry-reference)
- [Documentation Links](#-documentation-links)

---

## 🚀 Overview & Key Features

**VYAPERI X** replaces manual prospecting and cold outreach with an end-to-end autonomous sales pipeline:

1. **AI Lead Discovery Radar**: Continuously scans public sources (LinkedIn, X, company boards, public directories, and freelance platforms) for high-intent prospect posts.
2. **Automated Lead Enrichment**: Enriches prospects with verified business emails, phone numbers, LinkedIn profiles, company size, funding rounds, and hiring signals.
3. **AI Business Profile & Product Validation**: Researches client company documentation and runs AI compliance checks to ensure products/services are suitable for automated AI selling.
4. **Multilingual Voice Fleet Engine**: Conducts human-like outbound/inbound calls, qualifies leads, answers product FAQs in multiple languages (English, Spanish, Hindi, German, French, etc.), retries unanswered calls, and logs complete transcripts with sentiment & next-best actions.
5. **Real-time Telemetry & A2A Firewall Audit**: Streams live call progress, sentiment spikes, and AI security policy audit logs via sub-100ms WebSockets.

---

## 📁 Monorepo Project Structure

```
design-haven/
├── frontend/                        # React 19 + TanStack + Vite UI Application
│   ├── src/
│   │   ├── components/              # UI components (Radix UI, Cyber Brutalism design system)
│   │   │   ├── app/                 # Domain components (Store, Audio Synthesizer, Chrome)
│   │   │   ├── site/                # Marketing & Landing page components
│   │   │   └── ui/                  # Reusable primitive UI widgets
│   │   ├── routes/                  # TanStack Router page routes
│   │   │   ├── index.tsx            # Main Landing / Marketing Page
│   │   │   ├── login.tsx            # Authentication Page
│   │   │   ├── dashboard.index.tsx  # Platform Overview Dashboard
│   │   │   ├── dashboard.registry.tsx   # Lead Discovery Radar & Registry
│   │   │   ├── dashboard.simulation.tsx # Voice Fleet Simulator & Telemetry
│   │   │   ├── dashboard.policies.tsx   # Security & Policy Controls
│   │   │   └── dashboard.inspector.tsx  # Real-time Call & Audit Inspector
│   │   ├── lib/                     # Client utilities & error reporting
│   │   ├── styles.css               # Tailwind CSS v4 design system tokens
│   │   └── routeTree.gen.ts         # Auto-generated route tree
│   ├── public/                      # Static branding & audio assets
│   ├── vite.config.ts               # Vite + TanStack Start configuration
│   ├── tsconfig.json                # Frontend TypeScript config
│   └── package.json                 # Frontend dependencies & scripts
│
├── backend/                         # Node.js + Express + TypeScript API Engine
│   ├── src/
│   │   ├── config/                  # DB, Redis, and environment configs
│   │   ├── controllers/             # Express API controllers
│   │   ├── middleware/              # Auth JWT, RBAC, Rate-limiting, Error boundary
│   │   ├── models/                  # DTOs and TypeScript interfaces
│   │   ├── routes/                  # REST API routes (/api/v1/...)
│   │   ├── services/                # Business logic (AI Radar, Scrapers, Voice Engine)
│   │   ├── websockets/              # WebSocket telemetry handlers (/ws/voice-telemetry)
│   │   └── index.ts                 # HTTP & WebSocket server entrypoint
│   ├── .env.example                 # Backend environment variable template
│   ├── tsconfig.json                # Node.js ES2022 TypeScript config
│   └── package.json                 # Backend dependencies & scripts
│
├── BACKEND_GUIDE.md                 # Exhaustive API Spec, Prisma Schema & Integration Guide
├── requirments.md                   # Full Product Requirements Document (PRD)
├── package.json                     # Root Monorepo convenience scripts
└── README.md                        # Master Project Documentation (This File)
```

---

## 🏗️ System Architecture & Data Flow

```
                      ┌──────────────────────────────────────────┐
                      │          Browser / Mobile App            │
                      └────────────────────┬─────────────────────┘
                                           │ HTTP REST / WS Telemetry
                                           ▼
    ┌──────────────────────────────────────────────────────────────────────────────┐
    │                         VYAPERI X API Core (Backend)                         │
    │  ┌────────────────────┐ ┌────────────────────┐ ┌──────────────────────────┐  │
    │  │ Lead Radar Engine  │ │ Product Safety AI  │ │ Voice Fleet Manager      │  │
    │  └────────────────────┘ └────────────────────┘ └──────────────────────────┘  │
    │  ┌────────────────────┐ ┌────────────────────┐ ┌──────────────────────────┐  │
    │  │ Market Intel Radar │ │ Telemetry WS Hub   │ │ Auth & CRM Integrations │  │
    │  └────────────────────┘ └────────────────────┘ └──────────────────────────┘  │
    └───────┬──────────────────────────┬───────────────────────────┬───────────────┘
            │                          │                           │
            ▼                          ▼                           ▼
  ┌──────────────────┐       ┌───────────────────┐       ┌────────────────────┐
  │ PostgreSQL Database│       │ Redis + BullMQ    │       │ AI & Telephony APIs│
  │ (Prisma ORM)     │       │ (Background Jobs) │       │ OpenAI / ElevenLabs│
  └──────────────────┘       └───────────────────┘       │ Twilio / LiveKit   │
                                                         └────────────────────┘
```

---

## 🛠️ Technology Stack

### Frontend Stack
* **Framework**: React 19 + TanStack Start / TanStack Router
* **Styling**: Tailwind CSS v4 + Cyber Brutalism Custom Tokens
* **UI Components**: Radix UI primitives, Lucide Icons, Recharts, Framer Motion
* **Build Tooling**: Vite 8, TypeScript 5.8

### Backend Stack
* **Runtime**: Node.js 20+ (ES2022 ESM)
* **API Framework**: Express 4.x
* **Real-time Engine**: `ws` (WebSockets) for sub-100ms telemetry streaming
* **Database & ORM**: PostgreSQL 16 + Prisma ORM
* **Queues & Cache**: Redis + BullMQ (Asynchronous lead discovery & batch call scheduler)
* **AI & Telephony Services**: OpenAI (GPT-4o), ElevenLabs (Voice Synthesis), Twilio SIP / LiveKit WebRTC

---

## ⚙️ Getting Started

### Prerequisites
Make sure you have installed:
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher (or `bun` v1.1+)
- **PostgreSQL**: v16+ (or cloud database URL)
- **Redis**: v7+ (for background queues)

---

### 1. Frontend Setup

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies (if not already installed)
npm install

# Start the Vite development server
npm run dev
```
> The frontend UI will start at **`http://localhost:8080`**.

---

### 2. Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Install dependencies
npm install

# Setup environment configuration
cp .env.example .env

# Start the Node.js API & WebSocket server in watch mode
npm run dev
```
> The backend server will run at **`http://localhost:5000`** and WebSocket stream at **`ws://localhost:5000/ws/voice-telemetry`**.

---

## ⚡ Available Commands

### Root Monorepo Commands (from project root)

| Command | Action |
| :--- | :--- |
| `npm run dev:frontend` | Starts the React frontend development server (`http://localhost:8080`) |
| `npm run dev:backend` | Starts the Express backend development server (`http://localhost:5000`) |
| `npm run build:frontend` | Compiles the production frontend bundle into `frontend/dist` |
| `npm run build:backend` | Compiles backend TypeScript code into `backend/dist` |

### Frontend Workspace Commands (`cd frontend`)

| Command | Action |
| :--- | :--- |
| `npm run dev` | Runs Vite dev server with hot module replacement |
| `npm run build` | Builds production client and SSR bundles |
| `npm run lint` | Runs ESLint across frontend source files |

### Backend Workspace Commands (`cd backend`)

| Command | Action |
| :--- | :--- |
| `npm run dev` | Runs backend in hot-reload mode via `tsx watch` |
| `npm run build` | Compiles TypeScript code using `tsc` |
| `npm run start` | Runs the compiled JavaScript backend server (`node dist/index.js`) |

---

## 🔐 Environment Configuration

### Backend `.env` Variables

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

# AI & LLM Providers
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx

# Voice Synthesis & Telephony Gateway
ELEVENLABS_API_KEY=el_xxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+18005550199
LIVEKIT_URL=wss://livekit.vyaperix.internal
LIVEKIT_API_KEY=APIxxxxxxxx
LIVEKIT_API_SECRET=secretxxxxxxx
```

---

## 📡 API & WebSocket Telemetry Reference

### Key REST API Endpoints (`/api/v1`)

* **Authentication**: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`
* **Business Validation**: `POST /api/v1/business-profile/enrich`, `POST /api/v1/business-profile/validate-products`
* **Lead Discovery**: `POST /api/v1/leads/discover`, `GET /api/v1/leads`, `POST /api/v1/leads/export`
* **Market Intelligence**: `GET /api/v1/intelligence/insights`
* **Voice Fleet**: `POST /api/v1/voice-agents`, `POST /api/v1/campaigns`, `GET /api/v1/calls/:id/transcript`

### Real-Time WebSocket Telemetry (`/ws/voice-telemetry`)

Connect via WebSocket client (`ws://localhost:5000/ws/voice-telemetry`) to stream live call states, audio frame events, and security policy violations.

---

## 📖 Documentation Links

- 📄 **[BACKEND_GUIDE.md](file:///Users/omvipulbhairashiya/Desktop/design-haven/BACKEND_GUIDE.md)** — Exhaustive Backend API reference, data DTOs, and Prisma database schema.
- 📋 **[requirments.md](file:///Users/omvipulbhairashiya/Desktop/design-haven/requirments.md)** — Full Product Requirements Document (PRD) detailing user journeys and compliance rules.
