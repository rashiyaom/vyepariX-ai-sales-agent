import { kbStore } from "../rag/kbStore.js";
﻿/**
 * Chat API Routes
 *
 * POST /api/v1/chat
 *   Body: { message, conversationId?, knowledgeBaseId }
 *   Streams SSE tokens, then citations, then done event.
 *   Persists ChatConversation + ChatMessage after stream completes.
 *
 * GET /api/v1/chat/:conversationId
 *   Returns full conversation history.
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { prisma } from "../config/database.js";
import { retrievalService } from "../rag/retrievalService.js";
import { generationService } from "../rag/generationService.js";

export const chatRouter = Router();

// ─── POST /chat ───────────────────────────────────────────────────────────────

chatRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId as string;
    const { message, conversationId, knowledgeBaseId } = req.body as {
      message?: string;
      conversationId?: string;
      knowledgeBaseId?: string;
    };

    if (!message?.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }
    if (!knowledgeBaseId?.trim()) {
      res.status(400).json({ error: "knowledgeBaseId is required" });
      return;
    }

    // Verify KB belongs to this org
    const kb = await kbStore.getKB(knowledgeBaseId, orgId);
    if (!kb) {
      res.status(404).json({ error: "Knowledge base not found" });
      return;
    }

    let history: Array<{ role: "user" | "assistant"; content: string }> = [];
    let convId = conversationId || "conv_" + Date.now();

    try {
      if (conversationId) {
        const conv = await prisma.chatConversation.findFirst({
          where: { id: conversationId, organizationId: orgId },
          include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
        });
        if (conv) {
          history = conv.messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));
        }
      } else {
        const created = await prisma.chatConversation.create({
          data: { organizationId: orgId, knowledgeBaseId },
        });
        convId = created.id;
      }
      await prisma.chatMessage.create({
        data: {
          conversationId: convId,
          role: "user",
          content: message.trim(),
        },
      });
    } catch {
      // In-memory / stateless fallback if DB offline
    }

    // Resolve follow-up questions using conversation context
    const compositeKbId = `${orgId}:${knowledgeBaseId}`;
    const resolvedQuery = retrievalService.resolveFollowUp(message.trim(), history);

    // Retrieve relevant chunks
    const retrieval = await retrievalService.retrieve(resolvedQuery, compositeKbId);

    // Stream the grounded answer
    const { answer, citations, abstained, retrievalScore } =
      await generationService.generateStream(
        message.trim(),
        retrieval.chunks,
        history,
        res
      );

    // Persist assistant message (best-effort after stream)
    try {
      await prisma.chatMessage.create({
        data: {
          conversationId: convId,
          role: "assistant",
          content: answer,
          citations: citations as object,
          retrievalScore,
          abstained,
        },
      });
    } catch (persistErr) {
      console.error("[ChatRoute] Failed to persist assistant message:", persistErr);
    }
  } catch (err) {
    next(err);
  }
});

// ─── GET /chat/:conversationId ────────────────────────────────────────────────

chatRouter.get("/:conversationId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId as string;
    const conversation = await prisma.chatConversation.findFirst({
      where: { id: String(req.params["conversationId"]), organizationId: orgId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        knowledgeBase: { select: { name: true, id: true } },
      },
    });
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.json(conversation);
  } catch (err) {
    next(err);
  }
});


