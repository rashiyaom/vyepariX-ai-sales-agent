import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { parse } from "csv-parse";
import { prisma } from "../config/database.js";
import { discoveryEngine } from "../services/discoveryEngine.js";
import { enrichmentService } from "../services/enrichmentEngine.js";
import { qualificationEngine } from "../services/qualificationEngine.js";
import { discoveryLimiter, uploadLimiter } from "../middleware/rateLimiter.js";
import { encrypt } from "../config/encryption.js";
import { z } from "zod";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/v1/leads/discover  — trigger autonomous discovery
router.post("/discover", discoveryLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await discoveryEngine.scheduleDiscovery(req.organizationId!);
    res.json({ message: "Discovery job enqueued", organizationId: req.organizationId });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/leads/upload  — CSV/Excel upload for "Calling Only" mode
router.post(
  "/upload",
  uploadLimiter,
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded. Send file as multipart/form-data field 'file'." });
        return;
      }

      const fileContent = req.file.buffer.toString("utf-8");
      let rows: Record<string, string>[] = [];

      if (req.file.originalname.endsWith(".csv")) {
        rows = await parseCsv(fileContent);
      } else if (req.file.originalname.match(/\.xlsx?$/)) {
        rows = await parseExcel(req.file.buffer);
      } else {
        res.status(400).json({ error: "Unsupported file type. Upload .csv or .xlsx" });
        return;
      }

      const created: string[] = [];
      for (const row of rows) {
        const phone = row["phone"] || row["Phone"] || row["PHONE"] || row["mobile"] || row["Mobile"] || "";
        const email = row["email"] || row["Email"] || row["EMAIL"] || "";
        const companyName = row["company"] || row["Company"] || row["company_name"] || row["CompanyName"] || "";
        const contactName = row["name"] || row["Name"] || row["contact_name"] || row["ContactName"] || "";

        if (!phone && !email) continue; // Skip rows with no contact info

        const lead = await prisma.lead.create({
          data: {
            organizationId: req.organizationId!,
            source: "UPLOADED",
            status: "NEW",
            companyName: companyName || null,
            contactName: contactName || null,
            phoneEncrypted: phone ? encrypt(phone) : null,
            emailEncrypted: email ? encrypt(email) : null,
            timezone: row["timezone"] || row["Timezone"] || null,
          },
        });
        created.push(lead.id);
      }

      // Trigger async enrichment for all uploaded leads
      Promise.all(
        created.map((id) =>
          enrichmentService.enrichLead(id).catch((e) =>
            console.warn(`[Upload] Enrichment failed for lead ${id}:`, e)
          )
        )
      );

      res.status(201).json({
        message: `${created.length} leads imported`,
        totalRows: rows.length,
        imported: created.length,
        leadIds: created,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/leads
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const source = typeof req.query.source === "string" ? req.query.source : undefined;

    const where = {
      organizationId: req.organizationId!,
      ...(status && { status: status as "NEW" }),
      ...(source && { source: source as "UPLOADED" }),
    };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: { qualification: true, opportunity: { select: { sourcePlatform: true, originalPostUrl: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    // Mask PII in response — never expose raw encrypted fields
    const sanitized = leads.map((l) => ({
      id: l.id,
      companyName: l.companyName,
      contactName: l.contactName,
      hasPhone: !!l.phoneEncrypted,
      hasEmail: !!l.emailEncrypted,
      timezone: l.timezone,
      status: l.status,
      source: l.source,
      qualification: l.qualification,
      opportunity: l.opportunity,
      createdAt: l.createdAt,
    }));

    res.json({ data: sanitized, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/leads/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leadId = typeof req.params.id === "string" ? req.params.id : "";
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId: req.organizationId! },
      include: {
        opportunity: true,
        enrichment: true,
        qualification: true,
        calls: { orderBy: { startedAt: "desc" }, take: 5 },
      },
    });
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    // Mask PII
    const { phoneEncrypted, emailEncrypted, ...safe } = lead;
    res.json({ ...safe, hasPhone: !!phoneEncrypted, hasEmail: !!emailEncrypted });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/leads/export
router.post("/export", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = z.object({ status: z.string().optional() }).parse(req.body);
    const leads = await prisma.lead.findMany({
      where: { organizationId: req.organizationId!, ...(status && { status: status as "NEW" }) },
      include: { qualification: true, opportunity: true },
      take: 5000,
    });

    // CSV export — PII excluded intentionally
    const header = "id,companyName,contactName,status,source,fitScore,intentScore,sourcePlatform,originalPostUrl,createdAt\n";
    const rows = leads.map((l) =>
      [
        l.id,
        `"${l.companyName ?? ""}"`,
        `"${l.contactName ?? ""}"`,
        l.status,
        l.source,
        l.qualification?.fitScore ?? "",
        l.qualification?.intentScore ?? "",
        l.opportunity?.sourcePlatform ?? "",
        l.opportunity?.originalPostUrl ?? "",
        l.createdAt.toISOString(),
      ].join(",")
    );

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=leads-export.csv");
    res.send(header + rows.join("\n"));
  } catch (err) {
    next(err);
  }
});

async function parseCsv(content: string): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    parse(content, { columns: true, skip_empty_lines: true }, (err, records) => {
      if (err) reject(err);
      else resolve(records as Record<string, string>[]);
    });
  });
}

async function parseExcel(buffer: Buffer): Promise<Record<string, string>[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
}

export default router;
