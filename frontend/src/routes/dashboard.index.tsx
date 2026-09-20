import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Layers,
  Sparkles,
  Radio,
  Database,
  ArrowRight,
} from "lucide-react";
import { useApp } from "@/components/app/store";
import { useLang } from "@/components/app/lang";
import {
  Bar,
  LiveDot,
  OutcomeChip,
  PageHead,
  Panel,
  Stat,
  StatGrid,
  ScoreDot,
} from "@/components/app/ui";
import { VoiceAgentSynthesizerWidget } from "@/components/app/voice-synthesizer";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Overview — VYAPERI X 11-Step Sales Console" },
      {
        name: "description",
        content:
          "Daily sales operations overview: 11-step autonomous pipeline, leads discovered, calls dialled, meetings booked and live call stream.",
      },
    ],
  }),
  component: OverviewPage,
});

const PIPELINE_PHASES = [
  {
    phase: "01",
    name: "Setup & Reasoner",
    tagline: "Ingest collateral & derive ICP",
    steps: [
      {
        n: "01",
        title: "Onboarding Ingestion",
        link: "/dashboard/workspace",
        detail: "Company website URL, product catalog and pitch decks ingested into platform memory.",
        badge: "futurrizon.com",
      },
      {
        n: "02",
        title: "LLM Business Reasoner",
        link: "/dashboard/workspace",
        detail: "Autonomous LLM derives commercial services, ICP parameters, and buyer intent keywords.",
        badge: "4 Services Extracted",
      },
      {
        n: "03",
        title: "Mode Selection",
        link: "/dashboard/inspector",
        detail: "Choose [Calling Only] for uploaded lead files or [Leads + Calling] for autonomous radar.",
        badge: "Dual Cadence Supported",
      },
    ],
  },
  {
    phase: "02",
    name: "Discovery & Scoring",
    tagline: "Sweep 40+ public sources & enrich",
    steps: [
      {
        n: "04",
        title: "Multi-Source Radar",
        link: "/dashboard/inspector",
        detail: "Continuously scans LinkedIn, X/Twitter, company sites, directories and freelance boards.",
        badge: "4,200+ Daily Signals",
      },
      {
        n: "05",
        title: "Deep Profile Enrichment",
        link: "/dashboard/delegation-demo",
        detail: "Fills verified corporate emails, direct phone lines, firmographics and source citations.",
        badge: "99.8% Resolution Rate",
      },
      {
        n: "06",
        title: "AI ICP Qualification",
        link: "/dashboard/review-queue",
        detail: "Multi-factor AI scoring ranks leads against derived ICP to prioritize high-intent buyers.",
        badge: "94% Match Accuracy",
      },
    ],
  },
  {
    phase: "03",
    name: "Voice Fleet Outreach",
    tagline: "Autonomous consultative calls",
    steps: [
      {
        n: "07",
        title: "Campaign Scheduling",
        link: "/dashboard/violations",
        detail: "Schedules cadences by prospect timezone and office hours with tailored sales goals.",
        badge: "Asia/Kolkata Active",
      },
      {
        n: "08",
        title: "Multilingual Voice Fleet",
        link: "/dashboard/simulation",
        detail: "Autonomous outbound calls in Hindi, Gujarati, English & Spanish with human turn-taking.",
        badge: "3 Agents Dialling",
      },
      {
        n: "09",
        title: "Real-Time Capture",
        link: "/dashboard/attack-demo",
        detail: "Instant audio transcripts, executive summaries, sentiment tracking and next actions.",
        badge: "< 150ms Turnaround",
      },
    ],
  },
  {
    phase: "04",
    name: "Closure & Repeat Loop",
    tagline: "CRM handoff & closed-loop learning",
    steps: [
      {
        n: "10",
        title: "Surfaced Deal Handoff",
        link: "/dashboard/registry",
        detail: "Highlights interested buyers immediately, alerts sales reps, and syncs to CRM.",
        badge: "HubSpot Deal Synced",
      },
      {
        n: "11",
        title: "Analytics & Repeat Loop",
        link: "/dashboard/identity",
        detail: "Pipeline attribution, objection frequency heatmaps, and continuous prompt refinement.",
        badge: "+340% Meeting Rate",
      },
    ],
  },
];

export function OverviewPage() {
  const { t } = useLang();
  const {
    leads,
    calls,
    campaigns,
    review,
    pushLead,
    pipelineMode,
    setPipelineMode,
    businessProfile,
  } = useApp();
  const pending = review.filter((r) => r.status === "pending").length;
  const interested = calls.filter((c) => c.outcome === "INTERESTED").length;
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [selectedPhase, setSelectedPhase] = useState<string>("all");

  /* Auto-discover a lead every 6s to show the live feed updating */
  useEffect(() => {
    const id = setInterval(() => {
      pushLead();
      setFlashIdx(0);
      setTick((t) => t + 1);
      setTimeout(() => setFlashIdx(null), 900);
    }, 6000);
    return () => clearInterval(id);
  }, [pushLead]);

  const filteredPhases =
    selectedPhase === "all"
      ? PIPELINE_PHASES
      : PIPELINE_PHASES.filter((p) => p.phase === selectedPhase);

  const FUNNEL: [string, number, number][] = [
    ["01. Ingestion & Profile", 1, 100],
    ["02. LLM Derived Services", businessProfile.derivedServices.length, 100],
    ["04. Radar Discovered", leads.length + 4176, 100],
    ["05. Deep Enriched", Math.round((leads.length + 4176) * 0.93), 93],
    ["06. ICP Qualified", Math.round((leads.length + 4176) * 0.55), 55],
    ["07. In Active Campaigns", 1884, 45],
    ["08. Voice Connected", 1149, 27],
    ["09. Captured Telemetry", 1149, 27],
    ["10. Interested Surfaced", interested + 44, 7],
    ["11. Meetings & Repeat", 94, 2],
  ];

  return (
    <div className="space-y-8">
      <PageHead
        index="/01"
        title="11-Step Autonomous Sales Console"
        subtitle="End-to-end execution: from business ingestion and LLM ICP reasoning to multilingual voice closure and CRM sync."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Mode Switcher pill */}
            <button
              onClick={() =>
                setPipelineMode(
                  pipelineMode === "leads_and_calling" ? "calling_only" : "leads_and_calling",
                )
              }
              className="inline-flex items-center gap-2 border border-ink/40 bg-paper px-3 py-2.5 font-mono text-xs hover:border-violet transition-colors"
              title="Click to toggle pipeline mode"
            >
              <span className="text-muted-foreground">Mode:</span>
              <span
                className={`font-bold ${
                  pipelineMode === "leads_and_calling"
                    ? "text-emerald-700 dark:text-lime"
                    : "text-violet"
                }`}
              >
                {pipelineMode === "leads_and_calling" ? "[Leads + Calling]" : "[Calling Only]"}
              </span>
            </button>
            <Link
              to="/dashboard/attack-demo"
              className="group inline-flex items-center gap-2 border border-ink bg-ink px-4 py-2.5 label-mono text-paper transition-all hover:border-violet hover:bg-violet active:scale-95"
            >
              {t("page.overview.callDemoBtn")}
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        }
      />

      {/* ── 11-Step Structured Operational Pipeline (Organized by 4 Clear Phases) ── */}
      <div className="border border-ink bg-card p-5 space-y-5 shadow-md">
        {/* Header with Mode & Ingestion status */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 pb-3 font-mono text-xs">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-lime animate-ping" />
            <span className="font-bold text-ink uppercase tracking-wider text-sm">
              // Autonomous Sales Pipeline Architecture
            </span>
            <span className="text-muted-foreground text-xs hidden md:inline">
              — 11 Connected Gates Across 4 Operational Phases
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              Ingested: <strong className="text-ink">{businessProfile.url}</strong>
            </span>
            <span className="border-l border-ink/20 pl-3 text-violet font-bold">
              {pipelineMode === "leads_and_calling" ? "Autonomous Radar Sweep" : "BYO Lead CSV Mode"}
            </span>
          </div>
        </div>

        {/* Phase Filter Tabs: Easy to understand & comfortable on phone */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="label-mono text-muted-foreground text-[11px] mr-1">View Phase:</span>
          <button
            onClick={() => setSelectedPhase("all")}
            className={`px-3 py-1.5 border transition-all ${
              selectedPhase === "all"
                ? "bg-ink text-paper border-ink font-bold shadow-sm"
                : "bg-paper text-ink border-ink/20 hover:border-violet"
            }`}
          >
            All 4 Phases (11 Steps)
          </button>
          {PIPELINE_PHASES.map((p) => (
            <button
              key={p.phase}
              onClick={() => setSelectedPhase(p.phase)}
              className={`px-3 py-1.5 border transition-all flex items-center gap-1.5 ${
                selectedPhase === p.phase
                  ? "bg-violet text-white border-violet font-bold shadow-sm"
                  : "bg-paper text-ink border-ink/20 hover:border-violet"
              }`}
            >
              <span className="text-lime font-bold">P{p.phase}</span>
              <span>{p.name.split(" ")[0]}</span>
              <span className="text-[10px] opacity-70">({p.steps.length})</span>
            </button>
          ))}
        </div>

        {/* 4 Spacious Phase Columns Grid */}
        <div
          className={`grid gap-4 ${
            selectedPhase === "all"
              ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
              : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {filteredPhases.map((phase) => (
            <div
              key={phase.phase}
              className="border border-ink/20 bg-paper/60 dark:bg-card/70 p-4 space-y-3.5 flex flex-col justify-between hover:border-ink/50 transition-colors"
            >
              {/* Phase Column Header */}
              <div className="border-b border-ink/15 pb-2.5">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-extrabold text-violet bg-violet/10 px-2 py-0.5 border border-violet/20">
                    PHASE {phase.phase}
                  </span>
                  <span className="label-mono text-[10px] text-muted-foreground">
                    {phase.steps.length} Steps
                  </span>
                </div>
                <h3 className="mt-2 font-display text-base font-bold text-ink leading-tight">
                  {phase.name}
                </h3>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground leading-tight">
                  {phase.tagline}
                </p>
              </div>

              {/* Steps inside this Phase */}
              <div className="space-y-2.5 flex-1">
                {phase.steps.map((step) => (
                  <Link
                    key={step.n}
                    to={step.link}
                    className="group block border border-ink/15 bg-paper p-3 hover:border-violet hover:shadow-md transition-all relative"
                  >
                    <div className="flex items-center justify-between font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-violet bg-violet/10 px-1.5 py-0.2 text-[10px] border border-violet/20">
                          #{step.n}
                        </span>
                        <span className="font-display text-xs font-bold text-ink group-hover:text-violet transition-colors">
                          {step.title}
                        </span>
                      </div>
                      <span className="h-1.5 w-1.5 rounded-full bg-lime shrink-0" />
                    </div>

                    <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                      {step.detail}
                    </p>

                    <div className="mt-2 pt-2 border-t border-ink/10 flex items-center justify-between font-mono text-[10px]">
                      <span className="text-emerald-700 dark:text-lime font-bold truncate max-w-[170px]">
                        ✓ {step.badge}
                      </span>
                      <span className="text-muted-foreground group-hover:text-violet inline-flex items-center gap-0.5 shrink-0">
                        Open <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <StatGrid>
        <Stat label={t("stat.leads")} value={String(leads.length + 4176)} note="+1 just now" />
        <Stat label={t("stat.calls")} value="1,884" note="3 active right now" />
        <Stat
          label={t("stat.interested")}
          value={String(interested + 44)}
          note={`${pending} pending review`}
        />
        <Stat label={t("stat.meetings")} value="94" note="↑ 18% vs last week" />
      </StatGrid>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Live call stream */}
        <Panel title={t("page.overview.callStream")} hint={<LiveDot label="auto-updating" />}>
          <div className="divide-y divide-ink/10">
            {calls.slice(0, 8).map((c, i) => (
              <div
                key={c.id}
                className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-3 font-mono text-xs transition-all ${
                  i === flashIdx ? "row-flash" : ""
                }`}
              >
                <span className="shrink-0 text-muted-foreground">{c.ts}</span>
                <span className="min-w-0">
                  <span className="block truncate text-ink">{c.lead}</span>
                  <span className="block truncate text-muted-foreground">
                    {c.company} · {c.language}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-muted-foreground">{c.duration}</span>
                  <OutcomeChip outcome={c.outcome} />
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-8">
          {/* Funnel */}
          <Panel title="11-Step Conversion Funnel" hint={t("page.overview.today")}>
            <div className="space-y-3.5">
              {FUNNEL.map(([l, v, p]) => (
                <div key={l}>
                  <div className="flex items-baseline justify-between font-mono text-[10px]">
                    <span className="label-mono">{l}</span>
                    <span className="text-muted-foreground">{v.toLocaleString()}</span>
                  </div>
                  <div className="mt-1">
                    <Bar value={p} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Terminal status */}
          <div className="border border-ink bg-ink p-5 text-paper fade-in-up">
            <div className="flex items-center justify-between mb-3">
              <div className="label-mono text-paper/50">// 11_step_pipeline.status</div>
              <LiveDot label="active" />
            </div>
            <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed">{`mode.active         = ${pipelineMode}
profile.ingested    = ${businessProfile.url}
llm.derived.services= ${businessProfile.derivedServices.length}
campaigns.running   = ${campaigns.filter((c) => c.status === "running").length}
leads.total         = ${leads.length + 4176}
leads.qualified     = ${leads.filter((l) => l.stage === "qualified").length}
review.pending      = ${pending}
voice.agents.fleet  = 3 (Hi/Gu/En)
crm.synced.deals    = ${interested + 44}
repeat.loop.cadence = active`}</pre>
          </div>
        </div>
      </div>

      {/* Voice Fleet Live Testing Studio */}
      <Panel
        title="Voice Agent Fleet Testing Studio — Male & Female (Hindi / Gujarati / English)"
        hint="Real-Time Speech Synthesis"
      >
        <VoiceAgentSynthesizerWidget compact={true} />
      </Panel>

      {/* Recent leads table */}
      <Panel title={t("page.overview.recent")} hint={`${leads.length} in workspace`}>
        <div className="divide-y divide-ink/10">
          {leads.slice(0, 6).map((l, i) => (
            <div
              key={l.id}
              className={`grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 py-3 font-mono text-xs fade-in-up ${
                i === 0 && tick > 0 ? "row-flash" : ""
              }`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <ScoreDot score={l.score} />
              <span className="min-w-0">
                <span className="block truncate font-bold text-ink">{l.name}</span>
                <span className="block truncate text-muted-foreground">
                  {l.title} · {l.company}
                </span>
              </span>
              <span className="hidden text-muted-foreground sm:block">{l.source}</span>
              <span className="shrink-0 border border-ink/20 px-2 py-0.5 font-mono text-[10px] uppercase">
                {l.stage}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
