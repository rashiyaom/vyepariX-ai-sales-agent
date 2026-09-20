# VYAPERI X — Onboarding & Business Understanding Flow: Build Prompt

> Copy everything below into your AI coding agent. This specifies the exact flow from **post-sign-in → user provides business info → website scraping → LinkedIn/social scraping → AI business profile derivation → user confirmation → handoff into the lead pipeline.** It assumes the backend stack, schema, and services already defined in the master backend build prompt (Groq for LLM, Prisma/Postgres, BullMQ for background jobs) — this document goes one level deeper on the onboarding module specifically.

---

## SCOPE

This flow runs exactly once per organization at onboarding (with a "re-run" option available later from settings). It produces a confirmed `BusinessProfile` record, which every downstream module (Discovery, Qualification, Voice Agent scripts/FAQs) depends on. Treat this as the single most important data-quality gate in the whole product — a bad Business Profile silently degrades everything built on top of it.

---

## STEP-BY-STEP FLOW

### Step 0 — Trigger
User completes sign-up/sign-in and has no `BusinessProfile` yet for their organization. Frontend routes them into an onboarding wizard (new route, does not yet exist — build `onboarding.tsx` or similar alongside the existing `dashboard.*` routes) instead of straight to the dashboard.

### Step 1 — Input collection
UI collects any combination of:
- Company website URL (primary input)
- Free-text business description (optional, supplements or substitutes the URL)
- Uploaded documents (brochures, service pages, decks — PDF/DOCX/TXT)
- Optional: LinkedIn company page URL, if the user wants to provide it directly rather than have it auto-discovered

At least one of URL / description / document is required to proceed. Submit triggers `POST /api/v1/business-profile/enrich` with these inputs. This endpoint should return immediately with a `jobId` and run the actual work asynchronously (this flow involves multiple slow network calls — scraping, LinkedIn, LLM — so do not block the request).

### Step 2 — Website scraping job (`websiteScraperService.ts`)
BullMQ worker, triggered by `jobId` above.

- Fetch the homepage first. Attempt static HTML fetch + parse (cheerio) as the default path — cheaper and faster.
- If the page is clearly JS-rendered (minimal content in static HTML, common with SPA marketing sites), fall back to a headless browser (Playwright) to get the rendered DOM.
- From the homepage, identify and queue a small set of likely-useful internal links to also fetch: About, Services/Products, Solutions, Case Studies/Portfolio, Contact. Use simple heuristics on link text/href (`/about`, `/services`, `/products`, `/solutions`, `/portfolio`, `/contact`, `/case-studies`) — cap total pages fetched (e.g. 6) to keep this fast and bounded.
- Extract from each page: visible text content (strip nav/footer boilerplate where feasible), page title, meta description.
- Extract from the homepage/footer specifically: any outbound social links (LinkedIn, X/Twitter, Facebook, Instagram, Crunchbase, G2) — these seed Step 3.
- Respect `robots.txt` on the target domain before fetching. If disallowed, skip scraping that page and note it in the job result rather than failing the whole job.
- Store raw scraped output (per page: URL, extracted text, fetched-at) — keep this raw data around even after the LLM step, so a user disputing the derived profile can be shown what was actually read.

**Failure handling**: if the URL is unreachable, times out, or returns non-HTML content, don't fail the whole flow — log it, continue with whatever other inputs (description/documents/LinkedIn) exist, and flag to the user later that the site couldn't be read so they know to rely more on the manual description.

### Step 3 — LinkedIn (and other social) profile scraping (`socialProfileService.ts`)
Triggered after Step 2 identifies a LinkedIn company URL (or if the user supplied one directly in Step 1).

- **Compliance first**: LinkedIn's terms restrict scraping; prefer LinkedIn's official Marketing/Partner APIs where your org has access. If no official API access is configured, do not silently scrape — flag this in the job result as `linkedin_data: unavailable (no compliant access configured)` and let the rest of the flow proceed without it. This is a legal exposure point, not just an engineering inconvenience — do not treat "just scrape it anyway" as an acceptable default implementation.
- Where official/compliant access exists, pull: company description, industry, company size range, headquarters location, follower count, recent company posts (useful signal for tone/positioning).
- For other social sources found in Step 2 (X/Twitter bio, Crunchbase, G2 reviews page), apply the same principle: use official APIs where available (e.g. X API), and skip with a clear "unavailable" flag rather than scraping through unsupported means when no compliant path exists.

### Step 4 — Document ingestion (if uploaded)
- Extract text from uploaded PDFs/DOCX (reuse whatever document-parsing utility exists elsewhere in the backend, or add a lightweight one — this doesn't need OCR-grade sophistication for typical brochure/deck text).
- Add extracted text to the same aggregation pool as Steps 2-3.

### Step 5 — Aggregation
- Combine: scraped website text, LinkedIn/social data (if available), uploaded document text, and the user's free-text description into a single structured input object:

```typescript
interface RawBusinessInput {
  websitePages: { url: string; text: string }[];
  socialData: { platform: string; data: Record<string, unknown> }[] | null;
  documentText: string[];
  userDescription: string | null;
}
```

- Truncate/chunk sensibly if the combined text is very large — prioritize homepage + About + Services pages + user description over deeper pages if a token budget cut is needed.

### Step 6 — Business Profile derivation (Groq LLM call)
- Call Groq (`llama-3.3-70b-versatile`, per the model policy in the master prompt) with a system prompt instructing it to extract, from the aggregated input:
  - `companySummary` — 2-3 sentence plain description of what the business does.
  - `coreServices` — structured list of specific services/products (not vague categories — e.g. "Microsoft 365 migration," "SharePoint intranet implementation," not just "IT services").
  - `industries` — industries this business appears to serve or specialize in.
  - `icp` — structured ideal customer profile: target company size range, target industries, target geography, and a list of buying-signal phrases/keywords that would indicate a prospect needs this business's services (this keyword list directly feeds the Discovery Engine's search queries — make it specific and varied, not generic).
  - `differentiators` — anything that stood out as a claimed USP (used later for pitch personalization).
- Require the LLM to return structured JSON matching a fixed schema (use Groq's JSON mode / a strict system-prompt instruction to output JSON only, and validate the response against a schema before proceeding — retry once with an error-correction prompt if validation fails).

### Step 7 — Human review & confirmation (critical — do not skip)
- Persist the derived output as a **draft** `BusinessProfile` (add a `status: DRAFT | CONFIRMED` field if not already present in the schema).
- Return the draft to the frontend for review. UI should show: the derived summary, services list, ICP, and keyword list, each editable — plus, for transparency, a collapsible view of which source pages/data actually fed each section (tie back to the raw scraped data stored in Step 2).
- User can edit any field directly, or provide corrective free text and re-run Step 6 with that correction appended to the input.
- On explicit confirm, flip `status` to `CONFIRMED` and lock this as the record every downstream module reads. Confirmation is a deliberate UI action, not an automatic timeout/default.

### Step 8 — Handoff into mode selection
- Once `BusinessProfile.status = CONFIRMED`, route the user to the mode selection screen:
  - **Calling Only** → route to lead upload (CSV/Excel/CRM import), skip straight to campaign creation once leads exist.
  - **Leads + Calling** → trigger the Discovery Engine (`discoveryEngine.ts` from the master backend prompt) using `BusinessProfile.icp.keywords` as the seed query set, then Enrichment, then Qualification, before campaign creation.
- This handoff is the boundary between this onboarding module and the lead-pipeline module — do not duplicate discovery/enrichment logic here; call the existing services.

---

## ASYNC STATUS UPDATES

Because Steps 2-6 involve multiple slow network calls, the frontend needs live progress rather than a blank loading spinner for an indeterminate time:

- Reuse the existing `/ws/voice-telemetry` WebSocket pattern, or add a sibling `/ws/onboarding-status` channel, emitting events like:
  - `scraping_started`, `scraping_page_fetched` (per page, so the UI can show "Reading yourcompany.com/services..."), `scraping_complete`
  - `linkedin_lookup_started`, `linkedin_lookup_complete` (or `linkedin_unavailable`)
  - `profile_derivation_started`, `profile_draft_ready`
- This turns a multi-step backend job into a visible, trust-building progress sequence in the UI rather than a mystery wait.

---

## ENDPOINTS FOR THIS FLOW

```
POST   /api/v1/business-profile/enrich        # Step 1 trigger — returns { jobId }
GET    /api/v1/business-profile/status/:jobId # poll fallback if WS isn't used
GET    /api/v1/business-profile/draft         # fetch current draft for review
PATCH  /api/v1/business-profile/draft         # user edits before confirming
POST   /api/v1/business-profile/confirm       # locks status = CONFIRMED, triggers Step 8 handoff
POST   /api/v1/business-profile/rerun         # re-run derivation with corrective input, from settings later
```

---

## DATA MODEL ADDITIONS

Extend the `BusinessProfile` model from the master backend prompt:

```prisma
model BusinessProfile {
  id              String   @id @default(uuid())
  organizationId  String   @unique
  organization    Organization @relation(fields: [organizationId], references: [id])
  status          BusinessProfileStatus @default(DRAFT)
  sourceUrl       String?
  linkedinUrl     String?
  userDescription String?
  rawScrapedData  Json      // per-page text, kept for transparency/audit
  companySummary  String?
  coreServices    Json?
  industries      String[]
  icp             Json?
  keywords        String[]
  differentiators String[]
  confirmedAt     DateTime?
  updatedAt       DateTime @updatedAt
}

enum BusinessProfileStatus { DRAFT CONFIRMED }
```

---

## FAILURE / EDGE CASES TO HANDLE EXPLICITLY

- No website provided, description only → skip Steps 2-3 entirely, derive profile from description + documents only.
- Website scraping fully fails (site down, blocks bots, robots.txt disallows everything) → proceed with whatever else is available; surface a clear "we couldn't read your website" notice rather than silently producing a thin/wrong profile.
- No LinkedIn URL found and none provided → proceed without it; don't block the flow waiting on it.
- LLM returns malformed JSON on Step 6 → one automatic retry with an error-correction prompt; if it fails twice, surface an error to the user rather than saving garbage into `BusinessProfile`.
- User abandons the wizard mid-flow → draft should be resumable, not lost; re-entering onboarding should reload the last draft rather than restarting from scratch.

---

## BUILD ORDER FOR THIS MODULE

1. `BusinessProfile` schema extension + migration.
2. `POST /business-profile/enrich` endpoint + job queue wiring (return `jobId` immediately, no logic yet).
3. `websiteScraperService.ts` (Step 2) — get this working and tested standalone before adding LinkedIn.
4. `socialProfileService.ts` (Step 3) — including the explicit compliance-gated "unavailable" fallback path.
5. Document ingestion (Step 4) if not already available elsewhere in the codebase.
6. Aggregation + Groq derivation call (Steps 5-6) with strict JSON schema validation.
7. Draft review/edit/confirm endpoints (Step 7).
8. WebSocket/polling status updates.
9. Wire Step 8 handoff into the existing `discoveryEngine` / lead-upload flows from the master backend prompt.

---

*This module is the front door to the entire platform's data quality — prioritize getting the human review step (Step 7) right over trying to make the AI derivation perfect on the first pass. A confirmable, editable draft beats a fully-automated but occasionally wrong profile.*
