/**
 * RAG Pipeline -- Core Type Definitions
 *
 * NormalizedDocument is the single contract between all pipeline stages.
 * Nothing downstream (chunker, embedder, Qdrant) ever touches raw scraper
 * or raw pdf-parse output directly.
 */

// Source document (pre-chunk)

export type SourceType = "website" | "pdf";

export interface NormalizedDocument {
  /** Unique document ID (URL hash for web pages, PDF page key for PDF pages) */
  id: string;
  /** KB + org composite scope: `${organizationId}:${knowledgeBaseId}` */
  knowledge_base_id: string;
  source_type: SourceType;
  /** Website pages only */
  source_url?: string;
  /** PDF only */
  file_name?: string;
  title: string;
  /** Heading under which this content falls (h1-h3), if extractable */
  section?: string;
  /** PDF only: 1-indexed page number */
  page_number?: number;
  /** Full clean text of this page/document unit (not yet chunked) */
  content: string;
  /** Extracted headings from the page (for heading-aware chunking) */
  headings?: string[];
  /** SHA-256 hex digest of content -- used for dedup and rescan diffing */
  content_hash: string;
  metadata?: Record<string, unknown>;
  crawled_at?: string;
  ingested_at?: string;
  updated_at?: string;
}

// Chunk (post-split, ready for embedding)

export interface Chunk {
  /** `${doc.id}::chunk::${chunkIndex}` */
  id: string;
  knowledge_base_id: string;
  source_type: SourceType;
  source_url?: string;
  file_name?: string;
  title: string;
  section?: string;
  page_number?: number;
  /** The text of this specific chunk */
  content: string;
  content_hash: string;
  chunk_index: number;
  total_chunks: number;
  indexed_at: string;
}

// Qdrant payload (stored alongside each vector)

export interface QdrantPayload {
  knowledge_base_id: string;
  source_type: SourceType;
  source_url?: string;
  file_name?: string;
  title: string;
  section?: string;
  page_number?: number;
  content: string;
  content_hash: string;
  chunk_index: number;
  indexed_at: string;
}

// Retrieval results

export interface RetrievedChunk {
  id: string;
  score: number;
  payload: QdrantPayload;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  /** True if max score is below MIN_RELEVANCE_SCORE -- triggers abstention */
  shouldAbstain: boolean;
  maxScore: number;
}

// Citations

export interface Citation {
  title: string;
  url?: string;
  file_name?: string;
  page_number?: number;
  excerpt?: string;
}

// Generation result

export interface GenerationResult {
  answer: string;
  citations: Citation[];
  abstained: boolean;
  retrievalScore: number;
}

// Ingestion progress events (for SSE)

export type IngestionEventType =
  | "SCRAPE_STARTED"
  | "PAGE_FETCHED"
  | "PAGE_FAILED"
  | "SCRAPE_COMPLETE"
  | "INDEX_STARTED"
  | "CHUNK_INDEXED"
  | "INDEX_COMPLETE"
  | "ERROR";

export interface IngestionProgressEvent {
  type: IngestionEventType;
  sourceId: string;
  message: string;
  pagesDiscovered?: number;
  pagesIndexed?: number;
  pagesFailed?: number;
  chunksIndexed?: number;
  error?: string;
  timestamp: string;
}

// Knowledge base status (API response)

export interface KnowledgeBaseStatus {
  id: string;
  name: string;
  organizationId: string;
  sources: Array<{
    id: string;
    sourceType: SourceType;
    url?: string;
    fileName?: string;
    status: string;
    pagesDiscovered: number;
    pagesIndexed: number;
    pagesFailed: number;
    chunksIndexed: number;
    errorMessage?: string;
    lastSuccessfulScan?: string;
    indexedAt?: string;
  }>;
}
