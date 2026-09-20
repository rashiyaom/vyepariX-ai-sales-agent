import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowUpRight,
  Loader2,
  Sparkles,
  FileText,
  CheckCircle2,
  Radio,
  UploadCloud,
  Check,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Logo } from "@/components/site/Chrome";
import { LangSwitcher, useLang } from "@/components/app/lang";
import { ThemeToggle } from "@/components/app/theme";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In & Onboarding — VYAPERI X AI Sales Platform" },
      {
        name: "description",
        content:
          "Sign in to your VYAPERI X workspace or start a free 14-day trial. Experience our 11-step autonomous pipeline from onboarding to multilingual voice conversion.",
      },
      { property: "og:title", content: "Sign In & Onboarding — VYAPERI X AI Sales Platform" },
      {
        property: "og:description",
        content: "Sign in to the VYAPERI X sales operations dashboard.",
      },
    ],
  }),
  component: LoginPage,
});

/* Typewriter hook */
function useTypewriter(texts: string[], speed = 55, pause = 1800) {
  const [displayed, setDisplayed] = useState("");
  const [textIdx, setTextIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = texts[textIdx % texts.length]!;
    const delay = deleting ? speed / 2 : charIdx === current.length ? pause : speed;

    const t = setTimeout(() => {
      if (!deleting && charIdx < current.length) {
        setDisplayed(current.slice(0, charIdx + 1));
        setCharIdx((c) => c + 1);
      } else if (!deleting && charIdx === current.length) {
        setDeleting(true);
      } else if (deleting && charIdx > 0) {
        setDisplayed(current.slice(0, charIdx - 1));
        setCharIdx((c) => c - 1);
      } else {
        setDeleting(false);
        setTextIdx((i) => (i + 1) % texts.length);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [charIdx, deleting, textIdx, texts, speed, pause]);

  return displayed;
}

/* Animated terminal lines representing all 11 steps of the autonomous pipeline */
function TerminalPanel() {
  const LINES = [
    "> 01.onboard.ingest    --url=futurrizon.com --docs=2_files",
    "> 02.llm.understand    --extract=services,icp,keywords",
    "> 03.mode.select       --cadence=leads_and_calling",
    "> 04.discovery.radar   --sweep=linkedin,x,rfp,directories",
    "> 05.enrichment.mx     --resolve=email,phone,firmographics",
    "> 06.qualify.icp       --score=94% --tier=enterprise_hot",
    "> 07.campaign.sched    --tz=Asia/Kolkata --cadence=biz_hours",
    "> 08.voice.fleet       --agent=Dhruv --lang=Gujarati --dialling",
    "> 09.capture.telemetry --sentiment=HIGH --transcript=synced",
    "> 10.surface.handoff   --crm=HubSpot --notify=regional_ae",
    "> 11.analytics.repeat  --roi=+340% --loop=iterating",
  ];
  const [visible, setVisible] = useState<string[]>([]);
  const idx = useRef(0);

  useEffect(() => {
    const push = () => {
      idx.current = (idx.current + 1) % LINES.length;
      setVisible((prev) => [...prev.slice(-5), LINES[idx.current]!]);
    };
    push();
    const id = setInterval(push, 1400);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <pre className="relative font-mono text-[11px] leading-relaxed text-paper/50">
      {visible.map((line, i) => (
        <div
          key={`${line}-${i}`}
          className={`transition-opacity duration-500 ${i === visible.length - 1 ? "text-lime" : ""}`}
        >
          {line}
          {i === visible.length - 1 && (
            <span
              className="border-r-2 border-lime ml-0.5"
              style={{ animation: "typing-cursor 0.8s step-end infinite" }}
            >
              &nbsp;
            </span>
          )}
        </div>
      ))}
    </pre>
  );
}

/* Animated counter for social proof */
function Counter({ end, label, suffix = "" }: { end: number; label: string; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let frame = 0;
    const steps = 48;
    const timer = setInterval(() => {
      frame++;
      const p = 1 - Math.pow(1 - frame / steps, 3);
      setVal(Math.round(end * p));
      if (frame >= steps) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  }, [end]);
  return (
    <div className="text-center">
      <div className="font-display text-2xl font-extrabold text-paper tabular-nums">
        {val.toLocaleString()}
        {suffix}
      </div>
      <div className="mt-1 font-mono text-[10px] text-paper/50 uppercase tracking-widest">
        {label}
      </div>
    </div>
  );
}

function LoginPage() {
  const { t } = useLang();
  const [tab, setTab] = useState<"Sign In" | "Free Trial" | "API Key">("Free Trial");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  // 3-Stage Guided Onboarding State for "Free Trial"
  const [onboardStep, setOnboardStep] = useState<1 | 2 | 3>(1);
  const [businessUrl, setBusinessUrl] = useState("futurrizon.com");
  const [businessDesc, setBusinessDesc] = useState(
    "Enterprise Cloud Modernization, ERP Solutions & AI Automation",
  );
  const [uploadedDocs, setUploadedDocs] = useState([
    "Capability_Statement_2026.pdf",
    "Product_Pricing_Deck.pdf",
  ]);
  const [mode, setMode] = useState<"leads_and_calling" | "calling_only">("leads_and_calling");
  const [analyzingLlm, setAnalyzingLlm] = useState(false);

  const headlines = [
    t("login.tagline"),
    "11-Step Autonomous Sales Flow",
    "सुनो · समझो · सौदा करो",
    "Leads → Meetings → Revenue",
    "AI जो बेचता है, आप जो जीतते हैं",
  ];
  const headline = useTypewriter(headlines);

  const personas = [
    { key: "Sales Manager", desc: "Campaigns + analytics" },
    { key: "SDR", desc: "Lead discovery + calls" },
    { key: "Admin", desc: "Full platform access" },
    { key: "Analyst", desc: "Read-only reports" },
  ];

  const handleLlmAnalysis = () => {
    setAnalyzingLlm(true);
    setTimeout(() => {
      setAnalyzingLlm(false);
      setOnboardStep(2);
    }, 1100);
  };

  const handleFinishOnboarding = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setSuccess(true);
      setTimeout(() => navigate({ to: "/onboarding" }), 600);
    }, 1200);
  };

  const handleSubmitSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setSuccess(true);
      const isConfirmed = localStorage.getItem("vyaperi_profile_confirmed") === "true";
      setTimeout(() => navigate({ to: isConfirmed ? "/dashboard" : "/onboarding" }), 600);
    }, 1200);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* ── Left panel ── */}
      <div className="relative hidden flex-col justify-between border-r border-ink bg-ink p-12 text-paper lg:flex overflow-hidden">
        <div className="grid-paper absolute inset-0 opacity-20" />

        {/* Brand */}
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LangSwitcher dark />
          </div>
        </div>

        {/* Headline with typewriter */}
        <div className="relative">
          <div className="min-h-[6rem] font-display text-[clamp(2rem,4.5vw,3.8rem)] font-extrabold leading-[0.88]">
            {headline}
            <span
              className="border-r-2 border-lime ml-1"
              style={{ animation: "typing-cursor 0.8s step-end infinite" }}
            >
              &nbsp;
            </span>
          </div>
          <p className="mt-6 max-w-sm font-mono text-xs leading-relaxed text-paper/60">
            {t("login.desc")}
          </p>

          {/* Social-proof counters */}
          <div className="mt-8 grid grid-cols-3 gap-px border border-paper/10 bg-paper/10">
            <Counter end={11} label="Engine Steps" suffix="" />
            <Counter end={4200} label="Leads / day" suffix="+" />
            <Counter end={61} label="Connect rate" suffix="%" />
          </div>
        </div>

        {/* Terminal */}
        <TerminalPanel />

        {/* Pulsing orbs - decorative */}
        <div
          className="absolute bottom-20 right-10 h-32 w-32 rounded-full bg-violet/10 blur-2xl"
          style={{ animation: "live-dot 3s ease-in-out infinite" }}
        />
        <div
          className="absolute top-32 right-6 h-20 w-20 rounded-full bg-lime/10 blur-xl"
          style={{ animation: "live-dot 2.2s ease-in-out infinite", animationDelay: "0.8s" }}
        />
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-col bg-paper">
        <div className="flex items-center justify-between border-b border-ink/20 px-6 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 label-mono hover:text-violet transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {t("login.back")}
          </Link>
          <span className="lg:hidden">
            <Logo />
          </span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LangSwitcher />
          </div>
        </div>

        <div className="mx-auto w-full max-w-lg flex-1 px-6 py-8">
          <span className="label-mono text-violet fade-in">// Autonomous Pipeline Setup</span>
          <h2 className="mt-2 font-display text-3xl font-extrabold fade-in anim-d-100">
            {tab === "Free Trial" ? "Start Autonomous Onboarding" : t("login.signin")}
          </h2>
          <p className="mt-2 font-mono text-xs leading-relaxed text-muted-foreground fade-in anim-d-200">
            {tab === "Free Trial"
              ? "Experience the complete 11-step sales automation flow in under 2 minutes."
              : "Authenticate with workspace credentials or a bearer API key."}
          </p>

          {/* Tabs */}
          <div className="mt-6 grid grid-cols-3 gap-px border border-ink bg-ink/15 fade-in anim-d-300">
            {(["Free Trial", "Sign In", "API Key"] as const).map((t_) => (
              <button
                key={t_}
                onClick={() => setTab(t_)}
                className={`px-2 py-2.5 label-mono text-xs transition-all ${
                  tab === t_ ? "bg-ink text-paper" : "bg-paper hover:bg-secondary"
                }`}
              >
                {t_ === "Sign In"
                  ? t("login.signin")
                  : t_ === "Free Trial"
                    ? "11-Step Onboarding"
                    : t("login.api")}
              </button>
            ))}
          </div>

          {/* Form Area */}
          {tab === "Free Trial" ? (
            <div className="mt-6 space-y-5 fade-in anim-d-400">
              {/* Step Progress Bar */}
              <div className="grid grid-cols-3 gap-2 font-mono text-[11px] border border-ink/20 p-2 bg-secondary">
                <button
                  type="button"
                  onClick={() => setOnboardStep(1)}
                  className={`p-1.5 text-left border ${
                    onboardStep === 1
                      ? "bg-ink text-paper border-ink font-bold"
                      : "bg-paper text-muted-foreground border-transparent"
                  }`}
                >
                  01. Ingestion
                </button>
                <button
                  type="button"
                  onClick={() => setOnboardStep(2)}
                  className={`p-1.5 text-left border ${
                    onboardStep === 2
                      ? "bg-ink text-paper border-ink font-bold"
                      : "bg-paper text-muted-foreground border-transparent"
                  }`}
                >
                  02. LLM Engine
                </button>
                <button
                  type="button"
                  onClick={() => setOnboardStep(3)}
                  className={`p-1.5 text-left border ${
                    onboardStep === 3
                      ? "bg-ink text-paper border-ink font-bold"
                      : "bg-paper text-muted-foreground border-transparent"
                  }`}
                >
                  03. Mode Select
                </button>
              </div>

              {/* Sub-step 1: Ingestion */}
              {onboardStep === 1 && (
                <div className="space-y-4 border border-ink bg-card p-5">
                  <div className="label-mono text-xs text-violet font-bold">
                    // Step 1: Business Ingestion
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    Submit your company URL, description or collateral so our LLM can learn your
                    product offerings.
                  </p>
                  <Field
                    label="Company Website / URL"
                    type="text"
                    value={businessUrl}
                    onChange={(v) => setBusinessUrl(v)}
                    placeholder="e.g. futurrizon.com"
                  />
                  <div className="block">
                    <span className="label-mono text-muted-foreground">
                      Business Overview / Description
                    </span>
                    <textarea
                      value={businessDesc}
                      onChange={(e) => setBusinessDesc(e.target.value)}
                      rows={2}
                      className="mt-2 w-full border border-ink bg-transparent px-3 py-2 font-mono text-xs text-ink outline-none focus:border-violet focus:ring-2 focus:ring-violet/20"
                    />
                  </div>

                  <div>
                    <span className="label-mono text-muted-foreground block mb-1.5">
                      Attached Documentation & Decks
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {uploadedDocs.map((doc) => (
                        <span
                          key={doc}
                          className="inline-flex items-center gap-1.5 bg-paper border border-ink/20 px-2.5 py-1 font-mono text-[11px]"
                        >
                          <FileText className="h-3 w-3 text-violet" /> {doc}
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setUploadedDocs((p) => [...p, `Catalog_Update_${p.length + 1}.pdf`])
                        }
                        className="inline-flex items-center gap-1 border border-dashed border-ink/40 px-2 py-1 font-mono text-[11px] text-muted-foreground hover:border-violet hover:text-violet"
                      >
                        <UploadCloud className="h-3 w-3" /> + Add Doc
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleLlmAnalysis}
                    disabled={analyzingLlm}
                    className="w-full mt-2 inline-flex items-center justify-center gap-2 border border-ink bg-ink px-4 py-3 label-mono text-paper hover:bg-violet hover:border-violet transition-all active:scale-[0.98]"
                  >
                    {analyzingLlm ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing with LLM
                        Reasoning…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" /> Run Business Understanding Engine →
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Sub-step 2: LLM Engine */}
              {onboardStep === 2 && (
                <div className="space-y-4 border border-ink bg-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="label-mono text-xs text-violet font-bold">
                      // Step 2: Derived Business Profile
                    </span>
                    <span className="label-mono text-[10px] text-emerald-700 dark:text-lime flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> LLM Analysis Complete
                    </span>
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    <div className="border border-ink/15 bg-paper p-3 space-y-1">
                      <span className="font-bold text-ink">Derived Services:</span>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[
                          "Cloud ERP Modernization",
                          "SharePoint & M365 Setup",
                          "Multilingual AI Voice Fleet",
                          "Snowflake Analytics",
                        ].map((s) => (
                          <span
                            key={s}
                            className="bg-violet/10 text-violet px-2 py-0.5 border border-violet/20 text-[10px]"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="border border-ink/15 bg-paper p-3 space-y-1">
                      <span className="font-bold text-ink">
                        Derived Ideal Customer Profile (ICP):
                      </span>
                      <p className="text-muted-foreground text-[11px] leading-relaxed">
                        VP Tech, IT Director, COO & Head of Transformation at Mid-Market firms
                        (200–5,000 headcount) in Manufacturing, Logistics & Retail.
                      </p>
                    </div>

                    <div className="border border-ink/15 bg-paper p-3 space-y-1">
                      <span className="font-bold text-ink">Target Intent Keywords:</span>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[
                          "SharePoint partner",
                          "Cloud ERP vendor",
                          "warehouse GST",
                          "AI voice vendor",
                        ].map((k) => (
                          <span
                            key={k}
                            className="bg-secondary px-2 py-0.5 border border-ink/10 text-[10px]"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setOnboardStep(1)}
                      className="border border-ink/30 px-3 py-2.5 label-mono text-xs hover:bg-secondary"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setOnboardStep(3)}
                      className="flex-1 inline-flex items-center justify-center gap-2 border border-ink bg-ink px-4 py-2.5 label-mono text-paper hover:bg-violet hover:border-violet transition-all"
                    >
                      Proceed to Mode Selection →
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-step 3: Mode Selection */}
              {onboardStep === 3 && (
                <form
                  onSubmit={handleFinishOnboarding}
                  className="space-y-4 border border-ink bg-card p-5"
                >
                  <div className="label-mono text-xs text-violet font-bold">
                    // Step 3: Select Operational Mode
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    Choose how your sales pipeline should execute leads:
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label
                      onClick={() => setMode("calling_only")}
                      className={`cursor-pointer p-4 border transition-all flex flex-col justify-between ${
                        mode === "calling_only"
                          ? "bg-paper border-violet ring-2 ring-violet/20 shadow"
                          : "bg-paper/50 border-ink/20 hover:border-ink"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-display font-bold text-xs">Calling Only</span>
                          <span
                            className={`h-3 w-3 rounded-full border ${mode === "calling_only" ? "bg-violet border-violet" : "border-ink/40"}`}
                          />
                        </div>
                        <p className="mt-2 font-mono text-[10px] text-muted-foreground leading-relaxed">
                          User uploads leads via CSV/Excel or CRM sync. Deploys multilingual AI
                          voice fleet without public scraping.
                        </p>
                      </div>
                      <span className="mt-3 label-mono text-[9px] text-violet">
                        BYO Leads (CSV/CRM)
                      </span>
                    </label>

                    <label
                      onClick={() => setMode("leads_and_calling")}
                      className={`cursor-pointer p-4 border transition-all flex flex-col justify-between ${
                        mode === "leads_and_calling"
                          ? "bg-paper border-lime ring-2 ring-lime/20 shadow"
                          : "bg-paper/50 border-ink/20 hover:border-ink"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-display font-bold text-xs">Leads + Calling</span>
                          <span
                            className={`h-3 w-3 rounded-full border ${mode === "leads_and_calling" ? "bg-lime border-lime" : "border-ink/40"}`}
                          />
                        </div>
                        <p className="mt-2 font-mono text-[10px] text-muted-foreground leading-relaxed">
                          Autonomous AI Discovery Engine scans 40+ public channels for live buyer
                          RFPs, enriches contacts, and executes voice fleet.
                        </p>
                      </div>
                      <span className="mt-3 label-mono text-[9px] text-emerald-700 dark:text-lime font-bold">
                        Autonomous End-to-End
                      </span>
                    </label>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setOnboardStep(2)}
                      className="border border-ink/30 px-3 py-2.5 label-mono text-xs hover:bg-secondary"
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading || success}
                      className="flex-1 inline-flex items-center justify-center gap-2 border border-ink bg-lime px-4 py-3 label-mono text-lime-foreground hover:bg-ink hover:text-paper transition-all font-bold active:scale-[0.98]"
                    >
                      {success ? (
                        <>✓ Launching Workspace…</>
                      ) : loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Provisioning 11-Step
                          Pipeline…
                        </>
                      ) : (
                        <>
                          Launch Autonomous Workspace <ArrowUpRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* Sign In / API Key Form */
            <form className="mt-6 space-y-4 fade-in anim-d-400" onSubmit={handleSubmitSignIn}>
              {tab === "API Key" ? (
                <Field
                  label={t("login.api")}
                  type="password"
                  placeholder="vx_sk_live_••••••••••••"
                />
              ) : (
                <>
                  <Field label={t("login.email")} type="email" placeholder="you@yourcompany.com" />
                  <Field label={t("login.password")} type="password" placeholder="••••••••••••" />
                </>
              )}

              <button
                type="submit"
                disabled={loading || success}
                className={`group inline-flex w-full items-center justify-center gap-3 border border-ink px-6 py-3.5 label-mono transition-all active:scale-[0.98] ${
                  success
                    ? "bg-lime text-lime-foreground border-lime"
                    : "bg-ink text-paper hover:border-violet hover:bg-violet"
                } disabled:opacity-80`}
              >
                {success ? (
                  <>✓ Redirecting to dashboard…</>
                ) : loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Authenticating…
                  </>
                ) : (
                  <>
                    {t("login.cta.signin")}
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Demo personas */}
          <div className="mt-10 fade-in anim-d-500">
            <span className="label-mono text-muted-foreground text-xs">{t("login.demo")}</span>
            <div className="mt-3 grid gap-px border border-ink bg-ink/15 sm:grid-cols-2">
              {personas.map(({ key, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    const isConfirmed = localStorage.getItem("vyaperi_profile_confirmed") === "true";
                    const target = isConfirmed ? "/dashboard" : "/onboarding";
                    setTimeout(() => navigate({ to: target }), 600);
                  }}
                  className="group bg-paper px-3.5 py-3 text-left transition-all hover:bg-violet hover:text-violet-foreground active:scale-[0.98]"
                >
                  <span className="block font-display text-xs font-bold uppercase">{key}</span>
                  <span className="mt-0.5 block font-mono text-[10px] opacity-70">{desc}</span>
                  <span className="mt-1.5 block label-mono text-[9px] opacity-0 group-hover:opacity-60 transition-opacity">
                    → Enter as {key}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type: string;
  placeholder: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <label className="block">
      <span
        className={`label-mono text-xs transition-colors ${focused ? "text-violet" : "text-muted-foreground"}`}
      >
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="mt-1.5 w-full border border-ink bg-transparent px-3.5 py-2.5 font-mono text-xs text-ink outline-none placeholder:text-muted-foreground/60 focus:border-violet focus:ring-2 focus:ring-violet/20 transition-all"
      />
    </label>
  );
}
