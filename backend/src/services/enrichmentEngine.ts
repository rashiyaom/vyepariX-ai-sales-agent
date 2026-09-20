import { prisma } from "../config/database.js";
import { groqClient } from "./groqClient.js";
import { encrypt, decrypt } from "../config/encryption.js";

interface EnrichmentFields {
  companySize?: number;
  industry?: string;
  techStack?: string[];
  funding?: string;
  socialLinks?: Record<string, string>;
  website?: string;
  linkedinUrl?: string;
  jobTitle?: string;
  department?: string;
  location?: string;
  revenue?: string;
}

const ENRICH_SYSTEM_PROMPT = `You are a B2B data enrichment specialist.
Given a prospect's company name, contact name, source post, and any available context, 
extract structured firmographic and contact information.

Return ONLY valid JSON:
{
  "companySize": number | null,
  "industry": string | null,
  "techStack": string[],
  "funding": string | null,
  "socialLinks": { "linkedin": string, "twitter": string },
  "website": string | null,
  "jobTitle": string | null,
  "department": string | null,
  "location": string | null,
  "revenue": string | null
}`;

export const enrichmentService = {
  async enrichLead(leadId: string): Promise<void> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { opportunity: true },
    });
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    // Decrypt PII for analysis (never persisted unencrypted)
    const email = lead.emailEncrypted ? decrypt(lead.emailEncrypted) : null;
    const phone = lead.phoneEncrypted ? decrypt(lead.phoneEncrypted) : null;

    const context = [
      lead.companyName && `Company: ${lead.companyName}`,
      lead.contactName && `Contact: ${lead.contactName}`,
      email && `Email: ${email}`,
      phone && `Phone: ${phone}`,
      lead.opportunity?.postText && `Source Post: ${lead.opportunity.postText}`,
      lead.opportunity?.sourcePlatform && `Platform: ${lead.opportunity.sourcePlatform}`,
    ]
      .filter(Boolean)
      .join("\n");

    let enriched: EnrichmentFields = {};
    let dataSource = "groq-llama-inference";
    let confidenceScore = 0.6;

    // Try Apollo.io first if available
    if (process.env.APOLLO_API_KEY && lead.companyName) {
      const apolloResult = await tryApolloEnrich(lead.companyName, lead.contactName);
      if (apolloResult) {
        enriched = apolloResult;
        dataSource = "apollo.io";
        confidenceScore = 0.92;
      }
    }

    // Fall back to Groq inference
    if (!Object.keys(enriched).length) {
      try {
        enriched = await groqClient.getJsonCompletion<EnrichmentFields>({
          model: "llama-3.3-70b-versatile",
          systemPrompt: ENRICH_SYSTEM_PROMPT,
          messages: [{ role: "user", content: `Enrich this prospect:\n${context}` }],
          maxTokens: 1024,
        });
        dataSource = "groq-llama-inference";
        confidenceScore = 0.55;
      } catch (err) {
        console.warn("[Enrichment] Groq inference failed:", err);
        enriched = {};
        confidenceScore = 0;
      }
    }

    await prisma.enrichmentData.upsert({
      where: { leadId },
      create: {
        leadId,
        fields: enriched as object,
        dataSource,
        confidenceScore,
      },
      update: {
        fields: enriched as object,
        dataSource,
        confidenceScore,
      },
    });

    // Advance lead status
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "ENRICHED" },
    });
  },
};

async function tryApolloEnrich(
  companyName: string,
  contactName?: string | null
): Promise<EnrichmentFields | null> {
  try {
    const { default: fetch } = await import("node-fetch");
    const body: Record<string, string> = { organization_name: companyName };
    if (contactName) {
      const [firstName, ...rest] = contactName.split(" ");
      body.first_name = firstName ?? "";
      body.last_name = rest.join(" ");
    }
    const res = await fetch("https://api.apollo.io/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.APOLLO_API_KEY!,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      person?: {
        organization?: { num_employees: number; industry: string; estimated_num_employees: number };
        title?: string;
        department?: string;
        city?: string;
        country?: string;
        linkedin_url?: string;
      };
    };
    if (!data.person) return null;
    const org = data.person.organization;
    return {
      companySize: org?.num_employees ?? org?.estimated_num_employees,
      industry: org?.industry,
      jobTitle: data.person.title,
      department: data.person.department,
      location: [data.person.city, data.person.country].filter(Boolean).join(", "),
      linkedinUrl: data.person.linkedin_url,
      socialLinks: data.person.linkedin_url ? { linkedin: data.person.linkedin_url, twitter: "" } : {},
    };
  } catch {
    return null;
  }
}
