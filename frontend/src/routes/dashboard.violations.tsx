import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Play,
  Pause,
  Plus,
  Sparkles,
  PhoneCall,
  CheckCircle2,
  Flame,
  Users,
  Globe,
  Zap,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { useApp, type Campaign } from "@/components/app/store";
import { useLang } from "@/components/app/lang";
import {
  Bar,
  Btn,
  Field,
  LiveDot,
  PageHead,
  Panel,
  SpeakingWave,
  Stat,
  StatGrid,
  Tag,
  inputCls,
} from "@/components/app/ui";

export const Route = createFileRoute("/dashboard/violations")({
  head: () => ({
    meta: [
      { title: "Voice Campaigns Engine — VYAPERI X Sales Console" },
      {
        name: "description",
        content:
          "Autonomous multilingual AI voice campaigns engine. Schedule, monitor, and scale outbound calling queues.",
      },
    ],
  }),
  component: CampaignsPage,
});

/* Real-time active line simulation */
const ACTIVE_DIAL_LINES = [
  {
    agent: "Dhruv",
    lang: "Gujarati",
    target: "Bharat Patel (Patel Textiles, Surat)",
    status: "Pitching ERP Cloud Solution",
    stage: "pitch",
    duration: "1m 42s",
  },
  {
    agent: "Saanvi",
    lang: "Hindi",
    target: "Ananya Sharma (Northbridge Infra, Mumbai)",
    status: "Booking Architect Call (Thu 11 AM)",
    stage: "booking",
    duration: "2m 15s",
  },
  {
    agent: "Arjun",
    lang: "English",
    target: "Daniel Whitfield (Orbit Retail, London)",
    status: "Resolving Budget Objection",
    stage: "objection",
    duration: "0m 58s",
  },
  {
    agent: "Kavya",
    lang: "Tamil",
    target: "Suresh Kumar (Vajra Tech, Chennai)",
    status: "Dialling Carrier Switch…",
    stage: "dialling",
    duration: "0m 12s",
  },
];

const CAMPAIGN_TEMPLATES = [
  {
    name: "Gujarat SME & Textile Modernization",
    segment: "Textile & Manufacturing · Ahmedabad / Surat",
    leads: 350,
    lang: "Gujarati + Hindi",
    tz: "Asia/Kolkata",
  },
  {
    name: "India Enterprise Cloud & M365 Migration",
    segment: "IT Services & BFSI · 500+ employees",
    leads: 480,
    lang: "Hindi + English",
    tz: "Asia/Kolkata",
  },
  {
    name: "UK Headless Commerce & Replatforming",
    segment: "Retail & D2C Brands · UK / Europe",
    leads: 220,
    lang: "English (UK)",
    tz: "Europe/London",
  },
  {
    name: "MENA Omnichannel CX Automation",
    segment: "Telecom & Logistics · Dubai / Riyadh",
    leads: 180,
    lang: "Arabic + English",
    tz: "Asia/Dubai",
  },
];

function CampaignsPage() {
  const { t } = useLang();
  const { campaigns, setCampaignStatus, addCampaign } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");
  const [leads, setLeads] = useState("250");
  const [lang, setLang] = useState("Hindi + English");
  const [tz, setTz] = useState("Asia/Kolkata");
  const [pacingSpeed, setPacingSpeed] = useState<"1x" | "2x" | "4x">("2x");

  // Simulated live dialling counter tick
  const [liveDialCount, setLiveDialCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveDialCount((prev) => prev + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const selectTemplate = (tpl: (typeof CAMPAIGN_TEMPLATES)[0]) => {
    setName(tpl.name);
    setSegment(tpl.segment);
    setLeads(String(tpl.leads));
    setLang(tpl.lang);
    setTz(tpl.tz);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    addCampaign({
      name,
      segment,
      leads: Number(leads),
      status: "running",
      schedule: "Active Queue · Outbound Now",
      timezone: tz,
      language: lang,
    });
    setName("");
    setSegment("");
    setLeads("250");
    setShowForm(false);
  };

  const totalDialled = campaigns.reduce((s, c) => s + c.dialled, 0) + liveDialCount * 2;
  const totalConnected =
    campaigns.reduce((s, c) => s + c.connected, 0) + Math.floor(liveDialCount * 1.2);
  const totalInterested =
    campaigns.reduce((s, c) => s + c.interested, 0) + Math.floor(liveDialCount * 0.4);
  const totalMeetings =
    campaigns.reduce((s, c) => s + c.meetings, 0) + Math.floor(liveDialCount * 0.2);

  return (
    <div className="space-y-8">
      <PageHead
        index="/06"
        title={t("page.camp.title")}
        subtitle="Autonomous AI outbound voice campaign orchestrator with multi-line parallel dialling & timezone synchronization."
        action={
          <div className="flex items-center gap-2">
            <Btn variant="solid" onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-3.5 w-3.5 text-lime" />
              {showForm ? t("page.camp.cancel") : t("page.camp.new")}
            </Btn>
          </div>
        }
      />

      <StatGrid>
        <Stat
          label="Total Calls Dialled"
          value={totalDialled.toLocaleString()}
          note="+2 every 4s live"
        />
        <Stat
          label="Live Connected Calls"
          value={totalConnected.toLocaleString()}
          note={`${totalDialled ? Math.round((totalConnected / totalDialled) * 100) : 0}% connect rate`}
        />
        <Stat
          label="Interested Prospects"
          value={totalInterested.toLocaleString()}
          note="Qualified & pushed to deals"
        />
        <Stat
          label="Meetings Booked"
          value={totalMeetings.toLocaleString()}
          note="Confirmed on AE calendars"
        />
      </StatGrid>

      {/* New Campaign Creation Wizard */}
      {showForm && (
        <div className="border-2 border-violet bg-card p-6 rounded shadow-xl space-y-6 fade-in-up">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-display text-base font-bold">Launch Outbound Voice Campaign</h3>
              <p className="font-mono text-xs text-muted-foreground">
                Select a high-converting enterprise template or customize queue settings.
              </p>
            </div>
            <Tag tone="lime">Auto-Dialler Config</Tag>
          </div>

          {/* Preset Templates */}
          <div className="space-y-2">
            <div className="label-mono text-[10px] text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-lime" /> Quick Start with Enterprise Templates:
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {CAMPAIGN_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.name}
                  type="button"
                  onClick={() => selectTemplate(tpl)}
                  className="border border-border bg-paper p-3 text-left hover:border-violet hover:bg-secondary transition-all rounded"
                >
                  <div className="font-display text-xs font-bold text-ink">{tpl.name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-1">
                    {tpl.segment}
                  </div>
                  <div className="mt-2 flex items-center justify-between font-mono text-[10px]">
                    <span className="text-violet font-semibold">{tpl.lang}</span>
                    <span>{tpl.leads} leads</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <form className="grid gap-5 sm:grid-cols-2 pt-2 border-t border-border" onSubmit={submit}>
            <Field label="Campaign Name">
              <input
                className={inputCls}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Gujarat Textile & ERP Cloud Upgrade"
              />
            </Field>
            <Field label="Target ICP Segment">
              <input
                className={inputCls}
                required
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                placeholder="e.g. Manufacturing & IT · 500+ employees"
              />
            </Field>
            <Field label="Leads in Queue">
              <input
                className={inputCls}
                type="number"
                min="1"
                value={leads}
                onChange={(e) => setLeads(e.target.value)}
              />
            </Field>
            <Field label="Primary Voice Agent Language">
              <select className={inputCls} value={lang} onChange={(e) => setLang(e.target.value)}>
                {[
                  "Gujarati + Hindi",
                  "Hindi + English",
                  "English (IN/UK)",
                  "Spanish (LATAM)",
                  "Tamil + Telugu",
                  "Arabic + English",
                ].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Target Timezone (Auto-DNC compliant)">
              <select className={inputCls} value={tz} onChange={(e) => setTz(e.target.value)}>
                {[
                  "Asia/Kolkata (IST)",
                  "Europe/London (BST)",
                  "America/Bogota (COT)",
                  "Asia/Dubai (GST)",
                  "Asia/Singapore (SGT)",
                ].map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <Btn type="submit" variant="solid" className="w-full">
                <Flame className="h-3.5 w-3.5 text-lime" /> Launch Campaign Outbound Queue
              </Btn>
            </div>
          </form>
        </div>
      )}

      {/* Live Parallel Dialling Lines Visualizer */}
      <Panel
        title="Active Concurrent SIP Dialler Lines"
        hint={<LiveDot label="4 Active Outbound Channels" />}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-border text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Pacing Velocity:</span>
              {(["1x", "2x", "4x"] as const).map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPacingSpeed(spd)}
                  className={`px-2 py-0.5 border text-[10px] font-bold rounded ${
                    pacingSpeed === spd
                      ? "bg-violet text-white border-violet"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  {spd} Multiplier
                </button>
              ))}
            </div>
            <div className="text-muted-foreground">DNC Filter: Active & Compliant</div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {ACTIVE_DIAL_LINES.map((line, idx) => (
              <div key={idx} className="border border-border bg-card p-3.5 rounded space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet/20 font-mono text-[10px] font-bold text-violet">
                      L{idx + 1}
                    </span>
                    <strong className="font-display text-xs text-ink">{line.agent}</strong>
                    <Tag tone="violet">{line.lang}</Tag>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                    <SpeakingWave active={line.stage !== "dialling"} />
                    <span>{line.duration}</span>
                  </div>
                </div>

                <div className="font-mono text-[11px] text-muted-foreground truncate">
                  Target: <strong className="text-ink">{line.target}</strong>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[10px] font-mono">
                  <span
                    className={`font-semibold flex items-center gap-1 ${
                      line.stage === "booking"
                        ? "text-lime"
                        : line.stage === "pitch"
                          ? "text-violet"
                          : "text-muted-foreground"
                    }`}
                  >
                    {line.stage === "booking" && <CheckCircle2 className="h-3 w-3" />}
                    {line.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* Campaigns Queue Table */}
      <Panel title="Outbound Voice Campaigns" hint={`${campaigns.length} Queues Configured`}>
        <div className="divide-y divide-border">
          {campaigns.map((c) => (
            <div key={c.id} className="py-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    <span className="font-bold text-ink">{c.id}</span>
                    <Tag
                      tone={
                        c.status === "running"
                          ? "lime"
                          : c.status === "scheduled"
                            ? "violet"
                            : "muted"
                      }
                    >
                      {c.status.toUpperCase()}
                    </Tag>
                    <Tag tone="violet">{c.language}</Tag>
                    <span>{c.timezone}</span>
                  </div>
                  <h3 className="font-display text-sm font-bold uppercase text-ink">{c.name}</h3>
                  <div className="font-mono text-xs text-muted-foreground">
                    {c.segment} · {c.leads.toLocaleString()} Prospects in Queue · {c.schedule}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {c.status === "running" && (
                    <Btn
                      variant="outline"
                      onClick={() => setCampaignStatus(c.id, "scheduled")}
                      className="text-xs"
                    >
                      <Pause className="h-3 w-3" /> Pause Queue
                    </Btn>
                  )}
                  {(c.status === "draft" || c.status === "scheduled") && (
                    <Btn
                      variant="lime"
                      onClick={() => setCampaignStatus(c.id, "running")}
                      className="text-xs"
                    >
                      <Play className="h-3 w-3" /> Launch Dialler
                    </Btn>
                  )}
                </div>
              </div>

              {c.dialled > 0 && (
                <div className="grid gap-4 sm:grid-cols-4 font-mono text-xs pt-2">
                  <div className="border border-border/80 bg-paper/50 p-2.5 rounded">
                    <div className="flex justify-between text-muted-foreground text-[11px] mb-1">
                      <span>Dialled</span>
                      <strong className="text-ink">
                        {c.dialled} / {c.leads}
                      </strong>
                    </div>
                    <Bar value={Math.round((c.dialled / c.leads) * 100)} tone="violet" />
                  </div>
                  <div className="border border-border/80 bg-paper/50 p-2.5 rounded">
                    <div className="flex justify-between text-muted-foreground text-[11px] mb-1">
                      <span>Connected</span>
                      <strong className="text-ink">{c.connected}</strong>
                    </div>
                    <Bar
                      value={c.dialled ? Math.round((c.connected / c.dialled) * 100) : 0}
                      tone="violet"
                    />
                  </div>
                  <div className="border border-border/80 bg-paper/50 p-2.5 rounded">
                    <div className="flex justify-between text-muted-foreground text-[11px] mb-1">
                      <span>Interested</span>
                      <strong className="text-lime">{c.interested}</strong>
                    </div>
                    <Bar
                      value={c.connected ? Math.round((c.interested / c.connected) * 100) : 0}
                      tone="lime"
                    />
                  </div>
                  <div className="border border-border/80 bg-paper/50 p-2.5 rounded">
                    <div className="flex justify-between text-muted-foreground text-[11px] mb-1">
                      <span>Meetings Booked</span>
                      <strong className="text-lime">{c.meetings}</strong>
                    </div>
                    <Bar
                      value={c.interested ? Math.round((c.meetings / c.interested) * 100) : 0}
                      tone="lime"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
