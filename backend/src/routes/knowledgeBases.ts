import { onboardingSyncService } from "../rag/onboardingSync.js";
/**
 * Knowledge Base API Routes
 *
 * All routes are org-scoped via req.organizationId (set by authJwt middleware).
 * Registered under /api/v1/knowledge-bases in index.ts.
 */

import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { scraperAdapter } from "../rag/scraperAdapter.js";
import { pdfParser } from "../rag/pdfParser.js";
import { ingestionOrchestrator } from "../rag/ingestionOrchestrator.js";
import { qdrantService } from "../rag/qdrantService.js";
import { kbStore } from "../rag/kbStore.js";
import type { IngestionProgressEvent } from "../rag/types.js";

export const knowledgeBasesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf")
    ) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Only PDF is accepted.`));
    }
  },
});

function kbId(organizationId: string, id: string): string {
  return `${organizationId}:${id}`;
}

async function assertKbOwnership(kbPrismaId: string, organizationId: string): Promise<void> {
  const kb = await kbStore.getKB(kbPrismaId, organizationId);
  if (!kb) {
    throw Object.assign(new Error("Knowledge base not found"), { status: 404 });
  }
}

// POST / - Create knowledge base
knowledgeBasesRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId || "demo-org-id";
    const { name, description } = req.body as { name?: string; description?: string };
    if (!name?.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const kb = await kbStore.createKB({
      organizationId: orgId,
      name: name.trim(),
      description: description?.trim(),
    });
    res.status(201).json(kb);
  } catch (err) {
    next(err);
  }
});

// GET / - List knowledge bases
knowledgeBasesRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId || "demo-org-id";
    const kbs = await kbStore.listKBs(orgId);
    res.json(kbs);
  } catch (err) {
    next(err);
  }
});

// GET /:id/status
knowledgeBasesRouter.get("/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId || "demo-org-id";
    const id = String(req.params["id"]);
    const kb = await kbStore.getKB(id, orgId);
    if (!kb) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(kb);
  } catch (err) {
    next(err);
  }
});

// POST /:id/crawl - Add website source + stream progress via SSE
knowledgeBasesRouter.post("/:id/crawl", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId || "demo-org-id";
    const id = String(req.params["id"]);
    await assertKbOwnership(id, orgId);

    const { url } = req.body as { url?: string };
    if (!url?.trim()) {
      res.status(400).json({ error: "url is required" });
      return;
    }

    const targetUrl = url.trim();
    const compositeKbId = kbId(orgId, id);

    const source = await kbStore.createSource({
      knowledgeBaseId: id,
      sourceType: "website",
      url: targetUrl,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const sendEvent = (evt: IngestionProgressEvent) => {
      res.write(`data: ${JSON.stringify(evt)}\n\n`);
    };

    try {
      const docs = await scraperAdapter.adapt(targetUrl, {
        knowledgeBaseId: compositeKbId,
        onProgress: sendEvent,
      });

      await kbStore.updateSource(source.id, {
        pagesIndexed: docs.length,
        status: "scraping",
      });

      await ingestionOrchestrator.ingest(docs, {
        knowledgeBaseId: compositeKbId,
        kbSourceId: source.id,
        onProgress: sendEvent,
      });

      await kbStore.updateSource(source.id, {
        pagesIndexed: docs.length,
        status: "ready",
      });
      sendEvent({
        type: "INDEX_COMPLETE",
        sourceId: source.id,
        message: "Crawling and indexing complete",
        pagesIndexed: docs.length,
        timestamp: new Date().toISOString(),
      });
      res.end();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      sendEvent({
        type: "ERROR",
        sourceId: source.id,
        message: errMsg,
        timestamp: new Date().toISOString(),
      });
      await kbStore.updateSource(source.id, {
        status: "failed",
        errorMessage: errMsg,
      });
      res.end();
    }
  } catch (err) {
    next(err);
  }
});

// POST /:id/documents - Upload PDF
knowledgeBasesRouter.post(
  "/:id/documents",
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId || "demo-org-id";
      const id = String(req.params["id"]);
      await assertKbOwnership(id, orgId);

      if (!req.file) {
        res.status(400).json({ error: "No PDF file uploaded" });
        return;
      }

      const file = req.file;
      const compositeKbId = kbId(orgId, id);

      const source = await kbStore.createSource({
        knowledgeBaseId: id,
        sourceType: "pdf",
        fileName: file.originalname,
      });

      const { docs, warnings } = await pdfParser.parse(file.buffer, {
        knowledgeBaseId: compositeKbId,
        fileName: file.originalname,
      });

      await kbStore.updateSource(source.id, {
        pagesIndexed: docs.length,
        status: "indexing",
      });

      await ingestionOrchestrator.ingest(docs, {
        knowledgeBaseId: compositeKbId,
        kbSourceId: source.id,
      });

      res.json({ source, warnings, pagesIndexed: docs.length });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /:id/sources/:sourceId
knowledgeBasesRouter.delete(
  "/:id/sources/:sourceId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId || "demo-org-id";
      const id = String(req.params["id"]);
      const sourceId = String(req.params["sourceId"]);
      await assertKbOwnership(id, orgId);

      await kbStore.deleteSource(id, sourceId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /:id - Delete entire knowledge base
knowledgeBasesRouter.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.organizationId || "demo-org-id";
      const id = String(req.params["id"]);
      await assertKbOwnership(id, orgId);

      await kbStore.deleteKB(id, orgId);
      res.json({ success: true, message: "Knowledge base deleted" });
    } catch (err) {
      next(err);
    }
  }
);
// GET /onboarding-sources - Check if previous onboarding data exists (website URL, uploaded doc)
knowledgeBasesRouter.get("/onboarding-sources", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId || "demo-org-id";
    const sources = await onboardingSyncService.getOnboardingSources(orgId);
    if (!sources) {
      res.json({ available: false });
      return;
    }
    res.json({
      available: true,
      websiteUrl: sources.websiteUrl || null,
      documentFileName: sources.documentFileName || null,
      hasDocumentText: !!sources.documentText,
      scrapedPagesCount: sources.scrapedPages?.length || 0,
      companySummary: sources.companySummary || null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /sync-from-onboarding - Auto-import and index sources from previous onboarding
knowledgeBasesRouter.post("/sync-from-onboarding", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId || "demo-org-id";
    const { knowledgeBaseId, websiteUrl, documentText, documentFileName } = req.body as {
      knowledgeBaseId?: string;
      websiteUrl?: string;
      documentText?: string;
      documentFileName?: string;
    };

    if (websiteUrl || documentText) {
      onboardingSyncService.saveOnboardingSources({
        organizationId: orgId,
        websiteUrl,
        documentText,
        documentFileName,
      });
    }

    const result = await onboardingSyncService.syncToKnowledgeBase(orgId, knowledgeBaseId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});


// POST /quick-chat-url - Direct zero-click chat from any website URL (no manual workspace setup)
knowledgeBasesRouter.post("/quick-chat-url", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId || "demo-org-id";
    const { url } = req.body as { url?: string };
    if (!url?.trim()) {
      res.status(400).json({ error: "url is required" });
      return;
    }

    const cleanUrl = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
    const hostname = new URL(cleanUrl).hostname.replace(/^www\./, "");
    const friendlyName = (hostname.split(".")[0] || "Website").toUpperCase() + " AI Assistant";

    // 1. Check if an existing KB already has this URL with indexed chunks
    const existingKbs = await kbStore.listKBs(orgId);
    for (const kb of existingKbs) {
      const match = kb.sources.find((s) => s.url === cleanUrl || (s.url && new URL(s.url).hostname === hostname));
      if (match && match.chunksIndexed > 0) {
        res.json({
          success: true,
          knowledgeBase: kb,
          source: match,
          isNew: false,
          totalChunks: match.chunksIndexed,
        });
        return;
      }
    }

    // 2. Auto-create Knowledge Base for this URL
    const kb = await kbStore.createKB({
      organizationId: orgId,
      name: friendlyName,
      description: `Auto-indexed knowledge base for ${cleanUrl}`,
    });

    const compositeKbId = kbId(orgId, kb.id);
    const source = await kbStore.createSource({
      knowledgeBaseId: kb.id,
      sourceType: "website",
      url: cleanUrl,
    });

    // 3. Scrape and index all pages generated by websiteScraperService
    const docs = await scraperAdapter.adapt(cleanUrl, {
      knowledgeBaseId: compositeKbId,
    });

    await ingestionOrchestrator.ingest(docs, {
      knowledgeBaseId: compositeKbId,
      kbSourceId: source.id,
    });

    await kbStore.updateSource(source.id, {
      pagesIndexed: docs.length,
      status: "ready",
    });

    const updatedKb = await kbStore.getKB(kb.id, orgId);

    res.json({
      success: true,
      knowledgeBase: updatedKb || kb,
      source,
      isNew: true,
      pagesIndexed: docs.length,
      totalChunks: updatedKb?.sources.reduce((s, x) => s + x.chunksIndexed, 0) || 0,
    });
  } catch (err) {
    next(err);
  }
});

