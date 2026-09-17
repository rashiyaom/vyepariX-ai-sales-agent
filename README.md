# VYAPERI X

> AI-Powered Sales & Commercial Intelligence Platform & Multilingual Voice Fleet

## Modular Monorepo Architecture

```
vyepariX-Voice-agent/
├── frontend/                  ← Frontend (TanStack Start / Vite / React 19 / Tailwind v4)
│   ├── src/                   ← React app routes & components
│   │   ├── routes/
│   │   │   ├── index.tsx          ← Landing page
│   │   │   ├── onboarding.tsx     ← Onboarding wizard
│   │   │   ├── dashboard.tsx      ← SaaS dashboard
│   │   │   └── login.tsx          ← Auth page
│   │   └── components/
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.example
├── backend/                   ← Python FastAPI (Voice Engine & Intelligence Suite API)
│   ├── app/                   ← Python package root
│   │   ├── main.py            ← FastAPI entrypoint  (run as app.main:app)
│   │   ├── core/
│   │   │   ├── database.py        ← Supabase adapter
│   │   │   └── auth_middleware.py ← JWT auth
│   │   ├── services/
│   │   │   ├── doc_processor.py   ← Document parser
│   │   │   ├── normalizer.py      ← Profile normaliser
│   │   │   ├── scraper.py         ← Web scraper
│   │   │   ├── data_engine.py     ← Numerical extraction
│   │   │   ├── rag_engine.py      ← RAG / ChromaDB
│   │   │   ├── groq_client.py     ← Groq LLM
│   │   │   ├── voice_engine.py    ← Voice agent pipeline
│   │   │   └── sarvam_service.py  ← Sarvam TTS
│   │   └── routers/
│   │       └── voice_router.py    ← Voice Fleet endpoints
│   ├── data/                  ← Runtime data (Chroma vector store) — gitignored
│   ├── docs/                  ← API.md, BUILD_SPEC.md, SCRAPER_README.md
│   ├── requirements.txt
│   └── .env.example
├── supabase/                  ← Database Schemas & Migrations (CLI requires this exact name/location)
│   ├── schema.sql             ← Consolidated database schema
│   ├── config.toml
│   └── migrations/
├── .gitignore                 ← Root gitignore (blocks .env, dist, node_modules, __pycache__)
├── package.json               ← Root npm script runners
└── README.md
```

## Running Locally

### 1. Frontend Web App (TanStack Start / Vite)
```bash
# From repository root:
npm run dev:web

# Or directly in apps/web:
cd apps/web
npm install
npm run dev
```

### 2. Voice & Intelligence Backend (Python FastAPI)
```bash
# From repository root:
npm run dev:backend

# Or directly in services/backend:
cd services/backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Environment Setup

Copy the example environment files and populate your API credentials:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

## Deployment Guide

- **Frontend (`apps/web`)**: Set Root Directory to `apps/web` on Vercel / Netlify.
- **Backend (`services/backend`)**: Deploy as a Python Web Service on Render / Railway / AWS App Runner.
- **Database (`supabase`)**: Link with Supabase CLI or execute `supabase/schema.sql` in your Supabase SQL editor.
