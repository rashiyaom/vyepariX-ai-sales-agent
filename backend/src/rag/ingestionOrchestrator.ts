import { kbStore } from "./kbStore.js";
﻿/**
 * RAG Ingestion Orchestrator
 *
 * Coordinates the full ingestion pipeline:
 *   NormalizedDocument[] -> Chunker -> EmbeddingService -> QdrantService
 *
 * Key behaviors:
 *   - Content-hash dedup: skip chunks whose hash already exists in Qdrant
 *   - Stale deletion: after rescan, remove Qdrant points no longer present
 *   - Progress events: emitted via callback for SSE streaming to admin UI
 *   - KBSource status updates: writes to Prisma after each stage
 */

import { prisma } from "../config/database.js";
import { chunker } from "./chunker.js";
import { embeddingService } from "./embeddingService.js";
import { qdrantService } from "./qdrantService.js";
import type { NormalizedDocument, IngestionProgressEvent } from "./types.js";

export interface IngestionConfig {
  knowledgeBaseId: string; // composite: `${organizationId}:${kbId}`
  kbSourceId: string;      // Prisma KBSource.id for status updates
  onProgress?: (event: IngestionProgressEvent) => void;
}

function emitProgress(
  config: IngestionConfig,
  type: IngestionProgressEvent["type"],
  message: string,
  extra: Partial<IngestionProgressEvent> = {}
) {
  config.onProgress?.({
    type,
    sourceId: config.kbSourceId,
    message,
    timestamp: new Date().toISOString(),
    ...extra,
  });
}

export const ingestionOrchestrator = {
  /**
   * Ingest a set of NormalizedDocuments into Qdrant.
   *
   * For rescan use-case:
   *   - pass existingDocIds = all point IDs currently in Qdrant for this KB
   *   - orchestrator will delete stale ones after upsert
   *
   * For initial ingest: existingDocIds can be omitted.
   */
  async ingest(
    docs: NormalizedDocument[],
    config: IngestionConfig,
    existingPointIds?: string[]
  ): Promise<void> {
    const { kbSourceId } = config;

    // Ensure Qdrant collection exists
    await qdrantService.ensureCollection(embeddingService.modelName);

    // Get existing hashes for dedup
    const existingHashes = await qdrantService.getExistingHashes(config.knowledgeBaseId);

    emitProgress(config, "INDEX_STARTED", `Starting indexing of ${docs.length} documents`, {
      pagesDiscovered: docs.length,
    });

    // Update Prisma status
    try { await prisma.kBSource.update({
      where: { id: kbSourceId },
      data: { status: "indexing" },
    }); } catch (err) { console.warn("[Orchestrator] Prisma status update skipped:", (err as Error).message); }

    let pagesIndexed = 0;
    let pagesFailed = 0;
    let chunksIndexed = 0;
    const ingestedDocIds = new Set<string>();

    for (const doc of docs) {
      try {
        // Chunk the document
        const chunks = chunker.chunk(doc);
        if (chunks.length === 0) {
          pagesFailed++;
          emitProgress(config, "PAGE_FAILED", `No chunks produced for: ${doc.source_url ?? doc.file_name}`, {
            pagesFailed,
          });
          continue;
        }

        // Dedup: skip chunks whose content hash hasn't changed
        const newChunks = chunks.filter((c) => !existingHashes.has(c.content_hash));

        if (newChunks.length === 0) {
          // All chunks unchanged — mark doc IDs as still present (not stale)
          for (const c of chunks) ingestedDocIds.add(c.id);
          pagesIndexed++;
          emitProgress(config, "CHUNK_INDEXED", `Skipped (unchanged): ${doc.source_url ?? doc.file_name}`, {
            pagesIndexed,
            chunksIndexed,
          });
          continue;
        }

        // Embed new chunks
        const vectors = await embeddingService.embedChunks(newChunks);

        // Upsert to Qdrant
        await qdrantService.upsert(newChunks, vectors);

        for (const c of chunks) ingestedDocIds.add(c.id);
        for (const c of newChunks) existingHashes.add(c.content_hash);

        chunksIndexed += newChunks.length;
        pagesIndexed++;

        emitProgress(config, "CHUNK_INDEXED", `Indexed: ${doc.source_url ?? doc.file_name} (${newChunks.length} chunks)`, {
          pagesIndexed,
          chunksIndexed,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        pagesFailed++;
        emitProgress(config, "PAGE_FAILED", `Failed: ${doc.source_url ?? doc.file_name} — ${msg}`, {
          pagesFailed,
          error: msg,
        });
        console.error(`[Orchestrator] Indexing error for doc ${doc.id}:`, err);
      }
    }

    // Stale deletion: remove Qdrant points that were in the previous index
    // but are no longer present in the current crawl
    if (existingPointIds && existingPointIds.length > 0) {
      const staleIds = existingPointIds.filter((id) => !ingestedDocIds.has(id));
      if (staleIds.length > 0) {
        await qdrantService.deleteByIds(staleIds);
        emitProgress(config, "INDEX_COMPLETE", `Deleted ${staleIds.length} stale chunks`);
      }
    }

    const now = new Date();
    try { await prisma.kBSource.update({
      where: { id: kbSourceId },
      data: {
        status: pagesFailed > 0 && pagesIndexed === 0 ? "error" : pagesFailed > 0 ? "partial" : "ready",
        pagesIndexed,
        pagesFailed,
        chunksIndexed,
        indexedAt: now,
        lastSuccessfulScan: pagesIndexed > 0 ? now : undefined,
        errorMessage: pagesFailed > 0 ? `${pagesFailed} page(s) failed to index` : null,
      },
    }); } catch (err) { console.warn("[Orchestrator] Prisma status update skipped:", (err as Error).message); }

    await kbStore.updateSource(kbSourceId, {
      status: pagesFailed > 0 && pagesIndexed === 0 ? "error" : pagesFailed > 0 ? "partial" : "ready",
      pagesIndexed,
      chunksIndexed,
      errorMessage: pagesFailed > 0 ? `${pagesFailed} page(s) failed to index` : null,
    });
    emitProgress(config, "INDEX_COMPLETE", `Indexing complete: ${pagesIndexed} indexed, ${pagesFailed} failed, ${chunksIndexed} chunks`, {
      pagesIndexed,
      pagesFailed,
      chunksIndexed,
    });
  },
};
