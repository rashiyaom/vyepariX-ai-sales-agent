/**
 * RAG Retrieval Service
 *
 * Orchestrates:
 *   1. Query embedding
 *   2. Qdrant semantic search (scoped to knowledge_base_id)
 *   3. Score-threshold reranking (drop duplicates + low-score chunks)
 *   4. Confidence check -> abstention decision
 *
 * All retrieval is tenant-isolated via knowledge_base_id.
 */

import { qdrantService } from "./qdrantService.js";
import { embeddingService } from "./embeddingService.js";
import type { RetrievalResult, RetrievedChunk } from "./types.js";

const DEFAULT_MIN_SCORE = 0.20;

function getMinScore(): number {
  const envVal = process.env.MIN_RELEVANCE_SCORE;
  if (envVal) {
    const parsed = parseFloat(envVal);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 0.30) return parsed;
  }
  return DEFAULT_MIN_SCORE;
}

const RERANK_TOP_K = parseInt(process.env.RERANK_TOP_K ?? "5");

/**
 * Remove duplicate chunks (same content_hash) keeping highest-scoring copy.
 */
function deduplicateByHash(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const seen = new Map<string, RetrievedChunk>();
  for (const chunk of chunks) {
    const hash = chunk.payload.content_hash;
    const existing = seen.get(hash);
    if (!existing || chunk.score > existing.score) {
      seen.set(hash, chunk);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.score - a.score);
}

/**
 * Simple score-weighted reranker (v1).
 * Uses adaptive threshold to prevent false abstentions on conversational questions.
 */
function rerank(candidates: RetrievedChunk[], topK: number): RetrievedChunk[] {
  const minScore = getMinScore();
  const filtered = candidates.filter((c) => c.score >= minScore);
  const pool = filtered.length > 0 ? filtered : (candidates[0]?.score >= 0.18 ? [candidates[0]] : []);
  const deduped = deduplicateByHash(pool);
  return deduped.slice(0, topK);
}

export const retrievalService = {
  /**
   * Full retrieval pipeline for a single query.
   *
   * @param query - The user question (already resolved for follow-ups)
   * @param knowledgeBaseId - Composite `${organizationId}:${kbId}` - REQUIRED
   */
  async retrieve(query: string, knowledgeBaseId: string): Promise<RetrievalResult> {
    if (!knowledgeBaseId) {
      throw new Error("SECURITY: knowledgeBaseId required for retrieval");
    }

    // 1. Embed query
    const queryVector = await embeddingService.embedQuery(query);

    // 2. Qdrant semantic search
    const topK = parseInt(process.env.RETRIEVAL_TOP_K ?? "20");
    const candidates = await qdrantService.search(queryVector, knowledgeBaseId, topK);

    if (candidates.length === 0) {
      return { chunks: [], shouldAbstain: true, maxScore: 0 };
    }

    // 3. Rerank
    const minScore = getMinScore();
    const reranked = rerank(candidates, RERANK_TOP_K);

    const maxScore = reranked.length > 0 ? reranked[0].score : 0;
    const shouldAbstain = maxScore < minScore || reranked.length === 0;

    return { chunks: reranked, shouldAbstain, maxScore };
  },

  /**
   * Resolve a follow-up question by prepending the last assistant turn
   * so the query embedding captures the conversational context.
   */
  resolveFollowUp(
    currentMessage: string,
    conversationHistory: Array<{ role: string; content: string }>
  ): string {
    if (conversationHistory.length === 0) return currentMessage;

    // Take last 2 assistant messages as context for follow-up resolution
    const recentAssistant = conversationHistory
      .filter((m) => m.role === "assistant")
      .slice(-2)
      .map((m) => m.content)
      .join(" ");

    if (!recentAssistant) return currentMessage;

    // Prepend context to help embedding capture pronoun references ("it", "that one", etc.)
    return `Context: ${recentAssistant.slice(0, 400)}\nQuestion: ${currentMessage}`;
  },
};
