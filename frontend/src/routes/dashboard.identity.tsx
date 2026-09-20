import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/components/app/store";
import { Bar, PageHead, Panel, Stat, StatGrid } from "@/components/app/ui";

export const Route = createFileRoute("/dashboard/identity")({
  head: () => ({
    meta: [
      { title: "Analytics — VYAPERI X Sales Console" },
      {
        name: "description",
        content:
          "Sales pipeline analytics: conversion rates, campaign ROI, per-agent performance and industry breakdown.",
      },
      { property: "og:title", content: "Analytics — VYAPERI X Sales Console" },
      {
        property: "og:description",
        content: "Measure pipeline performance, campaign ROI and voice agent results.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

const INDUSTRY_BREAKDOWN: [string, number][] = [
  ["IT Services", 28],
  ["Retail / E-commerce", 18],
  ["Manufacturing", 15],
  ["Healthcare", 12],
  ["Fintech", 10],
  ["Logistics", 9],
  ["Others", 8],
];

const WEEKLY: [string, number, number, number][] = [
  ["Mon", 412, 241, 28],
  ["Tue", 388, 198, 22],
  ["Wed", 445, 281, 41],
  ["Thu", 391, 220, 35],
  ["Fri", 248, 141, 19],
  ["Sat", 102, 48, 6],
  ["Sun", 58, 22, 3],
];

function AnalyticsPage() {
  const { leads, calls, campaigns, voiceAgents } = useApp();
  const interested = calls.filter((c) => c.outcome === "INTERESTED").length;
  const meetings = campaigns.reduce((s, c) => s + c.meetings, 0);
  const dialled = campaigns.reduce((s, c) => s + c.dialled, 0);
  const connected = campaigns.reduce((s, c) => s + c.connected, 0);

  return (
    <div className="space-y-8">
      <PageHead
        index="/09"
        title="Analytics"
        subtitle="End-to-end pipeline performance from discovery to conversion."
      />

      <StatGrid>
        <Stat
          label="Discovery → Qualified"
          value={`${leads.length ? Math.round((leads.filter((l) => l.stage === "qualified").length / leads.length) * 100) : 0}%`}
          note="enrichment rate"
        />
        <Stat
          label="Dial → Connect"
          value={dialled ? `${Math.round((connected / dialled) * 100)}%` : "—"}
          note="connect rate"
        />
        <Stat
          label="Connect → Interested"
          value={connected ? `${Math.round((interested / connected) * 100)}%` : "—"}
          note="qualification rate"
        />
        <Stat label="Meetings booked" value={meetings.toLocaleString()} note="this month" />
      </StatGrid>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Weekly call volume" hint="dialled · connected · interested">
          <div className="space-y-4">
            {WEEKLY.map(([day, d, c, i]) => (
              <div key={day} className="grid grid-cols-[40px_1fr] items-center gap-4">
                <span className="label-mono text-muted-foreground">{day}</span>
                <div className="space-y-1">
                  <Bar value={(d / 500) * 100} />
                  <Bar value={(c / 500) * 100} tone="violet" />
                  <Bar value={(i / 500) * 100} tone="lime" />
                </div>
              </div>
            ))}
            <div className="flex gap-6 font-mono text-[10px] text-muted-foreground pt-2">
              <span className="flex items-center gap-2">
                <span className="inline-block h-2 w-4 bg-ink/20" /> Dialled
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-2 w-4 bg-violet" /> Connected
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-2 w-4 bg-lime" /> Interested
              </span>
            </div>
          </div>
        </Panel>

        <div className="space-y-8">
          <Panel title="Industry breakdown" hint="% of pipeline">
            <div className="space-y-4">
              {INDUSTRY_BREAKDOWN.map(([ind, pct]) => (
                <div key={ind}>
                  <div className="flex justify-between font-mono text-[11px] mb-1">
                    <span className="label-mono">{ind}</span>
                    <span className="text-muted-foreground">{pct}%</span>
                  </div>
                  <Bar value={pct * 3.5} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Agent performance">
            <div className="space-y-4">
              {voiceAgents.map((a) => (
                <div key={a.id}>
                  <div className="flex justify-between font-mono text-[11px] mb-1">
                    <span className="label-mono">
                      {a.name} ({a.language})
                    </span>
                    <span className="text-muted-foreground">{a.connectRate}%</span>
                  </div>
                  <Bar value={a.connectRate} tone={a.connectRate > 55 ? "lime" : "violet"} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-4">
        {[
          {
            label: "Source breakdown",
            items: [
              ["LinkedIn", "44%"],
              ["X / Twitter", "11%"],
              ["Websites", "18%"],
              ["Directories", "15%"],
              ["Freelance", "12%"],
            ],
          },
          {
            label: "Stage distribution",
            items: [
              ["New", "28%"],
              ["Enriched", "38%"],
              ["Qualified", "18%"],
              ["Contacted", "11%"],
              ["Interested", "5%"],
            ],
          },
          {
            label: "Call outcomes",
            items: [
              ["Interested", "22%"],
              ["Callback", "14%"],
              ["Voicemail", "28%"],
              ["No answer", "24%"],
              ["Not interested", "12%"],
            ],
          },
          {
            label: "Language coverage",
            items: [
              ["Hindi", "32%"],
              ["English", "28%"],
              ["Spanish", "12%"],
              ["Arabic", "8%"],
              ["Others", "20%"],
            ],
          },
        ].map(({ label, items }) => (
          <Panel key={label} title={label}>
            <div className="space-y-2">
              {items.map(([k, v]) => (
                <div key={k} className="flex justify-between font-mono text-[11px]">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-bold">{v}</span>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
