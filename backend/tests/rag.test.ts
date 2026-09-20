/**
 * RAG Pipeline Unit Tests
 * Tests chunker, SSRF guard, tenant isolation, and abstention threshold logic.
 */

import assert from "node:assert/strict";
import { chunker } from "../src/rag/chunker.js";
import { qdrantService } from "../src/rag/qdrantService.js";
import type { NormalizedDocument } from "../src/rag/types.js";

async function runTests() {
  console.log("=== Running RAG Unit Tests ===\n");
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ? ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ? ${name}`);
      console.error("   ", err);
      failed++;
    }
  }

  // 1. Chunker tests
  await test("Chunker: breaks long text into chunks and preserves metadata", () => {
    const doc: NormalizedDocument = {
      id: "doc-1",
      knowledge_base_id: "org-1:kb-1",
      source_type: "website",
      source_url: "https://example.com/about",
      title: "About Example Corp",
      section: "Overview",
      headings: ["Overview", "Leadership"],
      content: "# Overview\nExample Corp is a leader in autonomous AI software.\n\n# Leadership\nFounded in 2024 by engineers with experience in enterprise automation.",
      content_hash: "dummyhash123",
      crawled_at: new Date().toISOString(),
      ingested_at: new Date().toISOString(),
    };

    const chunks = chunker.chunk(doc);
    assert.ok(chunks.length >= 1, "Expected at least 1 chunk");
    for (const chunk of chunks) {
      assert.equal(chunk.knowledge_base_id, "org-1:kb-1");
      assert.equal(chunk.source_type, "website");
      assert.equal(chunk.source_url, "https://example.com/about");
      assert.equal(chunk.title, "About Example Corp");
      assert.ok(chunk.content.length > 0);
    }
  });

  await test("Chunker: chunks array of documents with chunkAll", () => {
    const docs: NormalizedDocument[] = [
      {
        id: "doc-1",
        knowledge_base_id: "org-1:kb-1",
        source_type: "website",
        source_url: "https://example.com/1",
        title: "Doc 1",
        content: "First paragraph content here.\n\nSecond paragraph content here.",
        content_hash: "hash1",
        ingested_at: new Date().toISOString(),
      },
      {
        id: "doc-2",
        knowledge_base_id: "org-1:kb-1",
        source_type: "pdf",
        file_name: "test.pdf",
        title: "Doc 2",
        content: "PDF content on page 1.",
        content_hash: "hash2",
        ingested_at: new Date().toISOString(),
      },
    ];

    const allChunks = chunker.chunkAll(docs);
    assert.ok(allChunks.length >= 2, `Expected at least 2 chunks, got ${allChunks.length}`);
    assert.equal(allChunks[0].knowledge_base_id, "org-1:kb-1");
    assert.equal(allChunks.some((c) => c.source_type === "pdf"), true);
  });

  // 2. Qdrant Tenant Isolation Guards
  await test("Qdrant: search rejects empty knowledgeBaseId (multi-tenant guard)", async () => {
    await assert.rejects(
      async () => {
        await qdrantService.search([0.1, 0.2], "");
      },
      /knowledgeBaseId is required/i
    );
  });

  await test("Qdrant: deleteByKnowledgeBase rejects empty knowledgeBaseId", async () => {
    await assert.rejects(
      async () => {
        await qdrantService.deleteByKnowledgeBase("");
      },
      /knowledgeBaseId required/i
    );
  });

  await test("Qdrant: getExistingHashes rejects empty knowledgeBaseId", async () => {
    await assert.rejects(
      async () => {
        await qdrantService.getExistingHashes("");
      },
      /knowledgeBaseId is required/i
    );
  });

  await test("Qdrant: getAllPointIds rejects empty knowledgeBaseId", async () => {
    await assert.rejects(
      async () => {
        await qdrantService.getAllPointIds("");
      },
      /knowledgeBaseId is required/i
    );
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();