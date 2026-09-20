import { randomUUID } from "crypto";
import { prisma } from "../config/database.js";
import { groqClient } from "./groqClient.js";
import { websiteScraperService, ScrapedPage } from "./websiteScraperService.js";
import { socialProfileService, SocialProfileResult } from "./socialProfileService.js";
import { notificationService } from "./notificationService.js";

export interface OnboardingJobState {
  jobId: string;
  organizationId: string;
  status: "queued" | "scraping" | "social_lookup" | "deriving" | "ready" | "failed";
  currentStep: string;
  progressPercent: number;
  logs: Array<{ timestamp: string; step: string; message: string }>;
  warnings: string[];
  error?: string;
  resultProfileId?: string;
}

export interface RawBusinessInput {
  websitePages: { url: string; text: string; title?: string }[];
  socialData: SocialProfileResult[] | null;
  documentText: string[];
  userDescription: string | null;
}

export interface DerivedProfileData {
  companySummary: string;
  coreServices: Array<{
    name: string;
    description: string;
    targetUseCase?: string;
  }>;
  industries: string[];
  icp: {
    targetCompanySize: { min: number; max: number; label: string };
    targetIndustries: string[];
    targetGeography: string[];
    buyingSignalKeywords: string[];
    decisionMakerTitles: string[];
  };
  keywords: string[];
  differentiators: string[];
}

// In-memory / Redis cache for fast polling status
const jobs = new Map<string, OnboardingJobState>();

export const onboardingJobService = {
  getJob(jobId: string): OnboardingJobState | undefined {
    return jobs.get(jobId);
  },

  /**
   * Spawns an asynchronous onboarding job. Returns jobId immediately.
   */
  startEnrichmentJob(
    organizationId: string,
    inputs: {
      url?: string;
      description?: string;
      documentText?: string;
      linkedinUrl?: string;
    }
  ): string {
    const jobId = randomUUID();
    const jobState: OnboardingJobState = {
      jobId,
      organizationId,
      status: "queued",
      currentStep: "Enrichment job queued",
      progressPercent: 5,
      logs: [{ timestamp: new Date().toISOString(), step: "queued", message: "Job created and queued" }],
      warnings: [],
    };
    jobs.set(jobId, jobState);

    // Run async in background without blocking response
    setImmediate(() => {
      this.executeJob(jobId, organizationId, inputs).catch((err) => {
        console.error(`[OnboardingJob ${jobId}] Fatal execution error:`, err);
        this.updateJobState(jobId, {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
          currentStep: "Job execution failed",
        });
      });
    });

    return jobId;
  },

  /**
   * Main asynchronous pipeline:
   * Step 2 (Website Scraping) -> Step 3 (Social Lookup) -> Step 4/5 (Aggregation) -> Step 6 (Groq AI Derivation) -> Step 7 (Draft Save)
   */
  async executeJob(
    jobId: string,
    organizationId: string,
    inputs: {
      url?: string;
      description?: string;
      documentText?: string;
      linkedinUrl?: string;
    }
  ): Promise<void> {
    const scrapedPages: ScrapedPage[] = [];
    const socialResults: SocialProfileResult[] = [];
    const warnings: string[] = [];

    // â”€â”€â”€ STEP 2: Website Scraping â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (inputs.url && inputs.url.trim()) {
      this.updateJobState(jobId, {
        status: "scraping",
        currentStep: `Reading homepage ${inputs.url}...`,
        progressPercent: 15,
      });
      this.emitEvent(organizationId, jobId, "scraping_started", `Scraping website ${inputs.url}`);

      const scrapeRes = await websiteScraperService.scrapeSite(inputs.url.trim(), (pageUrl, count) => {
        this.updateJobState(jobId, {
          currentStep: `Read page ${count}: ${pageUrl}`,
          progressPercent: Math.min(40, 15 + count * 5),
        });
        this.emitEvent(organizationId, jobId, "scraping_page_fetched", `Fetched ${pageUrl}`);
      });

      scrapedPages.push(...scrapeRes.pages);
      if (scrapeRes.warnings.length > 0) {
        warnings.push(...scrapeRes.warnings);
      }

      this.emitEvent(organizationId, jobId, "scraping_complete", `Scraped ${scrapedPages.length} pages`);

      // Detect LinkedIn or social links if user didn't specify one
      if (!inputs.linkedinUrl && scrapeRes.socialLinks.linkedin) {
        inputs.linkedinUrl = scrapeRes.socialLinks.linkedin;
      }
    } else {
      this.updateJobState(jobId, {
        currentStep: "No website URL provided; relying on manual description and documents",
        progressPercent: 25,
      });
    }

    // â”€â”€â”€ STEP 3: LinkedIn & Social Inspection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (inputs.linkedinUrl && inputs.linkedinUrl.trim()) {
      this.updateJobState(jobId, {
        status: "social_lookup",
        currentStep: `Inspecting LinkedIn URL: ${inputs.linkedinUrl}...`,
        progressPercent: 45,
      });
      this.emitEvent(organizationId, jobId, "linkedin_lookup_started", `Checking LinkedIn compliance for ${inputs.linkedinUrl}`);

      const liResult = await socialProfileService.inspectProfile(inputs.linkedinUrl.trim());
      socialResults.push(liResult);

      if (liResult.status === "unavailable") {
        warnings.push(`LinkedIn data: ${liResult.reason}`);
        this.emitEvent(organizationId, jobId, "linkedin_unavailable", `LinkedIn data unavailable: ${liResult.reason}`);
      } else {
        this.emitEvent(organizationId, jobId, "linkedin_lookup_complete", "Compliant LinkedIn profile parsed");
      }
    }

    // â”€â”€â”€ STEP 4 & 5: Aggregation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    this.updateJobState(jobId, {
      status: "deriving",
      currentStep: "Aggregating business signals and analyzing with Groq AI...",
      progressPercent: 60,
    });
    this.emitEvent(organizationId, jobId, "profile_derivation_started", "Analyzing aggregated data with Groq Llama AI");

    const rawInput: RawBusinessInput = {
      websitePages: scrapedPages.map((p) => ({ url: p.url, text: p.text, title: p.title })),
      socialData: socialResults.length > 0 ? socialResults : null,
      documentText: inputs.documentText ? [inputs.documentText] : [],
      userDescription: inputs.description?.trim() || null,
    };

    // â”€â”€â”€ STEP 6: Groq LLM Business Profile Derivation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const derived = await this.deriveBusinessProfileWithGroq(rawInput);

    // â”€â”€â”€ STEP 7: Save Draft Business Profile into Database â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    this.updateJobState(jobId, {
      currentStep: "Saving draft Business Profile for human review...",
      progressPercent: 90,
    });

    const profile = await prisma.businessProfile.upsert({
      where: { organizationId },
      update: {
        status: "DRAFT",
        sourceUrl: inputs.url || null,
        linkedinUrl: inputs.linkedinUrl || null,
        userDescription: inputs.description || null,
        description: inputs.description || null,
        rawScrapedData: scrapedPages as unknown as object,
        companySummary: derived.companySummary,
        coreServices: derived.coreServices as unknown as object,
        derivedServices: derived.coreServices as unknown as object,
        industries: derived.industries,
        icp: derived.icp as unknown as object,
        keywords: derived.keywords,
        differentiators: derived.differentiators,
      },
      create: {
        organizationId,
        status: "DRAFT",
        sourceUrl: inputs.url || null,
        linkedinUrl: inputs.linkedinUrl || null,
        userDescription: inputs.description || null,
        description: inputs.description || null,
        rawScrapedData: scrapedPages as unknown as object,
        companySummary: derived.companySummary,
        coreServices: derived.coreServices as unknown as object,
        derivedServices: derived.coreServices as unknown as object,
        industries: derived.industries,
        icp: derived.icp as unknown as object,
        keywords: derived.keywords,
        differentiators: derived.differentiators,
      },
    });

    this.updateJobState(jobId, {
      status: "ready",
      currentStep: "Draft profile ready for human confirmation",
      progressPercent: 100,
      resultProfileId: profile.id,
      warnings,
    });

    this.emitEvent(organizationId, jobId, "profile_draft_ready", "Business profile draft is ready for review");

    // Seamless RAG Auto-Sync: index all scraped pages into Qdrant Cloud so AI Chatbot is immediately ready
    try {
      const { onboardingSyncService } = await import("../rag/onboardingSync.js");
      onboardingSyncService.saveOnboardingSources({
        organizationId,
        websiteUrl: inputs.url?.trim() || undefined,
        scrapedPages: scrapedPages.map((p) => ({ url: p.url, text: p.text, title: p.title })),
        documentText: inputs.documentText || undefined,
        companySummary: derived.companySummary,
      });
      onboardingSyncService.syncToKnowledgeBase(organizationId).then((res) => {
        console.log(`[OnboardingJobService] Auto-indexed ${res.totalChunksIndexed} chunks into Qdrant for org ${organizationId}`);
      }).catch((err) => {
        console.warn("[OnboardingJobService] Background RAG auto-sync error:", (err as Error).message);
      });
    } catch (ragSyncErr) {
      console.warn("[OnboardingJobService] RAG sync import error:", (ragSyncErr as Error).message);
    }
  },

  /**
   * Calls Groq with strict JSON output schema and automatic retry on parse errors.
   */
  async deriveBusinessProfileWithGroq(input: RawBusinessInput): Promise<DerivedProfileData> {
    const contextLines: string[] = [];

    if (input.userDescription) {
      contextLines.push(`USER DESCRIPTION:\n${input.userDescription}`);
    }

    if (input.websitePages.length > 0) {
      contextLines.push(
        "SCRAPED WEBSITE PAGES:\n" +
          input.websitePages
            .map((p) => `URL: ${p.url}\nTitle: ${p.title || ""}\nContent: ${p.text.slice(0, 2000)}`)
            .join("\n---\n")
      );
    }

    if (input.documentText.length > 0) {
      contextLines.push(`UPLOADED DOCUMENTS TEXT:\n${input.documentText.join("\n")}`);
    }

    if (input.socialData && input.socialData.length > 0) {
      contextLines.push(`SOCIAL PROFILES DATA:\n${JSON.stringify(input.socialData)}`);
    }

    const aggregatedPrompt = contextLines.join("\n\n====================\n\n");

    const systemPrompt = `You are an elite B2B Business Understanding & Sales Strategy Engine for VYAPERI X.
Analyze the provided company information and extract a high-precision, actionable business profile.

Output MUST strictly follow this JSON structure:
{
  "companySummary": "2-3 sentence clear, high-impact description of what the business does and for whom.",
  "coreServices": [
    {
      "name": "Specific service or product name (e.g. 'Custom B2B SaaS Engineering', not generic 'IT')",
      "description": "What is delivered and key business value",
      "targetUseCase": "Specific customer need or pain point solved"
    }
  ],
  "industries": ["Specific Industry 1", "Specific Industry 2"],
  "icp": {
    "targetCompanySize": { "min": 10, "max": 500, "label": "10-500 employees" },
    "targetIndustries": ["Industry A", "Industry B"],
    "targetGeography": ["India", "UAE", "Global"],
    "buyingSignalKeywords": ["hiring React developers", "migrating from legacy ERP", "expansion into Mumbai"],
    "decisionMakerTitles": ["Chief Technology Officer", "VP Sales", "Managing Director"]
  },
  "keywords": ["specific discovery search keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"],
  "differentiators": ["Specific unique selling point or claim 1", "USP 2"]
}

Rules:
1. 'keywords' must be specific and directly feed an automated lead discovery search engine (LinkedIn, Google, Job boards, directories).
2. 'coreServices' must list 2 to 6 concrete offerings.
3. If information is sparse, deduce reasonable, professional ICP parameters from the context.
4. Output ONLY valid, parseable JSON. No markdown fences, no explanatory preamble.`;

    try {
      return await groqClient.getJsonCompletion<DerivedProfileData>({
        model: "llama-3.3-70b-versatile",
        systemPrompt,
        messages: [{ role: "user", content: aggregatedPrompt }],
        maxTokens: 1500,
        temperature: 0.2,
      });
    } catch (firstErr) {
      console.warn("[OnboardingJob] First Groq attempt failed, retrying with correction prompt:", firstErr);
      // Retry once with error correction
      return await groqClient.getJsonCompletion<DerivedProfileData>({
        model: "llama-3.3-70b-versatile",
        systemPrompt: systemPrompt + "\nCRITICAL: You failed to return valid JSON previously. Return PURE JSON only.",
        messages: [{ role: "user", content: aggregatedPrompt }],
        maxTokens: 1500,
        temperature: 0.1,
      });
    }
  },

  updateJobState(jobId: string, update: Partial<OnboardingJobState>): void {
    const job = jobs.get(jobId);
    if (!job) return;

    if (update.currentStep && update.currentStep !== job.currentStep) {
      job.logs.push({
        timestamp: new Date().toISOString(),
        step: update.status || job.status,
        message: update.currentStep,
      });
    }

    if (update.warnings) {
      job.warnings.push(...update.warnings);
    }

    Object.assign(job, update);
  },

  emitEvent(organizationId: string, jobId: string, type: string, message: string): void {
    notificationService.push(organizationId, {
      type: "ONBOARDING_STATUS",
      jobId,
      step: type,
      message,
      timestamp: new Date().toISOString(),
    });
  },
};

