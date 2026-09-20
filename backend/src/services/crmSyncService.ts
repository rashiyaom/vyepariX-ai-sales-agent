import { prisma } from "../config/database.js";

interface CRMContact {
  id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
}

export const crmSyncService = {
  async connect(organizationId: string, provider: "hubspot" | "salesforce" | "zoho", credentials: object) {
    return prisma.cRMConnection.upsert({
      where: { id: `${organizationId}-${provider}` },
      create: { organizationId, provider, credentials },
      update: { credentials },
    });
  },

  async syncInterestedLeads(organizationId: string): Promise<{ synced: number; errors: number }> {
    const connection = await prisma.cRMConnection.findFirst({ where: { organizationId } });
    if (!connection) return { synced: 0, errors: 0 };

    const interestedLeads = await prisma.lead.findMany({
      where: { organizationId, status: { in: ["INTERESTED", "CONVERTED"] } },
      include: { calls: { orderBy: { startedAt: "desc" }, take: 1 } },
    });

    let synced = 0;
    let errors = 0;

    for (const lead of interestedLeads) {
      try {
        if (connection.provider === "hubspot") {
          await pushToHubspot(lead, connection.credentials as Record<string, string>);
        } else if (connection.provider === "salesforce") {
          await pushToSalesforce(lead, connection.credentials as Record<string, string>);
        }
        synced++;
      } catch (err) {
        console.error(`[CRMSync] Failed to sync lead ${lead.id}:`, err);
        errors++;
      }
    }

    await prisma.cRMConnection.update({
      where: { id: connection.id },
      data: { lastSyncedAt: new Date() },
    });

    return { synced, errors };
  },
};

async function pushToHubspot(lead: { companyName?: string | null; contactName?: string | null }, creds: Record<string, string>): Promise<void> {
  const { default: fetch } = await import("node-fetch");
  const accessToken = creds.accessToken;
  if (!accessToken) throw new Error("HubSpot accessToken missing from credentials");

  const [firstName, ...rest] = (lead.contactName ?? "").split(" ");
  await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      properties: {
        firstname: firstName,
        lastname: rest.join(" "),
        company: lead.companyName,
        hs_lead_status: "IN_PROGRESS",
      },
    }),
    signal: AbortSignal.timeout(5000),
  });
}

async function pushToSalesforce(lead: { companyName?: string | null; contactName?: string | null }, creds: Record<string, string>): Promise<void> {
  const { default: fetch } = await import("node-fetch");
  const { instanceUrl, accessToken } = creds;
  if (!instanceUrl || !accessToken) throw new Error("Salesforce credentials missing");

  const [firstName, ...rest] = (lead.contactName ?? "").split(" ");
  await fetch(`${instanceUrl}/services/data/v57.0/sobjects/Lead`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      FirstName: firstName,
      LastName: rest.join(" ") || "Unknown",
      Company: lead.companyName || "Unknown",
      Status: "Working - Contacted",
      LeadSource: "VYAPERI X",
    }),
    signal: AbortSignal.timeout(5000),
  });
}
