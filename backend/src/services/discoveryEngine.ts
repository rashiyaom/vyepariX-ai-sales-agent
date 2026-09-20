import { prisma } from "../config/database.js";
import { redis } from "../config/redis.js";
import { Queue, Worker } from "bullmq";
import { encrypt } from "../config/encryption.js";

// ⚠️  NOTICE: LinkedIn and X/Twitter connectors below use unofficial/scraping paths.
// These are flagged as NON-PRODUCTION-READY per spec rule: do not silently ship
// scraping paths as production-ready. Official API credentials must be provided
// before enabling those connectors.

const DISCOVERY_QUEUE = "lead-discovery";

export const discoveryQueue = new Queue(DISCOVERY_QUEUE, {
  connection: redis,
  defaultJobOptions: { removeOnComplete: 100, removeOnFail: 100, attempts: 2 },
});

interface DiscoveredLead {
  sourcePlatform: string;
  originalPostUrl: string;  // MANDATORY per spec
  postText: string;
  matchedKeywords: string[];
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
}

export const discoveryEngine = {
  /** Enqueue a discovery run for an org */
  async scheduleDiscovery(organizationId: string): Promise<void> {
    await discoveryQueue.add(
      "discover",
      { organizationId },
      { jobId: `discovery-${organizationId}-${Date.now()}` }
    );
  },
};

export function startDiscoveryWorker(): void {
  const worker = new Worker(
    DISCOVERY_QUEUE,
    async (job) => {
      const { organizationId } = job.data as { organizationId: string };
      await runDiscovery(organizationId);
    },
    { connection: redis, concurrency: 3 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[DiscoveryWorker] Job ${job?.id} failed:`, err);
  });
}

async function runDiscovery(organizationId: string): Promise<void> {
  const profile = await prisma.businessProfile.findUnique({ where: { organizationId } });
  if (!profile) {
    console.warn(`[Discovery] No BusinessProfile for org ${organizationId}`);
    return;
  }

  const keywords = profile.keywords as string[];
  console.log(`[Discovery] Starting sweep for org ${organizationId} with ${keywords.length} keywords`);

  const allLeads: DiscoveredLead[] = [];

  // ── Connector 1: Public Web / Google Search fallback (production-ready) ──
  const webLeads = await discoverViaWebSearch(keywords);
  allLeads.push(...webLeads);

  // ── Connector 2: LinkedIn (⚠️ requires official API — FLAGGED as non-prod-ready) ──
  if (process.env.LINKEDIN_API_CREDENTIALS && process.env.LINKEDIN_API_CREDENTIALS !== "xxxxxxxxxxxxxxxxxxxxxxxx") {
    console.warn("[Discovery] LinkedIn connector requires official API review before use in production");
    // const linkedinLeads = await discoverViaLinkedIn(keywords);
    // allLeads.push(...linkedinLeads);
  }

  // ── Connector 3: X/Twitter (⚠️ requires official API v2 — FLAGGED as non-prod-ready) ──
  if (process.env.X_API_BEARER_TOKEN && process.env.X_API_BEARER_TOKEN !== "xxxxxxxxxxxxxxxxxxxxxxxx") {
    const xLeads = await discoverViaX(keywords, process.env.X_API_BEARER_TOKEN);
    allLeads.push(...xLeads);
  }

  // Persist leads — idempotent via originalPostUrl dedup
  let created = 0;
  for (const lead of allLeads) {
    if (!lead.originalPostUrl) continue; // spec: NEVER persist without source link

    // Deduplicate by source URL
    const existing = await prisma.opportunity.findFirst({
      where: { originalPostUrl: lead.originalPostUrl },
    });
    if (existing) continue;

    await prisma.lead.create({
      data: {
        organizationId,
        source: "DISCOVERED",
        status: "NEW",
        companyName: lead.companyName,
        contactName: lead.contactName,
        phoneEncrypted: lead.phone ? encrypt(lead.phone) : null,
        emailEncrypted: lead.email ? encrypt(lead.email) : null,
        opportunity: {
          create: {
            sourcePlatform: lead.sourcePlatform,
            originalPostUrl: lead.originalPostUrl,
            postText: lead.postText,
            matchedKeywords: lead.matchedKeywords,
          },
        },
      },
    });
    created++;
  }

  console.log(`[Discovery] Created ${created} new leads for org ${organizationId}`);
}

async function discoverViaWebSearch(keywords: string[]): Promise<DiscoveredLead[]> {
  // Uses SerpAPI if key is available, otherwise returns empty (graceful degradation)
  if (!process.env.SERPAPI_KEY) return [];
  const { default: fetch } = await import("node-fetch");
  const results: DiscoveredLead[] = [];

  for (const keyword of keywords.slice(0, 5)) { // Limit to 5 keywords to control cost
    try {
      const url = `https://serpapi.com/search.json?q=${encodeURIComponent(keyword + " RFP tender requirement")}&api_key=${process.env.SERPAPI_KEY}&num=10`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const data = (await res.json()) as {
        organic_results?: Array<{ title: string; link: string; snippet: string }>;
      };

      for (const item of data.organic_results ?? []) {
        results.push({
          sourcePlatform: "web_search",
          originalPostUrl: item.link,
          postText: `${item.title} — ${item.snippet}`,
          matchedKeywords: [keyword],
        });
      }
    } catch (err) {
      console.warn(`[Discovery/WebSearch] Failed for keyword "${keyword}":`, err);
    }
  }

  return results;
}

async function discoverViaX(keywords: string[], bearerToken: string): Promise<DiscoveredLead[]> {
  const { default: fetch } = await import("node-fetch");
  const results: DiscoveredLead[] = [];

  for (const keyword of keywords.slice(0, 3)) {
    try {
      const query = encodeURIComponent(`"${keyword}" -is:retweet lang:en`);
      const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=10&tweet.fields=author_id,text,created_at&expansions=author_id&user.fields=name,username,description`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${bearerToken}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        data?: Array<{ id: string; text: string; author_id: string }>;
      };

      for (const tweet of data.data ?? []) {
        results.push({
          sourcePlatform: "x",
          originalPostUrl: `https://x.com/i/web/status/${tweet.id}`,
          postText: tweet.text,
          matchedKeywords: [keyword],
        });
      }
    } catch (err) {
      console.warn(`[Discovery/X] Failed for keyword "${keyword}":`, err);
    }
  }

  return results;
}
