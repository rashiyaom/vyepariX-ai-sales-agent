/**
 * Onboarding to RAG Knowledge Base Sync Service
 *
 * Automatically fetches the website link and uploaded PDF/deck data
 * from the Business Onboarding flow and indexes them into Qdrant Cloud.
 */

import { kbStore } from "./kbStore.js";
import { chunker } from "./chunker.js";
import { qdrantService } from "./qdrantService.js";
import { embeddingService } from "./embeddingService.js";
import { scraperAdapter } from "./scraperAdapter.js";
import { ingestionOrchestrator } from "./ingestionOrchestrator.js";
import type { NormalizedDocument } from "./types.js";
import { createHash } from "node:crypto";
import { prisma } from "../config/database.js";

export interface OnboardingSourceData {
  organizationId: string;
  websiteUrl?: string;
  documentText?: string;
  documentFileName?: string;
  scrapedPages?: Array<{ url: string; text: string; title?: string }>;
  companySummary?: string;
  updatedAt: Date;
}

// In-memory cache of latest onboarding inputs per org
const onboardingStore = new Map<string, OnboardingSourceData>();

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export const onboardingSyncService = {
  /**
   * Save or update onboarding sources for an org
   */
  saveOnboardingSources(data: Partial<OnboardingSourceData> & { organizationId: string }): void {
    const existing = onboardingStore.get(data.organizationId) || {
      organizationId: data.organizationId,
      updatedAt: new Date(),
    };

    const updated: OnboardingSourceData = {
      ...existing,
      ...data,
      websiteUrl: data.websiteUrl || existing.websiteUrl,
      documentText: data.documentText || existing.documentText,
      documentFileName: data.documentFileName || existing.documentFileName,
      scrapedPages: data.scrapedPages || existing.scrapedPages,
      updatedAt: new Date(),
    };

    onboardingStore.set(data.organizationId, updated);
  },

  /**
   * Get available onboarding sources for an org (checks in-memory store + prisma BusinessProfile)
   */
  async getOnboardingSources(organizationId: string): Promise<OnboardingSourceData | null> {
    const mem = onboardingStore.get(organizationId);

    // Also check Prisma BusinessProfile if available
    let dbUrl: string | undefined;
    let dbPages: Array<{ url: string; text: string; title?: string }> | undefined;
    let dbSummary: string | undefined;

    try {
      const profile = await prisma.businessProfile.findUnique({
        where: { organizationId },
      });
      if (profile) {
        dbUrl = profile.sourceUrl || undefined;
        dbSummary = profile.companySummary || undefined;
        if (profile.rawScrapedData && Array.isArray(profile.rawScrapedData)) {
          dbPages = profile.rawScrapedData as Array<{ url: string; text: string; title?: string }>;
        }
      }
    } catch {
      // Prisma offline, proceed with memory
    }

    if (!mem && !dbUrl && !dbPages && !dbSummary) {
      return null;
    }

    return {
      organizationId,
      websiteUrl: mem?.websiteUrl || dbUrl,
      documentText: mem?.documentText,
      documentFileName: mem?.documentFileName || (mem?.documentText ? "Onboarding_Pitch_Deck.pdf" : undefined),
      scrapedPages: mem?.scrapedPages || dbPages,
      companySummary: mem?.companySummary || dbSummary,
      updatedAt: mem?.updatedAt || new Date(),
    };
  },

  /**
   * Automatically import and index onboarding sources into a Knowledge Base
   */
  async syncToKnowledgeBase(
    organizationId: string,
    targetKbId?: string,
    onProgress?: (msg: string) => void
  ) {
    const sources = await this.getOnboardingSources(organizationId);
    if (!sources || (!sources.websiteUrl && !sources.documentText && !sources.scrapedPages?.length)) {
      throw new Error("No website link or document found in previous onboarding session.");
    }

    // 1. Get or create Knowledge Base
    let kb = targetKbId ? await kbStore.getKB(targetKbId, organizationId) : null;
    if (!kb) {
      const allKbs = await kbStore.listKBs(organizationId);
      if (allKbs.length > 0) {
        kb = allKbs[0];
      } else {
        kb = await kbStore.createKB({
          organizationId,
          name: "Company Knowledge Base (From Onboarding)",
          description: "Auto-synced from onboarding website and documents",
        });
      }
    }

    const compositeKbId = `${organizationId}:${kb.id}`;
    await qdrantService.ensureCollection(process.env.EMBEDDING_MODEL ?? "Xenova/all-MiniLM-L6-v2");

    const results = {
      knowledgeBaseId: kb.id,
      knowledgeBaseName: kb.name,
      sourcesIndexed: [] as string[],
      totalChunksIndexed: 0,
    };

    // 2. Ingest Document (PDF text from onboarding)
    if (sources.documentText && sources.documentText.trim().length > 20) {
      const fileName = sources.documentFileName || "Onboarding_Pitch_Deck.pdf";
      onProgress?.(`Indexing document: ${fileName}...`);

      const source = await kbStore.createSource({
        knowledgeBaseId: kb.id,
        sourceType: "pdf",
        fileName,
      });

      const doc: NormalizedDocument = {
        id: sha256(`pdf:${fileName}:${sources.documentText.slice(0, 100)}`),
        knowledge_base_id: compositeKbId,
        source_type: "pdf",
        file_name: fileName,
        title: fileName,
        content: sources.documentText.trim(),
        content_hash: sha256(sources.documentText.trim()),
        ingested_at: new Date().toISOString(),
      };

      const chunks = chunker.chunk(doc);
      if (chunks.length > 0) {
        const vectors = await embeddingService.embedChunks(chunks);
        await qdrantService.upsert(chunks, vectors);

        await kbStore.updateSource(source.id, {
          pagesIndexed: 1,
          chunksIndexed: chunks.length,
          status: "ready",
        });

        results.sourcesIndexed.push(`PDF: ${fileName} (${chunks.length} chunks)`);
        results.totalChunksIndexed += chunks.length;
      }
    }

    // 3. Ingest Website (from onboarding URL or pre-scraped pages)
    if (sources.scrapedPages && sources.scrapedPages.length > 0) {
      onProgress?.(`Indexing ${sources.scrapedPages.length} pre-scraped website pages...`);
      const webUrl = sources.websiteUrl || sources.scrapedPages[0]?.url || "https://company.internal";

      const source = await kbStore.createSource({
        knowledgeBaseId: kb.id,
        sourceType: "website",
        url: webUrl,
      });

      const docs: NormalizedDocument[] = sources.scrapedPages.map((page) => ({
        id: sha256(page.url),
        knowledge_base_id: compositeKbId,
        source_type: "website",
        source_url: page.url,
        title: page.title || page.url,
        content: page.text.trim(),
        content_hash: sha256(page.text.trim()),
        ingested_at: new Date().toISOString(),
      }));

      const chunks = chunker.chunkAll(docs);
      if (chunks.length > 0) {
        const vectors = await embeddingService.embedChunks(chunks);
        await qdrantService.upsert(chunks, vectors);

        await kbStore.updateSource(source.id, {
          pagesIndexed: docs.length,
          chunksIndexed: chunks.length,
          status: "ready",
        });

        results.sourcesIndexed.push(`Website: ${webUrl} (${chunks.length} chunks across ${docs.length} pages)`);
        results.totalChunksIndexed += chunks.length;
      }
    } else if (sources.websiteUrl && sources.websiteUrl.trim()) {
      onProgress?.(`Crawling website URL from onboarding: ${sources.websiteUrl}...`);
      const webUrl = sources.websiteUrl.trim();

      const source = await kbStore.createSource({
        knowledgeBaseId: kb.id,
        sourceType: "website",
        url: webUrl,
      });

      try {
        const docs = await scraperAdapter.adapt(webUrl, {
          knowledgeBaseId: compositeKbId,
        });

        await ingestionOrchestrator.ingest(docs, {
          knowledgeBaseId: compositeKbId,
          kbSourceId: source.id,
        });

        results.sourcesIndexed.push(`Website: ${webUrl} (${docs.length} pages)`);
      } catch (err) {
        console.warn("[OnboardingSync] Website crawl error:", (err as Error).message);
      }
    }

    return results;
  },
};
