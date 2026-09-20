import { onboardingSyncService } from "../rag/onboardingSync.js";
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import * as XLSX from "xlsx";
// @ts-ignore
import { PDFParse } from "pdf-parse";
// @ts-ignore
import mammoth from "mammoth";
import { prisma } from "../config/database.js";
import { onboardingJobService } from "../services/onboardingJobService.js";
import { businessUnderstandingService } from "../services/businessUnderstanding.js";
import { z } from "zod";

const router = Router();
const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

async function extractTextFromFile(buffer: Buffer, originalName: string, mimeType?: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();

  // 1. Plain text formats
  if ([".txt", ".md", ".markdown", ".json", ".csv", ".tsv", ".rtf", ".log"].includes(ext) || mimeType?.startsWith("text/")) {
    return buffer.toString("utf-8");
  }

  // 2. Spreadsheets (Excel)
  if ([".xlsx", ".xls"].includes(ext)) {
    try {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetsText: string[] = [];
      for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name];
        if (sheet) {
          const csv = XLSX.utils.sheet_to_csv(sheet);
          if (csv.trim()) {
            sheetsText.push(`[Sheet: ${name}]\n${csv}`);
          }
        }
      }
      return sheetsText.join("\n\n");
    } catch (err) {
      console.warn("XLSX parsing failed:", err);
    }
  }

  // 3. Word documents (.docx)
  if (ext === ".docx") {
    try {
      const res = await mammoth.extractRawText({ buffer });
      if (res && res.value) {
        return res.value;
      }
    } catch (err) {
      console.warn("Mammoth docx parsing failed:", err);
    }
  }

  // 4. PDF files (.pdf)
  if (ext === ".pdf") {
    try {
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      const text = typeof textResult === "string" ? textResult : (textResult as any)?.text || "";
      if (text && text.trim().length > 0) {
        return text;
      }
    } catch (err) {
      console.warn("PDFParse failed, attempting stream match:", err);
    }
  }

  // 5. Fallback printable characters extraction for binary / slides / RTF
  try {
    const raw = buffer.toString("binary");
    const matches = raw.match(/[\x20-\x7E\t\n\r]{4,}/g);
    if (matches && matches.length > 0) {
      return matches.join(" ");
    }
  } catch (rawErr) {
    console.warn("Raw string fallback failed:", rawErr);
  }

  return buffer.toString("utf-8");
}

function cleanExtractedText(text: string): string {
  return text
    .replace(/\0/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// POST /api/v1/business-profile/upload-doc (Pitch deck / Brochure / Collateral upload & parsing)
router.post("/upload-doc", docUpload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded. Please include a 'file' field in multipart/form-data." });
      return;
    }

    const originalName = file.originalname || "document";
    const ext = path.extname(originalName).toLowerCase();
    const sizeBytes = file.size;

    const rawText = await extractTextFromFile(file.buffer, originalName, file.mimetype);
    const cleaned = cleanExtractedText(rawText);

    if (!cleaned || cleaned.length < 5) {
      res.status(422).json({
        error: "Unable to extract readable text from the document. Please ensure the document contains text or paste its content manually.",
      });
      return;
    }

    const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
    try {
      onboardingSyncService.saveOnboardingSources({
        organizationId: req.organizationId || "demo-org-id",
        documentText: cleaned,
        documentFileName: originalName,
      });
    } catch {}

    res.json({
      success: true,
      filename: originalName,
      fileType: ext.replace(".", "") || "txt",
      sizeBytes,
      sizeFormatted: formatBytes(sizeBytes),
      charCount: cleaned.length,
      wordCount,
      extractedText: cleaned,
      preview: cleaned.slice(0, 320) + (cleaned.length > 320 ? "..." : ""),
    });
  } catch (err) {
    next(err);
  }
});

const EnrichInputSchema = z
  .object({
    url: z.string().url().optional().or(z.literal("")),
    description: z.string().optional().or(z.literal("")),
    documentText: z.string().optional().or(z.literal("")),
    docText: z.string().optional().or(z.literal("")), // alias
    linkedinUrl: z.string().url().optional().or(z.literal("")),
  })
  .refine((d) => (d.url && d.url.trim()) || (d.description && d.description.trim()) || (d.documentText && d.documentText.trim()) || (d.docText && d.docText.trim()), {
    message: "At least one of URL, business description, or document content is required",
  });

const PatchDraftSchema = z.object({
  companySummary: z.string().optional(),
  coreServices: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        targetUseCase: z.string().optional(),
      })
    )
    .optional(),
  industries: z.array(z.string()).optional(),
  icp: z
    .object({
      targetCompanySize: z.any().optional(),
      targetIndustries: z.array(z.string()).optional(),
      targetGeography: z.array(z.string()).optional(),
      buyingSignalKeywords: z.array(z.string()).optional(),
      decisionMakerTitles: z.array(z.string()).optional(),
    })
    .optional(),
  keywords: z.array(z.string()).optional(),
  differentiators: z.array(z.string()).optional(),
});

const RerunSchema = z.object({
  correctiveInput: z.string().optional(),
  url: z.string().url().optional().or(z.literal("")),
  description: z.string().optional(),
  documentText: z.string().optional(),
  linkedinUrl: z.string().optional(),
});

// POST /api/v1/business-profile/enrich (Step 1 trigger — returns { jobId } immediately)
router.post("/enrich", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = EnrichInputSchema.parse(req.body);
    const orgId = req.organizationId!;

    try {
      onboardingSyncService.saveOnboardingSources({
        organizationId: orgId,
        websiteUrl: input.url?.trim() || undefined,
        documentText: (input.documentText || input.docText)?.trim() || undefined,
      });
    } catch {}
    const jobId = onboardingJobService.startEnrichmentJob(orgId, {
      url: input.url?.trim() || undefined,
      description: input.description?.trim() || undefined,
      documentText: (input.documentText || input.docText)?.trim() || undefined,
      linkedinUrl: input.linkedinUrl?.trim() || undefined,
    });

    res.status(202).json({
      jobId,
      status: "queued",
      message: "Enrichment and business understanding job started asynchronously",
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/business-profile/status/:jobId (Polling fallback if WebSocket is unavailable)
router.get("/status/:jobId", (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = typeof req.params.jobId === "string" ? req.params.jobId : "";
    const job = onboardingJobService.getJob(jobId);
    if (!job) {
      res.status(404).json({ error: `No job found with ID ${jobId}` });
      return;
    }
    res.json(job);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/business-profile/draft (Step 7: fetch draft for review & editing)
router.get("/draft", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const profile = await prisma.businessProfile.findUnique({
      where: { organizationId: orgId },
    });

    if (!profile) {
      res.status(404).json({ error: "No profile draft found for this organization" });
      return;
    }

    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/business-profile/draft (Step 7: inline human edits before confirmation)
router.patch("/draft", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const updates = PatchDraftSchema.parse(req.body);

    const updated = await prisma.businessProfile.update({
      where: { organizationId: orgId },
      data: {
        companySummary: updates.companySummary,
        coreServices: updates.coreServices as unknown as object,
        derivedServices: updates.coreServices as unknown as object, // backwards compatibility
        industries: updates.industries,
        icp: updates.icp as unknown as object,
        keywords: updates.keywords,
        differentiators: updates.differentiators,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/business-profile/confirm (Step 8: locks status = CONFIRMED)
router.post("/confirm", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const confirmed = await prisma.businessProfile.update({
      where: { organizationId: orgId },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: "Business Profile confirmed and locked for autonomous pipeline",
      profile: confirmed,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/business-profile/rerun (Re-run derivation with corrective prompt from settings/wizard)
router.post("/rerun", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const input = RerunSchema.parse(req.body);

    const currentProfile = await prisma.businessProfile.findUnique({
      where: { organizationId: orgId },
    });

    const description = [
      input.description || currentProfile?.userDescription || currentProfile?.description || "",
      input.correctiveInput ? `User Correction: ${input.correctiveInput}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const jobId = onboardingJobService.startEnrichmentJob(orgId, {
      url: input.url || currentProfile?.sourceUrl || undefined,
      description: description || undefined,
      documentText: input.documentText || undefined,
      linkedinUrl: input.linkedinUrl || currentProfile?.linkedinUrl || undefined,
    });

    res.status(202).json({
      jobId,
      status: "queued",
      message: "Re-run enrichment job initiated with corrections",
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/business-profile (General current profile getter)
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.businessProfile.findUnique({
      where: { organizationId: req.organizationId! },
    });
    if (!profile) {
      res.status(404).json({ error: "No business profile found. Run POST /enrich first." });
      return;
    }
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/business-profile/validate-products (Legacy override backwards compatibility)
router.post("/validate-products", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await businessUnderstandingService.updateProfile(req.organizationId!, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
