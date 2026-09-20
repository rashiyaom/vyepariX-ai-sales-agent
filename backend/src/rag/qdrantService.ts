
function toPointId(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id;
  const hex = createHash("md5").update(id).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
import { createHash } from "node:crypto";
/**
 * RAG Qdrant Service
 *
 * All operations scoped to knowledge_base_id � cross-tenant leakage is a hard error.
 * Uses @qdrant/js-client-rest REST client.
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import type { Chunk, QdrantPayload, RetrievedChunk } from "./types.js";

const COLLECTION = process.env.QDRANT_COLLECTION ?? "vyaperi_rag";
const VECTOR_SIZE = 384;

let _client: QdrantClient | null = null;

function client(): QdrantClient {
  if (!_client) {
    const url = process.env.QDRANT_URL;
    if (!url) {
      throw new Error(
        "QDRANT_URL env var is not set. For Qdrant Cloud, provide https://<cluster-id>.<region>.<cloud-provider>.cloud.qdrant.io:6333 and set QDRANT_API_KEY."
      );
    }
    const apiKey = process.env.QDRANT_API_KEY?.trim() || undefined;
    if ((url.includes("cloud.qdrant.io") || url.includes("qdrant.tech")) && !apiKey) {
      console.warn(
        "[QdrantService] WARNING: Connecting to Qdrant Cloud without QDRANT_API_KEY. Requests will likely fail with 401 Unauthorized."
      );
    }
    _client = new QdrantClient({
      url,
      apiKey,
      checkCompatibility: false,
    });
  }
  return _client;
}

export const qdrantService = {
  async ensureCollection(embeddingModel: string): Promise<void> {
    try {
      const existing = await client().getCollection(COLLECTION);
      const configParams = existing.config?.params as { vectors?: { size?: number } } | undefined;
      const size = configParams?.vectors?.size;
      if (size && size !== VECTOR_SIZE) {
        throw new Error(
          `Qdrant collection "${COLLECTION}" has vector size ${size} but model expects ${VECTOR_SIZE}. Re-index required.`
        );
      }
      console.log(`[QdrantService] Collection "${COLLECTION}" verified (model=${embeddingModel})`);
    } catch (err: unknown) {
      const msg = String(err);
      const status = (err as Record<string, unknown>)?.status ?? (err as { response?: { status?: number } })?.response?.status;
      if (
        status === 404 ||
        msg.includes("Not found") ||
        msg.includes("404") ||
        msg.includes("doesn't exist") ||
        msg.includes("Not Found")
      ) {
        await client().createCollection(COLLECTION, {
          vectors: { size: VECTOR_SIZE, distance: "Cosine" },
        });
        try {
          await client().createPayloadIndex(COLLECTION, {
            field_name: "knowledge_base_id",
            field_schema: "keyword",
          });
        } catch {
          // Index may already exist or be managed by cluster
        }
        try {
          await client().createPayloadIndex(COLLECTION, {
            field_name: "content_hash",
            field_schema: "keyword",
          });
        } catch {
          // Index may already exist or be managed by cluster
        }
        console.log(`[QdrantService] Created collection "${COLLECTION}" (${VECTOR_SIZE}-dim, model=${embeddingModel})`);
      } else {
        throw err;
      }
    }
  },

  async getExistingHashes(knowledgeBaseId: string): Promise<Set<string>> {
    if (!knowledgeBaseId) throw new Error("knowledgeBaseId is required");

    const hashes = new Set<string>();
    let offset: number | string | undefined = undefined;

    do {
      const result = await client().scroll(COLLECTION, {
        filter: {
          must: [{ key: "knowledge_base_id", match: { value: knowledgeBaseId } }],
        },
        with_payload: ["content_hash"],
        with_vector: false,
        limit: 1000,
        offset: offset,
      });

      for (const point of result.points) {
        const payload = point.payload as Record<string, unknown> | undefined;
        const hash = payload?.["content_hash"];
        if (typeof hash === "string") hashes.add(hash);
      }

      const nextOffset = result.next_page_offset;
      if (nextOffset === null || nextOffset === undefined) {
        offset = undefined;
      } else if (typeof nextOffset === "number" || typeof nextOffset === "string") {
        offset = nextOffset;
      } else {
        offset = undefined;
      }
    } while (offset !== undefined);

    return hashes;
  },

  async getAllPointIds(knowledgeBaseId: string): Promise<string[]> {
    if (!knowledgeBaseId) throw new Error("knowledgeBaseId is required");

    const ids: string[] = [];
    let offset: number | string | undefined = undefined;

    do {
      const result = await client().scroll(COLLECTION, {
        filter: {
          must: [{ key: "knowledge_base_id", match: { value: knowledgeBaseId } }],
        },
        with_payload: false,
        with_vector: false,
        limit: 1000,
        offset: offset,
      });

      for (const point of result.points) {
        ids.push(String(point.id));
      }

      const nextOffset = result.next_page_offset;
      if (nextOffset === null || nextOffset === undefined) {
        offset = undefined;
      } else if (typeof nextOffset === "number" || typeof nextOffset === "string") {
        offset = nextOffset;
      } else {
        offset = undefined;
      }
    } while (offset !== undefined);

    return ids;
  },

  async upsert(chunks: Chunk[], vectors: number[][]): Promise<void> {
    if (chunks.length === 0) return;
    if (chunks.length !== vectors.length) {
      throw new Error(`Chunk/vector count mismatch: ${chunks.length} vs ${vectors.length}`);
    }

    const BATCH_SIZE = 100;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      const batchVectors = vectors.slice(i, i + BATCH_SIZE);

      const points = batchChunks.map((chunk, j) => ({
        id: toPointId(chunk.id),
        vector: batchVectors[j],
        payload: {
          knowledge_base_id: chunk.knowledge_base_id,
          source_type: chunk.source_type,
          source_url: chunk.source_url ?? null,
          file_name: chunk.file_name ?? null,
          title: chunk.title,
          section: chunk.section ?? null,
          page_number: chunk.page_number ?? null,
          content: chunk.content,
          content_hash: chunk.content_hash,
          chunk_index: chunk.chunk_index,
          indexed_at: chunk.indexed_at,
        },
      }));

      await client().upsert(COLLECTION, { points, wait: true });
    }
  },

  async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await client().delete(COLLECTION, { points: ids.map(toPointId), wait: true });
  },

  async deleteByKnowledgeBase(knowledgeBaseId: string): Promise<void> {
    if (!knowledgeBaseId) throw new Error("knowledgeBaseId required � refusing to wipe entire collection");
    await client().delete(COLLECTION, {
      filter: {
        must: [{ key: "knowledge_base_id", match: { value: knowledgeBaseId } }],
      },
      wait: true,
    });
  },

  async search(
    queryVector: number[],
    knowledgeBaseId: string,
    topK: number = parseInt(process.env.RETRIEVAL_TOP_K ?? "20")
  ): Promise<RetrievedChunk[]> {
    if (!knowledgeBaseId) {
      throw new Error("SECURITY: knowledgeBaseId is required for all Qdrant searches");
    }

    const results = await client().query(COLLECTION, {
      query: queryVector,
      filter: {
        must: [{ key: "knowledge_base_id", match: { value: knowledgeBaseId } }],
      },
      limit: topK,
      with_payload: true,
    });

    return results.points.map((r) => ({
      id: String(r.id),
      score: typeof r.score === "number" ? r.score : 0,
      payload: r.payload as unknown as QdrantPayload,
    }));
  },
};

