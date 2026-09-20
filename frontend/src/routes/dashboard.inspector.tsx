import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  ExternalLink,
  Radio,
  Sparkles,
  PhoneCall,
  CheckCircle2,
  Play,
  Pause,
  Volume2,
  ShieldCheck,
  Database,
  Zap,
} from "lucide-react";
import { useApp, type Lead } from "@/components/app/store";
import { useLang } from "@/components/app/lang";
import {
  Btn,
  LiveDot,
  PageHead,
  Panel,
  ScoreDot,
  SpeakingWave,
  Stat,
  StatGrid,
  Tag,
  inputCls,
} from "@/components/app/ui";

export const Route = createFileRoute("/dashboard/inspector")({
  head: () => ({
    meta: [
      { title: "Lead Discovery Radar — VYAPERI X Sales Console" },
      {
        name: "description",
        content:
          "Autonomous AI discovery radar scanning LinkedIn, X, directories, and web sources in real time.",
      },
    ],
  }),
  component: LeadDiscoveryPage,
});

/* Visual Radar Sweep Component */
function RadarScanner({ active = true, leadCount = 24 }: { active: boolean; leadCount: number }) {
  return (
    <div className="relative flex aspect-square w-full max-w-[280px] mx-auto items-center justify-center border border-ink/30 bg-ink/5 p-4 overflow-hidden rounded-full">
      {/* Concentric rings */}
      <div className="absolute inset-4 rounded-full border border-ink/15" />
      <div className="absolute inset-12 rounded-full border border-ink/20" />
      <div className="absolute inset-20 rounded-full border border-ink/25" />
      <div className="absolute inset-[88px] rounded-full border border-lime/30" />

      {/* Axis crosshairs */}
      <div className="absolute h-full w-[1px] bg-ink/15" />
      <div className="absolute h-[1px] w-full bg-ink/15" />

      {/* Radar sweep beam */}
      {active && (
        <div
          className="absolute inset-0 origin-center rounded-full pointer-events-none"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, transparent 270deg, color-mix(in oklab, var(--color-lime) 35%, transparent) 360deg)",
            animation: "radar-sweep 3s linear infinite",
          }}
        />
      )}

      {/* Simulated target blips */}
      <div
        className="absolute top-[28%] left-[62%] h-2 w-2 rounded-full bg-lime live-dot"
        title="LinkedIn: In-Market Buyer"
      />
      <div
        className="absolute top-[68%] left-[32%] h-2 w-2 rounded-full bg-violet live-dot"
        style={{ animationDelay: "0.6s" }}
        title="X Post: RFP Active"
      />
      <div
        className="absolute top-[40%] left-[24%] h-2 w-2 rounded-full bg-lime live-dot"
        style={{ animationDelay: "1.2s" }}
        title="Web Lead: Enterprise"
      />
      <div
        className="absolute top-[75%] left-[70%] h-1.5 w-1.5 rounded-full bg-paper border border-ink live-dot"
        style={{ animationDelay: "1.8s" }}
      />

      {/* Center core */}
      <div className="relative z-10 flex h-14 w-14 flex-col items-center justify-center rounded-full border border-ink bg-paper text-center shadow-lg">
        <span className="font-display text-xs font-extrabold text-ink">{leadCount}</span>
        <span className="font-mono text-[8px] text-muted-foreground uppercase">Target</span>
      </div>
    </div>
  );
}

/* Deep Enrichment Simulator */
const ENRICHMENT_STEPS = [
  "Resolving verified MX & corporate mailbox",
  "Pinging telecom switch for active direct dial",
  "Extracting technology stack & active vendors",
  "Scraping hiring surge & funding round data",
  "Calculating conversion probability & ICP match",
  "Synthesizing multilingual voice calling dossier",
];

function LeadDiscoveryPage() {
  const { t } = useLang();
  const { leads, pushLead, setStage } = useApp();
  const [live, setLive] = useState(true);
  const [filter, setFilter] = useState("");
  const [source, setSource] = useState("ALL");
  const [selected, setSelected] = useState<Lead | null>(leads[0] ?? null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [scanPct, setScanPct] = useState(0);

  // Enrichment modal / drawer state
  const [enriching, setEnriching] = useState(false);
  const [enrichStep, setEnrichStep] = useState(0);
  const [enrichedSuccess, setEnrichedSuccess] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [showCallToast, setShowCallToast] = useState(false);

  /* Auto-push every 3.5s when live, animate scan bar */
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      const before = leads.length;
      pushLead();
      setTimeout(() => {
        const fresh = leads.slice(0, leads.length - before).map((l) => l.id);
        if (fresh.length) setNewIds((s) => new Set([...s, ...fresh]));
        setTimeout(() => setNewIds(new Set()), 1200);
      }, 100);
    }, 3500);
    return () => clearInterval(id);
  }, [live, leads, pushLead]);

  /* Scanning progress bar */
  useEffect(() => {
    if (!live) {
      setScanPct(0);
      return;
    }
    let p = 0;
    const id = setInterval(() => {
      p = (p + 1.2) % 100;
      setScanPct(p);
    }, 40);
    return () => clearInterval(id);
  }, [live]);

  const runDeepEnrichment = () => {
    if (!selected) return;
    setEnriching(true);
    setEnrichStep(0);
    setEnrichedSuccess(false);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      setEnrichStep(step);
      if (step >= ENRICHMENT_STEPS.length) {
        clearInterval(interval);
        setEnriching(false);
        setEnrichedSuccess(true);
        setStage(selected.id, "qualified");
      }
    }, 600);
  };

  const rows = leads.filter(
    (l) =>
      (source === "ALL" || l.source === source) &&
      (filter === "" ||
        (l.name + l.company + l.requirement + l.industry + l.location)
          .toLowerCase()
          .includes(filter.toLowerCase())),
  );

  return (
    <div className="space-y-8">
      <PageHead
        index="/02"
        title={t("page.disc.title")}
        subtitle="Autonomous AI multi-source radar scanning LinkedIn, X, web directories, and tenders in real-time."
        action={
          <div className="flex items-center gap-2">
            <Btn variant={live ? "lime" : "outline"} onClick={() => setLive((l) => !l)}>
              <Radio className={`h-3.5 w-3.5 ${live ? "live-dot text-lime-foreground" : ""}`} />
              {live ? t("page.disc.live") : t("page.disc.pause")}
            </Btn>
            <Btn variant="solid" onClick={pushLead}>
              <Sparkles className="h-3.5 w-3.5 text-lime" />
              {t("page.disc.push")}
            </Btn>
          </div>
        }
      />

      {/* Scanning progress bar */}
      {live && (
        <div className="h-1 w-full bg-ink/10 overflow-hidden">
          <div
            className="h-full bg-lime transition-none"
            style={{ width: `${scanPct}%`, transition: "width 40ms linear" }}
          />
        </div>
      )}

      {/* Top metrics */}
      <StatGrid>
        <Stat
          label="Total Discovered"
          value={String(leads.length + 4176)}
          note="Autonomous radar active"
        />
        <Stat
          label="LinkedIn Signals"
          value={String(leads.filter((l) => l.source === "LinkedIn").length + 1840)}
          note="High buying intent"
        />
        <Stat
          label="X / Social RFPs"
          value={String(leads.filter((l) => l.source === "X").length + 412)}
          note="Fast-response window"
        />
        <Stat
          label="Public Web & Directories"
          value={String(leads.filter((l) => !["LinkedIn", "X"].includes(l.source)).length + 1924)}
          note="Verified domains"
        />
      </StatGrid>

      {/* Filters & Source selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className={`${inputCls} max-w-xs`}
            placeholder="Search name, company, requirement, city…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {["ALL", "LinkedIn", "X", "Website", "Directory", "Freelance", "CRM"].map((v) => (
            <Btn key={v} variant={source === v ? "solid" : "outline"} onClick={() => setSource(v)}>
              {v}
            </Btn>
          ))}
        </div>
        <div className="font-mono text-xs text-muted-foreground flex items-center gap-2">
          <LiveDot label={`${rows.length} Active Targets`} />
        </div>
      </div>

      {/* Main Grid: Radar + Discovery Stream + Lead Detail Inspector */}
      <div className="grid gap-8 lg:grid-cols-[280px_1.2fr_1.1fr]">
        {/* Column 1: Live Radar Sweep & Signal Summary */}
        <div className="space-y-6">
          <Panel title="Autonomous Radar" hint="Active">
            <div className="py-2">
              <RadarScanner active={live} leadCount={rows.length} />
            </div>
            <div className="mt-4 border-t border-ink/15 pt-4 space-y-2.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Radar Status</span>
                <span className="text-emerald-700 dark:text-lime font-bold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 bg-emerald-600 dark:bg-lime rounded-full live-dot" />{" "}
                  Scanning
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scan Velocity</span>
                <span>14.2 req/sec</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sources Covered</span>
                <span>42 Active Nodes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Intent Score</span>
                <span className="text-violet font-bold">84.2%</span>
              </div>
            </div>
          </Panel>

          <div className="border border-ink/20 bg-secondary/50 p-4 space-y-3">
            <div className="label-mono text-ink flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-lime" /> Real-Time Trigger
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
              Every prospect discovered matches high-intent keywords (RFP, migration, budget
              approved, partner search).
            </p>
          </div>
        </div>

        {/* Column 2: Discovery Stream Feed */}
        <Panel title="Live Prospect Stream" hint={<LiveDot label={`${rows.length} matches`} />}>
          <div className="max-h-[580px] divide-y divide-ink/10 overflow-y-auto pr-1">
            {rows.map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  setSelected(l);
                  setEnrichedSuccess(false);
                  setPlayingAudio(false);
                }}
                className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3.5 px-2 text-left font-mono text-xs transition-all ${
                  newIds.has(l.id) ? "row-flash bg-lime/10" : ""
                } ${selected?.id === l.id ? "bg-secondary border-l-2 border-violet" : "hover:bg-secondary/60"}`}
              >
                <ScoreDot score={l.score} />
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold text-ink text-[13px]">{l.name}</span>
                    <Tag
                      tone={
                        l.source === "LinkedIn" ? "violet" : l.source === "X" ? "lime" : "muted"
                      }
                    >
                      {l.source}
                    </Tag>
                  </div>
                  <div className="truncate text-muted-foreground text-[11px]">
                    {l.title} · <span className="text-ink font-semibold">{l.company}</span>
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground/80 italic">
                    "{l.requirement}"
                  </div>
                </div>
                <div className="shrink-0 text-right space-y-1">
                  <span className="inline-block border border-ink/20 px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                    {l.stage}
                  </span>
                  <div className="font-mono text-[9px] text-muted-foreground">
                    {l.discovered.slice(11)}
                  </div>
                </div>
              </button>
            ))}
            {!rows.length && (
              <div className="py-12 text-center font-mono text-xs text-muted-foreground">
                // No leads found matching current criteria
              </div>
            )}
          </div>
        </Panel>

        {/* Column 3: Lead Deep Inspector & AI Enrichment Studio */}
        <div className="space-y-6">
          <Panel title="Prospect Inspector" hint={selected?.id ?? "—"}>
            {selected ? (
              <div className="space-y-5 fade-in">
                {/* Header Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Tag
                      tone={selected.score > 80 ? "lime" : selected.score > 55 ? "violet" : "muted"}
                    >
                      Fit Score: {selected.score}/100
                    </Tag>
                    <Tag tone={enrichedSuccess ? "lime" : "muted"}>
                      {enrichedSuccess ? "✓ Fully Enriched" : selected.stage}
                    </Tag>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {selected.language}
                  </span>
                </div>

                {/* Key metadata grid */}
                <div className="border border-ink/20 p-3.5 bg-paper/50 space-y-2">
                  <div className="font-display text-base font-extrabold">{selected.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {selected.title} @ <strong className="text-ink">{selected.company}</strong>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="border border-ink/20 px-2 py-0.5 font-mono text-[10px] bg-secondary">
                      {selected.industry}
                    </span>
                    <span className="border border-ink/20 px-2 py-0.5 font-mono text-[10px] bg-secondary">
                      {selected.size} emp
                    </span>
                    <span className="border border-ink/20 px-2 py-0.5 font-mono text-[10px] bg-secondary">
                      {selected.location}
                    </span>
                  </div>
                </div>

                {/* Raw Requirement Post */}
                <div className="space-y-1.5">
                  <div className="label-mono text-[10px] text-muted-foreground">
                    Public Intent Trigger:
                  </div>
                  <div className="border border-ink/20 bg-secondary p-3 font-mono text-xs leading-relaxed text-ink/90">
                    "{selected.requirement}"
                  </div>
                  <a
                    href={`https://${selected.postUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-mono text-[11px] text-violet underline hover:text-ink transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" /> View source verification:{" "}
                    {selected.postUrl}
                  </a>
                </div>

                {/* AI Audio Dossier Player */}
                <div className="border border-ink/20 bg-ink/5 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="label-mono text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <Volume2 className="h-3.5 w-3.5 text-lime" /> AI Voice Briefing
                    </span>
                    <SpeakingWave active={playingAudio} />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPlayingAudio(!playingAudio)}
                      className="flex h-8 w-8 items-center justify-center border border-ink bg-paper text-ink hover:bg-violet hover:text-white transition-colors"
                    >
                      {playingAudio ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5 ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1 font-mono text-[10px] text-muted-foreground">
                      {playingAudio
                        ? "Playing 15s AI synthesis overview of prospect requirement & ICP talking points..."
                        : "Click to play AI speech briefing for SDR"}
                    </div>
                  </div>
                </div>

                {/* Live Deep Enrichment Action */}
                <div className="space-y-2 pt-2 border-t border-ink/15">
                  <Btn
                    variant={enrichedSuccess ? "lime" : "solid"}
                    disabled={enriching}
                    onClick={runDeepEnrichment}
                    className="w-full"
                  >
                    {enriching ? (
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 animate-spin text-lime" />
                        Running Deep Intelligence Scan…
                      </span>
                    ) : enrichedSuccess ? (
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Intelligence Verified & Enriched
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-lime" /> Run Deep AI Enrichment
                      </span>
                    )}
                  </Btn>

                  {/* Progress steps animation during enrichment */}
                  {enriching && (
                    <div className="border border-ink/20 bg-secondary p-3 space-y-2 font-mono text-[11px] fade-in">
                      {ENRICHMENT_STEPS.map((stepText, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          {idx < enrichStep ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-lime shrink-0" />
                          ) : idx === enrichStep ? (
                            <span className="h-2 w-2 rounded-full bg-violet animate-ping shrink-0" />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-ink/20 shrink-0" />
                          )}
                          <span
                            className={
                              idx <= enrichStep
                                ? "text-ink font-medium"
                                : "text-muted-foreground/60"
                            }
                          >
                            {stepText}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick Outbound Trigger */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Btn
                      variant="outline"
                      onClick={() => {
                        setShowCallToast(true);
                        setTimeout(() => setShowCallToast(false), 2500);
                      }}
                      className="w-full text-[11px]"
                    >
                      <PhoneCall className="h-3 w-3 text-lime" /> Direct Dial SDR
                    </Btn>
                    <Btn
                      variant="outline"
                      onClick={() => {
                        setShowCallToast(true);
                        setTimeout(() => setShowCallToast(false), 2500);
                      }}
                      className="w-full text-[11px]"
                    >
                      <Database className="h-3 w-3 text-violet" /> Push to CRM
                    </Btn>
                  </div>

                  {showCallToast && (
                    <div className="border border-ink bg-lime px-3 py-2 font-mono text-[11px] text-black font-extrabold text-center fade-in">
                      ✓ Command Queued: Multilingual Agent Assigned
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center font-mono text-xs text-muted-foreground">
                // Select a prospect from the stream to inspect
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
