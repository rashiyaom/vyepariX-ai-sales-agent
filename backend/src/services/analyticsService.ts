import { prisma } from "../config/database.js";

export const analyticsService = {
  async getInsights(organizationId: string) {
    const [
      totalLeads,
      leadsByStatus,
      campaignStats,
      callStats,
      sentimentDist,
      topCampaigns,
    ] = await Promise.all([
      // Total leads
      prisma.lead.count({ where: { organizationId } }),

      // Leads by status (funnel)
      prisma.lead.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: { id: true },
      }),

      // Campaign aggregate stats
      prisma.campaign.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: { id: true },
      }),

      // Call stats
      prisma.call.aggregate({
        where: { campaign: { organizationId } },
        _count: { id: true },
        _avg: {},
      }),

      // Sentiment distribution
      prisma.call.groupBy({
        by: ["sentiment"],
        where: { campaign: { organizationId }, sentiment: { not: null } },
        _count: { id: true },
      }),

      // Top campaigns by call count
      prisma.campaign.findMany({
        where: { organizationId },
        include: {
          _count: { select: { calls: true, leads: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    // Connect rate: calls answered / total calls
    const completedCalls = await prisma.call.count({
      where: { campaign: { organizationId }, status: "completed" },
    });
    const totalCalls = callStats._count.id;
    const connectRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0;

    // Average call duration (from startedAt → endedAt)
    const callsWithDuration = await prisma.call.findMany({
      where: { campaign: { organizationId }, endedAt: { not: null } },
      select: { startedAt: true, endedAt: true },
      take: 1000, // Sample up to 1k calls for perf
    });
    const avgDurationSec =
      callsWithDuration.length > 0
        ? callsWithDuration.reduce((sum, c) => {
            const dur = (c.endedAt!.getTime() - c.startedAt.getTime()) / 1000;
            return sum + dur;
          }, 0) / callsWithDuration.length
        : 0;

    // Pipeline velocity: INTERESTED + CONVERTED leads
    const hotLeads = await prisma.lead.count({
      where: { organizationId, status: { in: ["INTERESTED", "CONVERTED"] } },
    });

    return {
      overview: {
        totalLeads,
        totalCalls,
        connectRate: `${connectRate.toFixed(1)}%`,
        avgCallDurationSec: Math.round(avgDurationSec),
        hotLeads,
      },
      funnel: leadsByStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      campaigns: campaignStats.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      sentiment: sentimentDist.map((s) => ({
        sentiment: s.sentiment,
        count: s._count.id,
      })),
      topCampaigns: topCampaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        leadsCount: c._count.leads,
        callsCount: c._count.calls,
      })),
    };
  },

  async getCampaignMetrics(campaignId: string, organizationId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: { _count: { select: { calls: true, leads: true } } },
    });
    if (!campaign) return null;

    const calls = await prisma.call.findMany({
      where: { campaignId },
      select: { status: true, sentiment: true, startedAt: true, endedAt: true, attemptNumber: true },
    });

    const connected = calls.filter((c) => c.status === "completed").length;
    const interested = calls.filter((c) => c.sentiment === "interested").length;

    return {
      campaign: { id: campaign.id, name: campaign.name, status: campaign.status },
      totals: { leads: campaign._count.leads, calls: campaign._count.calls },
      connectRate: `${calls.length > 0 ? ((connected / calls.length) * 100).toFixed(1) : 0}%`,
      meetingRate: `${calls.length > 0 ? ((interested / calls.length) * 100).toFixed(1) : 0}%`,
      byStatus: Object.entries(
        calls.reduce((acc, c) => {
          acc[c.status] = (acc[c.status] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([status, count]) => ({ status, count })),
      bySentiment: Object.entries(
        calls.reduce((acc, c) => {
          if (c.sentiment) acc[c.sentiment] = (acc[c.sentiment] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([sentiment, count]) => ({ sentiment, count })),
    };
  },
};
