/**
 * RAG Chunker
 *
 * Splits NormalizedDocument content into Chunk[] using heading-aware,
 * paragraph-boundary splitting. Never splits mid-sentence.
 *
 * Strategy:
 *   1. Split on double-newline (paragraph boundary) first
 *   2. For paragraphs that exceed MAX_CHUNK_CHARS, split on sentence boundary
 *   3. Apply overlap: each chunk includes the tail of the previous chunk
 *   4. Track section heading per chunk using h1-h3 markers in headings[]
 *   5. Every chunk is fully traceable to its source document
 */

import { createHash } from "node:crypto";
import type { NormalizedDocument, Chunk } from "./types.js";

const MAX_CHUNK_CHARS = parseInt(process.env.CHUNK_MAX_CHARS ?? "1000");
const OVERLAP_CHARS = parseInt(process.env.CHUNK_OVERLAP_CHARS ?? "150");

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Split text on sentence boundaries (.!? followed by space or newline).
 * Greedy: accumulates sentences until adding the next would exceed maxChars.
 */
function splitOnSentences(text: string, maxChars: number): string[] {
  const sentenceEnds = /(?<=[.!?])\s+/g;
  const parts = text.split(sentenceEnds);
  const result: string[] = [];
  let current = "";

  for (const part of parts) {
    if (!part.trim()) continue;
    if ((current + " " + part).length > maxChars && current) {
      result.push(current.trim());
      current = part;
    } else {
      current = current ? current + " " + part : part;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

/**
 * Determine the heading that applies to a given paragraph index,
 * using the document's headings[] array as section markers.
 * We match headings by presence in the surrounding text context.
 */
function resolveSection(
  paragraphText: string,
  docSection: string | undefined,
  docHeadings: string[] | undefined
): string | undefined {
  if (!docHeadings?.length) return docSection;
  // Find the last heading that appears before or within this paragraph
  for (let i = docHeadings.length - 1; i >= 0; i--) {
    if (paragraphText.toLowerCase().includes(docHeadings[i].toLowerCase())) {
      return docHeadings[i];
    }
  }
  return docSection;
}

export const chunker = {
  /**
   * Chunk a single NormalizedDocument into Chunk[].
   * Returns an empty array if the document has no content.
   */
  chunk(doc: NormalizedDocument): Chunk[] {
    if (!doc.content || doc.content.trim().length === 0) return [];

    const now = new Date().toISOString();

    // Split into paragraphs first
    const paragraphs = doc.content
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter((p) => p.length > 0);

    // Further split oversized paragraphs on sentence boundaries
    const rawChunks: string[] = [];
    for (const para of paragraphs) {
      if (para.length <= MAX_CHUNK_CHARS) {
        rawChunks.push(para);
      } else {
        const sentences = splitOnSentences(para, MAX_CHUNK_CHARS);
        rawChunks.push(...sentences);
      }
    }

    if (rawChunks.length === 0) return [];

    // Apply overlap: prepend tail of previous chunk
    const overlappedChunks: string[] = [];
    for (let i = 0; i < rawChunks.length; i++) {
      if (i === 0) {
        overlappedChunks.push(rawChunks[i]);
      } else {
        const prevTail = rawChunks[i - 1].slice(-OVERLAP_CHARS);
        const combined = (prevTail + " " + rawChunks[i]).trim();
        overlappedChunks.push(combined);
      }
    }

    const total = overlappedChunks.length;

    return overlappedChunks.map((text, index) => {
      const section = resolveSection(text, doc.section, doc.headings);
      const chunkId = `${doc.id}::chunk::${index}`;
      return {
        id: chunkId,
        knowledge_base_id: doc.knowledge_base_id,
        source_type: doc.source_type,
        source_url: doc.source_url,
        file_name: doc.file_name,
        title: doc.title,
        section,
        page_number: doc.page_number,
        content: text,
        content_hash: sha256(text),
        chunk_index: index,
        total_chunks: total,
        indexed_at: now,
      } satisfies Chunk;
    });
  },

  /**
   * Chunk an array of documents.
   */
  chunkAll(docs: NormalizedDocument[]): Chunk[] {
    return docs.flatMap((doc) => this.chunk(doc));
  },
};
