import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, FileText, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { useApp } from "@/components/app/store";
import {
  Bar,
  Btn,
  Field,
  PageHead,
  Panel,
  Stat,
  StatGrid,
  Tag,
  Terminal,
  inputCls,
} from "@/components/app/ui";

export const Route = createFileRoute("/dashboard/workspace")({
  head: () => ({
    meta: [
      { title: "Workspace & Business Profile — VYAPERI X Sales Console" },
      {
        name: "description",
        content:
          "Configure business onboarding inputs, LLM business understanding engine, pipeline mode, plan usage and platform calling setup.",
      },
      { property: "og:title", content: "Workspace & Business Profile — VYAPERI X Sales Console" },
      {
        property: "og:description",
        content: "Configure your VYAPERI X workspace, plan and calling setup.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorkspacePage,
});

function WorkspacePage() {
  const {
    workspace,
    setWorkspace,
    pipelineMode,
    setPipelineMode,
    businessProfile,
    updateBusinessProfile,
    runUnderstandingEngine,
  } = useApp();
  const [saved, setSaved] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const handleReRunLLM = async () => {
    setAnalyzing(true);
    await runUnderstandingEngine();
    setAnalyzing(false);
  };

  const minutesPct = Math.round((workspace.minutesUsed / workspace.minutesQuota) * 100);
  const contactsPct = Math.round((workspace.contactsUsed / workspace.contactsQuota) * 100);

  return (
    <div className="space-y-8">
      <PageHead
        index="/12"
        title="Workspace & Business Profile"
        subtitle="Configure company onboarding inputs, Business Understanding Engine (LLM) parameters, and pipeline operational mode."
      />

      {/* Mode Switcher & Pipeline Strategy */}
      <div className="border border-ink bg-card p-6 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 pb-3">
          <div>
            <span className="label-mono text-violet font-bold">
              // Step 3: Pipeline Operational Mode
            </span>
            <h3 className="font-display text-lg font-bold mt-1">Autonomous Execution Strategy</h3>
          </div>
          <span className="label-mono text-xs px-2.5 py-1 border border-ink/20 bg-secondary">
            Current:{" "}
            <strong className="text-violet uppercase">
              {pipelineMode === "leads_and_calling" ? "Leads + Calling" : "Calling Only"}
            </strong>
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setPipelineMode("calling_only")}
            className={`p-5 text-left border transition-all ${
              pipelineMode === "calling_only"
                ? "bg-paper border-violet ring-2 ring-violet/20 shadow-md"
                : "bg-paper/40 border-ink/20 hover:border-ink"
            }`}
          >
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="font-bold text-ink">[Mode 1: Calling Only]</span>
              <span
                className={`h-3 w-3 rounded-full border ${pipelineMode === "calling_only" ? "bg-violet border-violet" : "border-ink/40"}`}
              />
            </div>
            <p className="mt-2 font-mono text-xs text-muted-foreground leading-relaxed">
              Upload existing lead lists via CSV, Excel, or direct CRM integration. AI Voice fleet
              executes campaigns directly on your uploaded records without public scraping.
            </p>
            <span className="mt-3 inline-block label-mono text-[10px] text-violet font-bold">
              BYO Lead List (CSV/CRM)
            </span>
          </button>

          <button
            type="button"
            onClick={() => setPipelineMode("leads_and_calling")}
            className={`p-5 text-left border transition-all ${
              pipelineMode === "leads_and_calling"
                ? "bg-paper border-lime ring-2 ring-lime/20 shadow-md"
                : "bg-paper/40 border-ink/20 hover:border-ink"
            }`}
          >
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="font-bold text-ink">[Mode 2: Leads + Calling]</span>
              <span
                className={`h-3 w-3 rounded-full border ${pipelineMode === "leads_and_calling" ? "bg-lime border-lime" : "border-ink/40"}`}
              />
            </div>
            <p className="mt-2 font-mono text-xs text-muted-foreground leading-relaxed">
              Autonomous AI Discovery Radar continuously sweeps 40+ channels (LinkedIn, X, public
              RFP directories, bidding portals), enriches contact info, and dials via voice fleet.
            </p>
            <span className="mt-3 inline-block label-mono text-[10px] text-emerald-700 dark:text-lime font-bold">
              End-to-End Autonomous Radar
            </span>
          </button>
        </div>
      </div>

      {/* Business Understanding Engine (LLM) Card */}
      <div className="border border-ink bg-card p-6 shadow-md space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 pb-4">
          <div>
            <span className="label-mono text-violet font-bold">
              // Steps 1 & 2: Business Understanding Engine (LLM)
            </span>
            <h3 className="font-display text-lg font-bold mt-1">
              Autonomous Profile & ICP Reasoner
            </h3>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              The LLM parses your company website and documents to dynamically extract your
              commercial services, qualification thresholds, and target buyer keywords.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReRunLLM}
            disabled={analyzing}
            className="inline-flex items-center gap-2 border border-ink bg-ink px-4 py-2.5 font-mono text-xs font-bold text-paper hover:bg-violet hover:border-violet transition-all active:scale-95 disabled:opacity-50"
          >
            {analyzing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reasoning with LLM…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" /> Re-run LLM Understanding Engine
              </>
            )}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Ingested Assets */}
          <div className="space-y-4 border border-ink/20 bg-paper p-4">
            <span className="label-mono text-xs font-bold text-ink block">
              01. Ingested Sources
            </span>
            <div className="space-y-2 font-mono text-xs">
              <div>
                <span className="text-muted-foreground text-[10px] block">Company Website:</span>
                <input
                  className="mt-1 w-full border border-ink/20 bg-transparent px-2.5 py-1.5 font-mono text-xs text-ink"
                  value={businessProfile.url}
                  onChange={(e) => updateBusinessProfile({ url: e.target.value })}
                />
              </div>
              <div className="pt-2">
                <span className="text-muted-foreground text-[10px] block mb-1">
                  Uploaded Documents & Decks:
                </span>
                <div className="space-y-1">
                  {businessProfile.documents.map((doc) => (
                    <div
                      key={doc}
                      className="flex items-center gap-2 bg-secondary p-1.5 border border-ink/10 text-[11px]"
                    >
                      <FileText className="h-3 w-3 text-violet shrink-0" />
                      <span className="truncate">{doc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Derived Services */}
          <div className="space-y-4 border border-ink/20 bg-paper p-4">
            <span className="label-mono text-xs font-bold text-ink block">
              02. Derived Services
            </span>
            <div className="space-y-1.5">
              {businessProfile.derivedServices.map((srv) => (
                <div
                  key={srv}
                  className="bg-violet/10 text-violet px-2.5 py-1.5 font-mono text-xs border border-violet/20 flex items-center gap-2"
                >
                  <CheckCircle2 className="h-3 w-3 text-violet shrink-0" />
                  <span>{srv}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Derived ICP & Keywords */}
          <div className="space-y-4 border border-ink/20 bg-paper p-4">
            <span className="label-mono text-xs font-bold text-ink block">
              03. Derived ICP & Target Keywords
            </span>
            <div className="space-y-2 font-mono text-xs">
              <div className="bg-secondary p-2.5 border border-ink/10 space-y-1 text-[11px]">
                <div className="font-bold text-ink">
                  {businessProfile.derivedIcp.targetAudience}
                </div>
                <div className="text-muted-foreground">
                  {businessProfile.derivedIcp.companySize} ·{" "}
                  {businessProfile.derivedIcp.industries.join(", ")}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block mb-1">
                  Intent Keywords:
                </span>
                <div className="flex flex-wrap gap-1">
                  {businessProfile.derivedKeywords.map((k) => (
                    <span key={k} className="bg-paper border border-ink/20 px-2 py-0.5 text-[10px]">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <StatGrid>
        <Stat label="Plan" value={workspace.plan} note={workspace.region} />
        <Stat
          label="Voice minutes"
          value={`${workspace.minutesUsed.toLocaleString()} / ${workspace.minutesQuota.toLocaleString()}`}
          note={`${minutesPct}% used`}
        />
        <Stat
          label="Contacts"
          value={`${workspace.contactsUsed.toLocaleString()} / ${workspace.contactsQuota.toLocaleString()}`}
          note={`${contactsPct}% used`}
        />
        <Stat label="Infra" value={workspace.ownInfra ? "Own infra" : "Platform calling"} />
      </StatGrid>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel title="Usage" hint="this billing period">
          <div className="space-y-5">
            <div>
              <div className="flex justify-between font-mono text-[11px] mb-2">
                <span className="label-mono text-muted-foreground">AI Voice minutes</span>
                <span>
                  {workspace.minutesUsed.toLocaleString()} /{" "}
                  {workspace.minutesQuota.toLocaleString()}
                </span>
              </div>
              <Bar
                value={minutesPct}
                tone={minutesPct > 80 ? "danger" : minutesPct > 60 ? "violet" : "lime"}
              />
            </div>
            <div>
              <div className="flex justify-between font-mono text-[11px] mb-2">
                <span className="label-mono text-muted-foreground">Contacts / leads</span>
                <span>
                  {workspace.contactsUsed.toLocaleString()} /{" "}
                  {workspace.contactsQuota.toLocaleString()}
                </span>
              </div>
              <Bar
                value={contactsPct}
                tone={contactsPct > 80 ? "danger" : contactsPct > 60 ? "violet" : "lime"}
              />
            </div>
          </div>
        </Panel>

        <Panel title="Configuration" hint="save to apply">
          <form className="space-y-5" onSubmit={save}>
            <Field label="Company name">
              <input
                className={inputCls}
                value={workspace.company}
                onChange={(e) => setWorkspace({ company: e.target.value })}
              />
            </Field>
            <Field label="Company website">
              <input
                className={inputCls}
                value={workspace.website}
                onChange={(e) => setWorkspace({ website: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Region">
                <select
                  className={inputCls}
                  value={workspace.region}
                  onChange={(e) => setWorkspace({ region: e.target.value })}
                >
                  {[
                    "ap-south-1 (Mumbai)",
                    "eu-west-1 (London)",
                    "us-east-1 (Virginia)",
                    "ap-southeast-1 (Singapore)",
                  ].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Default language">
                <select
                  className={inputCls}
                  value={workspace.language}
                  onChange={(e) => setWorkspace({ language: e.target.value })}
                >
                  {["Hindi", "English", "Spanish", "Arabic", "Tamil", "Bengali"].map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Notification email">
              <input
                className={inputCls}
                value={workspace.notifyEmail}
                onChange={(e) => setWorkspace({ notifyEmail: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-3 border border-ink/20 px-3 py-3">
              <input
                type="checkbox"
                checked={workspace.ownInfra}
                onChange={(e) => setWorkspace({ ownInfra: e.target.checked })}
                className="h-4 w-4 accent-violet"
              />
              <span className="font-mono text-xs">Use own calling infrastructure (Twilio SID)</span>
            </label>
            <label className="flex items-center gap-3 border border-ink/20 px-3 py-3">
              <input
                type="checkbox"
                checked={workspace.dncRespect}
                onChange={(e) => setWorkspace({ dncRespect: e.target.checked })}
                className="h-4 w-4 accent-violet"
              />
              <span className="font-mono text-xs">
                Respect national Do-Not-Call lists automatically
              </span>
            </label>
            <div className="flex items-center gap-3">
              <Btn type="submit" variant="solid">
                Save configuration
              </Btn>
              {saved && <Tag tone="lime">saved</Tag>}
            </div>
          </form>
        </Panel>
      </div>

      <Terminal
        title="workspace.toml"
        lines={[
          `company        = "${workspace.company}"`,
          `website        = "${workspace.website}"`,
          `pipeline_mode  = "${pipelineMode}"`,
          `derived_icp    = "${businessProfile.derivedIcp.companySize}"`,
          `plan           = "${workspace.plan}"`,
          `region         = "${workspace.region}"`,
          `language       = "${workspace.language}"`,
          `own_infra      = ${workspace.ownInfra}`,
          `dnc_respect    = ${workspace.dncRespect}`,
          `notify         = "${workspace.notifyEmail}"`,
        ]}
      />
    </div>
  );
}
