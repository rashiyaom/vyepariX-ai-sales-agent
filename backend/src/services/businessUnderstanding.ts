import { prisma } from "../config/database.js";
import { groqClient } from "./groqClient.js";

interface DerivedServices {
  name: string;
  description: string;
  targetUseCase: string;
}

interface DerivedICP {
  industries: string[];
  companySizeRange: { min: number; max: number };
  geographies: string[];
  buyingSignalKeywords: string[];
  decisionMakerTitles: string[];
}

interface BusinessProfileResult {
  derivedServices: DerivedServices[];
  icp: DerivedICP;
  keywords: string[];
}

const SYSTEM_PROMPT = `You are an expert B2B sales intelligence analyst.
Given a company's website URL, description, or documentation text, extract:
1. A list of services/products the company offers (with name, description, target use case)
2. The Ideal Customer Profile (ICP): industries, company size range, geographies, buying signal keywords, decision maker titles
3. A flat list of high-intent buyer search keywords

Return ONLY valid JSON matching this exact structure:
{
  "derivedServices": [{ "name": string, "description": string, "targetUseCase": string }],
  "icp": {
    "industries": string[],
    "companySizeRange": { "min": number, "max": number },
    "geographies": string[],
    "buyingSignalKeywords": string[],
    "decisionMakerTitles": string[]
  },
  "keywords": string[]
}`;

async function crawlUrl(url: string): Promise<string> {
  try {
    const { default: fetch } = await import("node-fetch");
    const res = await fetch(url, {
      headers: { "User-Agent": "VyapariX-BusinessAnalyzer/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();
    // Simple text extraction — strip HTML tags
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000); // Limit to ~6k chars to keep token cost manageable
  } catch (err) {
    console.warn("[BusinessUnderstanding] Failed to crawl URL:", err);
    return "";
  }
}

export const businessUnderstandingService = {
  async analyze(
    organizationId: string,
    opts: { url?: string; description?: string; docText?: string }
  ): Promise<BusinessProfileResult> {
    let inputText = "";

    if (opts.url) {
      const crawled = await crawlUrl(opts.url);
      if (crawled) inputText += `\n\n[Website Content from ${opts.url}]:\n${crawled}`;
    }
    if (opts.description) inputText += `\n\n[User-Provided Description]:\n${opts.description}`;
    if (opts.docText) inputText += `\n\n[Uploaded Document]:\n${opts.docText.slice(0, 4000)}`;

    if (!inputText.trim()) {
      throw new Error("At least one of url, description, or docText must be provided");
    }

    const result = await groqClient.getJsonCompletion<BusinessProfileResult>({
      model: "llama-3.3-70b-versatile",
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Analyze this company:\n${inputText}` }],
      maxTokens: 2048,
    });

    // Persist to BusinessProfile (upsert — allow re-running)
    await prisma.businessProfile.upsert({
      where: { organizationId },
      create: {
        organizationId,
        sourceUrl: opts.url,
        description: opts.description,
        userDescription: opts.description,
        coreServices: result.derivedServices as object,
        derivedServices: result.derivedServices as object,
        industries: result.icp.industries,
        icp: result.icp as object,
        keywords: result.keywords,
      },
      update: {
        sourceUrl: opts.url,
        description: opts.description,
        userDescription: opts.description,
        coreServices: result.derivedServices as object,
        derivedServices: result.derivedServices as object,
        industries: result.icp.industries,
        icp: result.icp as object,
        keywords: result.keywords,
      },
    });

    return result;
  },

  async getProfile(organizationId: string) {
    return prisma.businessProfile.findUnique({ where: { organizationId } });
  },

  async updateProfile(
    organizationId: string,
    overrides: Partial<{ derivedServices: object; icp: object; keywords: string[] }>
  ) {
    return prisma.businessProfile.update({
      where: { organizationId },
      data: overrides,
    });
  },
};
