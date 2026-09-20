/**
 * RAG PDF Parser
 *
 * Extracts text from PDF files page by page using pdf-parse.
 * Detects scanned/image-only PDFs and flags them.
 */

import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import type { NormalizedDocument } from "./types.js";

// pdf-parse is CJS-only; use createRequire for ESM compatibility
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer, options?: object) => Promise<{
  text: string;
  numpages: number;
  info?: Record<string, unknown>;
}>;

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function inferSection(pageText: string): string | undefined {
  const lines = pageText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return undefined;
  const first = lines[0];
  if (first.length < 120 && first.length > 3) return first;
  return undefined;
}

function isLikelyScanned(text: string, pageCount: number): boolean {
  if (pageCount === 0) return false;
  return text.length / pageCount < 30;
}

export interface PdfParseConfig {
  knowledgeBaseId: string;
  fileName: string;
}

export const pdfParser = {
  async parse(
    buffer: Buffer,
    config: PdfParseConfig
  ): Promise<{ docs: NormalizedDocument[]; warnings: string[] }> {
    const { knowledgeBaseId, fileName } = config;
    const warnings: string[] = [];
    const docs: NormalizedDocument[] = [];
    const now = new Date().toISOString();

    let parsed: { text: string; numpages: number; info?: Record<string, unknown> };
    try {
      parsed = await pdfParse(buffer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`PDF parse failed for ${fileName}: ${msg}`);
      return { docs, warnings };
    }

    const totalPages = parsed.numpages;

    if (isLikelyScanned(parsed.text, totalPages)) {
      warnings.push(
        `${fileName} appears to be a scanned/image-only PDF (${totalPages} pages, ${parsed.text.length} chars). ` +
        `OCR pipeline not yet available in v1.`
      );
    }

    const pageTexts = parsed.text.split("\x0c");

    for (let i = 0; i < totalPages; i++) {
      const rawText = (pageTexts[i] ?? "").replace(/\s+/g, " ").trim();

      if (!rawText || rawText.length < 20) {
        warnings.push(`${fileName} page ${i + 1}: skipped (empty or < 20 chars)`);
        continue;
      }

      const section = inferSection(rawText);
      const contentHash = sha256(rawText);
      const pageNum = i + 1;

      docs.push({
        id: sha256(`${fileName}::page::${pageNum}`),
        knowledge_base_id: knowledgeBaseId,
        source_type: "pdf",
        file_name: fileName,
        title: `${fileName} — Page ${pageNum}`,
        section,
        page_number: pageNum,
        content: rawText,
        content_hash: contentHash,
        metadata: {
          totalPages,
          pdfInfo: parsed.info ?? {},
        },
        ingested_at: now,
      });
    }

    if (docs.length === 0 && warnings.length === 0) {
      warnings.push(`${fileName}: no extractable text found across ${totalPages} pages`);
    }

    return { docs, warnings };
  },
};
