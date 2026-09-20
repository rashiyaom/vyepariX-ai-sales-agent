import { prisma } from "../config/database.js";
import { groqClient } from "./groqClient.js";

interface QualificationResult {
  fitScore: number;        // 0–1
  intentScore: number;     // 0–1
  reachabilityScore: number; // 0–1
  reasoning: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

const QUALIFY_SYSTEM_PROMPT = `You are a B2B sales qualification specialist.
Given enrichment data about a lead and the organization's Ideal Customer Profile (ICP),
score the lead on three dimensions (0.0–1.0 each):

- fitScore: how well the company matches the ICP (industry, size, geography)
- intentScore: how strongly they are signaling purchase intent right now
- reachabilityScore: how easy it is to reach the right decision maker

Also provide a 1-2 sentence reasoning and assign priority (HIGH > 0.75 avg, MEDIUM > 0.5, else LOW).

Return ONLY valid JSON:
{
  "fitScore": number,
  "intentScore": number, 
  "reachabilityScore": number,
  "reasoning": string,
  "priority": "HIGH" | "MEDIUM" | "LOW"
}`;

export const qualificationEngine = {
  async qualifyLead(leadId: string): Promise<QualificationResult> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        enrichment: true,
        opportunity: true,
        organization: { include: { businessProfile: true } },
      },
    });

    if (!lead) throw new Error(`Lead ${leadId} not found`);
    if (!lead.organization.businessProfile) {
      throw new Error(`No BusinessProfile for org ${lead.organizationId} — run /business-profile/enrich first`);
    }

    const context = JSON.stringify({
      lead: {
        company: lead.companyName,
        contact: lead.contactName,
        source: lead.opportunity?.sourcePlatform,
        postText: lead.opportunity?.postText,
        keywords: lead.opportunity?.matchedKeywords,
      },
      enrichment: lead.enrichment?.fields ?? {},
      icp: lead.organization.businessProfile.icp,
      services: lead.organization.businessProfile.derivedServices,
    });

    const result = await groqClient.getJsonCompletion<QualificationResult>({
      model: "llama-3.3-70b-versatile",
      systemPrompt: QUALIFY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Qualify this lead:\n${context}` }],
      maxTokens: 512,
    });

    // Clamp scores to [0, 1]
    result.fitScore = Math.min(1, Math.max(0, result.fitScore));
    result.intentScore = Math.min(1, Math.max(0, result.intentScore));
    result.reachabilityScore = Math.min(1, Math.max(0, result.reachabilityScore));

    // Derive priority if LLM didn't return it correctly
    const avg = (result.fitScore + result.intentScore + result.reachabilityScore) / 3;
    if (!["HIGH", "MEDIUM", "LOW"].includes(result.priority)) {
      result.priority = avg > 0.75 ? "HIGH" : avg > 0.5 ? "MEDIUM" : "LOW";
    }

    await prisma.qualificationScore.upsert({
      where: { leadId },
      create: { leadId, ...result },
      update: result,
    });

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "QUALIFIED" },
    });

    return result;
  },
};
