import { prisma } from "../config/database.js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface MemorySource {
  id: string;
  knowledgeBaseId: string;
  sourceType: "website" | "pdf";
  url?: string | null;
  fileName?: string | null;
  status: string;
  pagesIndexed: number;
  chunksIndexed: number;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryKB {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  embeddingModel: string;
  createdAt: Date;
  updatedAt: Date;
  sources: MemorySource[];
}

const DATA_FILE = path.join(process.cwd(), ".data", "kb_store.json");

function loadFromDisk(): Map<string, MemoryKB> {
  const store = new Map<string, MemoryKB>();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const kb of list) {
          kb.createdAt = new Date(kb.createdAt);
          kb.updatedAt = new Date(kb.updatedAt);
          if (Array.isArray(kb.sources)) {
            for (const s of kb.sources) {
              s.createdAt = new Date(s.createdAt);
              s.updatedAt = new Date(s.updatedAt);
            }
          }
          store.set(kb.id, kb);
        }
      }
    }
  } catch (err) {
    console.warn("[kbStore] Error loading from disk:", (err as Error).message);
  }
  return store;
}

const memoryStore = loadFromDisk();

function saveToDisk() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const list = Array.from(memoryStore.values());
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.warn("[kbStore] Error saving to disk:", (err as Error).message);
  }
}

export const kbStore = {
  async createKB(data: { organizationId: string; name: string; description?: string }): Promise<MemoryKB> {
    try {
      const kb = await prisma.knowledgeBase.create({
        data: {
          organizationId: data.organizationId,
          name: data.name,
          description: data.description,
        },
        include: { sources: true },
      });
      return kb as unknown as MemoryKB;
    } catch (err) {
      console.warn("[kbStore] DB unreachable, falling back to memory store:", (err as Error).message);
      const newKb: MemoryKB = {
        id: "kb_" + crypto.randomUUID().slice(0, 8),
        organizationId: data.organizationId,
        name: data.name,
        description: data.description,
        embeddingModel: process.env.EMBEDDING_MODEL ?? "Xenova/all-MiniLM-L6-v2",
        createdAt: new Date(),
        updatedAt: new Date(),
        sources: [],
      };
      memoryStore.set(newKb.id, newKb);
      saveToDisk();
      return newKb;
    }
  },

  async listKBs(organizationId: string): Promise<MemoryKB[]> {
    try {
      const kbs = await prisma.knowledgeBase.findMany({
        where: { organizationId },
        include: { sources: true },
        orderBy: { createdAt: "desc" },
      });
      return kbs as unknown as MemoryKB[];
    } catch (err) {
      return Array.from(memoryStore.values())
        .filter((k) => k.organizationId === organizationId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
  },

  async getKB(id: string, organizationId: string): Promise<MemoryKB | null> {
    try {
      const kb = await prisma.knowledgeBase.findFirst({
        where: { id, organizationId },
        include: { sources: true },
      });
      if (kb) return kb as unknown as MemoryKB;
    } catch {
      // Fallback
    }
    const mem = memoryStore.get(id);
    if (mem && mem.organizationId === organizationId) return mem;
    return null;
  },

  async createSource(data: {
    knowledgeBaseId: string;
    sourceType: "website" | "pdf";
    url?: string | null;
    fileName?: string | null;
  }): Promise<MemorySource> {
    try {
      const src = await prisma.kBSource.create({
        data: {
          knowledgeBaseId: data.knowledgeBaseId,
          sourceType: data.sourceType,
          url: data.url,
          fileName: data.fileName,
          status: "indexing",
        },
      });
      return src as unknown as MemorySource;
    } catch (err) {
      console.warn("[kbStore] DB unreachable, adding source to memory store");
      const newSrc: MemorySource = {
        id: "src_" + crypto.randomUUID().slice(0, 8),
        knowledgeBaseId: data.knowledgeBaseId,
        sourceType: data.sourceType,
        url: data.url,
        fileName: data.fileName,
        status: "indexing",
        pagesIndexed: 0,
        chunksIndexed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const kb = memoryStore.get(data.knowledgeBaseId);
      if (kb) {
        kb.sources.push(newSrc);
        saveToDisk();
      }
      return newSrc;
    }
  },

  async updateSource(id: string, data: Partial<MemorySource>): Promise<void> {
    try {
      await prisma.kBSource.update({
        where: { id },
        data: {
          status: data.status,
          pagesIndexed: data.pagesIndexed,
          chunksIndexed: data.chunksIndexed,
          errorMessage: data.errorMessage,
        },
      });
    } catch {
      // Memory store update
      for (const kb of memoryStore.values()) {
        const src = kb.sources.find((s) => s.id === id);
        if (src) {
          Object.assign(src, data, { updatedAt: new Date() });
          saveToDisk();
          break;
        }
      }
    }
  },

  async deleteSource(knowledgeBaseId: string, sourceId: string): Promise<void> {
    try {
      await prisma.kBSource.delete({ where: { id: sourceId } });
    } catch {
      const kb = memoryStore.get(knowledgeBaseId);
      if (kb) {
        kb.sources = kb.sources.filter((s) => s.id !== sourceId);
        saveToDisk();
      }
    }
  },

  async deleteKB(id: string, organizationId: string): Promise<void> {
    try {
      await prisma.knowledgeBase.delete({ where: { id } });
    } catch {
      const kb = memoryStore.get(id);
      if (kb && kb.organizationId === organizationId) {
        memoryStore.delete(id);
        saveToDisk();
      }
    }
  },
};
