import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useApp } from "@/components/app/store";
import { Btn, PageHead, Panel, Stat, StatGrid, Tag, Terminal } from "@/components/app/ui";

export const Route = createFileRoute("/dashboard/registry")({
  head: () => ({
    meta: [
      { title: "CRM & Integrations — VYAPERI X Sales Console" },
      {
        name: "description",
        content:
          "Connect VYAPERI X to HubSpot, Salesforce, Zapier and other tools. View audit logs and sync status.",
      },
      { property: "og:title", content: "CRM & Integrations — VYAPERI X Sales Console" },
      { property: "og:description", content: "Manage CRM connections and integration health." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CrmIntegrationsPage,
});

const INTEGRATIONS = [
  {
    id: "INT-01",
    name: "HubSpot CRM",
    category: "CRM",
    desc: "Sync interested leads as deals with full contact details, call transcript link and next action.",
    status: "connected",
    synced: "11:12:04",
  },
  {
    id: "INT-02",
    name: "Salesforce",
    category: "CRM",
    desc: "Push qualified leads to Salesforce opportunities with stage mapping.",
    status: "disconnected",
    synced: "—",
  },
  {
    id: "INT-03",
    name: "Zapier",
    category: "Automation",
    desc: "Trigger any Zapier workflow on lead events: INTERESTED, CALLBACK, NOT_INTERESTED.",
    status: "connected",
    synced: "11:08:41",
  },
  {
    id: "INT-04",
    name: "Twilio",
    category: "Voice",
    desc: "Built-in calling infrastructure. Own Twilio number or bring your own SID.",
    status: "connected",
    synced: "active",
  },
  {
    id: "INT-05",
    name: "WhatsApp Business",
    category: "Messaging",
    desc: "Send automated follow-up messages after AI calls to WhatsApp contacts.",
    status: "connected",
    synced: "10:55:12",
  },
  {
    id: "INT-06",
    name: "Slack",
    category: "Notifications",
    desc: "Real-time Slack alerts for INTERESTED outcomes, review queue items and campaign completions.",
    status: "disconnected",
    synced: "—",
  },
  {
    id: "INT-07",
    name: "Google Sheets",
    category: "Export",
    desc: "Auto-export lead lists, call logs and campaign reports to Google Sheets on a schedule.",
    status: "connected",
    synced: "Daily 06:00",
  },
  {
    id: "INT-08",
    name: "Webhook",
    category: "API",
    desc: "Send POST events to any endpoint on lead stage changes or call completions.",
    status: "connected",
    synced: "—",
  },
];

function CrmIntegrationsPage() {
  const { audit } = useApp();
  const [intStates, setIntStates] = useState<Record<string, string>>(
    Object.fromEntries(INTEGRATIONS.map((i) => [i.id, i.status])),
  );

  const toggle = (id: string) =>
    setIntStates((prev) => ({
      ...prev,
      [id]: prev[id] === "connected" ? "disconnected" : "connected",
    }));

  const connected = Object.values(intStates).filter((s) => s === "connected").length;

  return (
    <div className="space-y-8">
      <PageHead
        index="/10"
        title="CRM & Integrations"
        subtitle="Connect your CRM, automation tools and communication platforms. All interested leads push automatically."
      />

      <StatGrid>
        <Stat
          label="Connected integrations"
          value={String(connected)}
          note={`of ${INTEGRATIONS.length} available`}
        />
        <Stat label="CRM synced today" value="47" note="interested leads pushed" />
        <Stat label="Webhooks fired" value="312" note="last 24h" />
        <Stat label="API uptime" value="99.8%" note="last 30 days" />
      </StatGrid>

      <Panel title="Integration marketplace" hint={`${connected} active`}>
        <div className="grid gap-4 sm:grid-cols-2">
          {INTEGRATIONS.map((int) => (
            <div key={int.id} className="border border-ink/20 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold uppercase">{int.name}</span>
                    <Tag tone={intStates[int.id] === "connected" ? "lime" : "muted"}>
                      {intStates[int.id]}
                    </Tag>
                  </div>
                  <Tag>{int.category}</Tag>
                </div>
                <Btn
                  variant={intStates[int.id] === "connected" ? "outline" : "solid"}
                  onClick={() => toggle(int.id)}
                >
                  {intStates[int.id] === "connected" ? "Disconnect" : "Connect"}
                </Btn>
              </div>
              <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                {int.desc}
              </p>
              {int.synced !== "—" && (
                <div className="font-mono text-[10px] text-muted-foreground">
                  last sync: {int.synced}
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Audit log" hint="platform events">
        <div className="divide-y divide-ink/10">
          {audit.map((a) => (
            <div
              key={a.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-3 font-mono text-xs"
            >
              <span className="shrink-0 text-muted-foreground">{a.ts}</span>
              <span className="min-w-0">
                <span className="block truncate text-muted-foreground">{a.actor}</span>
                <span className="block truncate text-ink">{a.action}</span>
              </span>
              <Tag tone={a.tone === "ok" ? "lime" : a.tone === "warn" ? "violet" : "danger"}>
                {a.tone}
              </Tag>
            </div>
          ))}
        </div>
      </Panel>

      <Terminal
        title="api.webhook.config"
        lines={[
          `endpoint    = "https://your-webhook.io/vyaperi"`,
          `events      = ["lead.interested", "lead.stage_change", "call.completed"]`,
          `auth        = bearer vx_sk_live_••••`,
          `retry       = 3x exponential backoff`,
          `// Test: POST /webhook/test  →  {"event":"ping","ts":"${new Date().toISOString()}"}`,
        ]}
      />
    </div>
  );
}
