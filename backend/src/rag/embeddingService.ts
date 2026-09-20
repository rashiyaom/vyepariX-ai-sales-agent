/**
 * RAG Embedding Service
 *
 * Uses @xenova/transformers (Transformers.js) — fully in-Node WASM/ONNX.
 * Default: Xenova/all-MiniLM-L6-v2 (384-dim).
 */

import type { Chunk } from "./types.js";

// Lazy pipeline
type FeaturePipeline = (input: string | string[], options?: Record<string, unknown>) => Promise<any>;
let pipeline: FeaturePipeline | null = null;

const MODEL_NAME = process.env.EMBEDDING_MODEL ?? "Xenova/all-MiniLM-L6-v2";
const BATCH_SIZE = 32;

async function getPipeline(): Promise<FeaturePipeline> {
  if (pipeline) return pipeline;
  const { pipeline: loadPipeline } = await import("@xenova/transformers");
  
  pipeline = await loadPipeline("feature-extraction", MODEL_NAME, { quantized: true });
  console.log(`[EmbeddingService] Loaded model: ${MODEL_NAME}`);
  return pipeline!;
}

function l2Normalize(vec: Float32Array): number[] {
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm === 0) return Array.from(vec);
  return Array.from(vec).map((v) => v / norm);
}

function extractVector(output: { data: Float32Array } | Array<{ data: Float32Array }>): Float32Array {
  if (Array.isArray(output)) {
    const first = output[0];
    return first?.data instanceof Float32Array ? first.data : new Float32Array(first?.data ?? []);
  }
  return output.data instanceof Float32Array ? output.data : new Float32Array(output.data);
}

export const embeddingService = {
  modelName: MODEL_NAME,

  async embedQuery(text: string): Promise<number[]> {
    const pipe = await getPipeline();
    const output = await pipe(text, { pooling: "mean", normalize: true });
    const vec = extractVector(output as { data: Float32Array } | Array<{ data: Float32Array }>);
    return l2Normalize(vec);
  },

  async embedChunks(chunks: Chunk[]): Promise<number[][]> {
    if (chunks.length === 0) return [];
    const pipe = await getPipeline();
    const vectors: number[][] = [];
    const dim = 384;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map((c) => c.content);

            const output = await pipe(texts, { pooling: "mean", normalize: true });
      const data: Float32Array = output.data instanceof Float32Array ? output.data : new Float32Array(output.data);

      for (let b = 0; b < batch.length; b++) {
        const slice = data.slice(b * dim, (b + 1) * dim);
        vectors.push(l2Normalize(slice));
      }

      console.log(`[EmbeddingService] Embedded batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} (${batch.length} chunks)`);
    }

    return vectors;
  },

  async warmup(): Promise<void> {
    try {
      await this.embedQuery("warmup");
      console.log(`[EmbeddingService] Model warmed up: ${MODEL_NAME}`);
    } catch (err) {
      console.warn("[EmbeddingService] Warmup failed (non-fatal):", err);
    }
  },
};
