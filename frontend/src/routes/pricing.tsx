import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Check,
  Zap,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  ArrowUpRight,
  PhoneCall,
  DollarSign,
  Users,
  Clock,
  Radio,
  HelpCircle,
  ChevronDown,
  Activity,
  Layers,
  Award,
} from "lucide-react";
import { SiteHeader, SiteFooter, SectionHead } from "@/components/site/Chrome";
import { ScrollReveal } from "@/components/app/scroll-reveal";
import { Tag, LiveDot } from "@/components/app/ui";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing & Autonomous ROI Architecture — VYAPERI X" },
      {
        name: "description",
        content:
          "Transparent, high-ROI pricing for autonomous AI lead discovery and multilingual voice sales agents. Replace manual dialing with 24/7 AI agents in Hindi, Gujarati, and English.",
      },
      { property: "og:title", content: "Pricing & Autonomous ROI Architecture — VYAPERI X" },
      {
        property: "og:description",
        content:
          "Explore flexible plans for startups, scaling sales teams, and high-volume enterprise pipelines.",
      },
    ],
  }),
  component: PricingPage,
});

type Currency = "INR" | "USD" | "EUR" | "AED";

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  AED: "AED ",
};

const CURRENCY_RATES: Record<Currency, number> = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  AED: 0.044,
};

interface Plan {
  id: string;
  name: string;
  badge?: string;
  isPopular?: boolean;
  tagline: string;
  monthlyPriceINR: number;
  annualPriceINR: number;
  monthlyMinutes: string;
  monthlyLeads: string;
  concurrentCalls: string;
  languages: string;
  features: string[];
  ctaLabel: string;
  ctaTone: "primary" | "lime" | "outline";
}

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Growth Radar",
    tagline: "For founders & boutique agencies automating their first outbound sales cadence.",
    monthlyPriceINR: 4999,
    annualPriceINR: 3749,
    monthlyMinutes: "600 Voice Mins / mo",
    monthlyLeads: "1,500 Discovered Leads",
    concurrentCalls: "1 Autonomous Agent",
    languages: "Hindi + English",
    features: [
      "AI Social Intent Radar (LinkedIn & X)",
      "Deep profile enrichment (Email & Phone)",
      "1 Multilingual voice agent persona",
      "Sub-150ms speech turn-taking latency",
      "Pre-built objection resolution scripts",
      "Standard CSV & Webhook CRM export",
      "Community & Discord support",
    ],
    ctaLabel: "Start 14-Day Free Trial",
    ctaTone: "outline",
  },
  {
    id: "pro",
    name: "Autonomous Pro",
    badge: "MOST POPULAR · 4.2x ROI",
    isPopular: true,
    tagline:
      "For scaling B2B sales teams replacing manual cold calling with autonomous voice fleets.",
    monthlyPriceINR: 18999,
    annualPriceINR: 14249,
    monthlyMinutes: "3,500 Voice Mins / mo",
    monthlyLeads: "8,000 Discovered Leads",
    concurrentCalls: "4 Concurrent Agents",
    languages: "14+ Native Dialects (Hindi, Gujarati, English, Spanish, Tamil)",
    features: [
      "40+ Active public data nodes scanned 24/7",
      "Full MX, phone & headcount verification",
      "4 Concurrent consultative voice agents",
      "Custom voice tone, pitch & pacing tuning",
      "Dynamic objection handling & sentiment scoring",
      "Bidirectional HubSpot & Salesforce sync",
      "Automatic meeting confirmation & calendar booking",
      "DNC list suppression & compliance audit logs",
      "Priority WhatsApp & Slack support",
    ],
    ctaLabel: "Deploy Autonomous Fleet",
    ctaTone: "lime",
  },
  {
    id: "enterprise",
    name: "Enterprise Mesh",
    badge: "UNLIMITED SCALE",
    tagline: "For high-volume enterprises, telecom fleets, and custom LLM sales pipelines.",
    monthlyPriceINR: 54999,
    annualPriceINR: 41249,
    monthlyMinutes: "12,000+ Voice Mins / mo",
    monthlyLeads: "Unlimited Lead Discovery",
    concurrentCalls: "16+ Concurrent Agents",
    languages: "All Global Dialects + Custom Voice Cloning",
    features: [
      "Dedicated high-speed SIP trunking & PSTN lines",
      "Custom synthetic voice cloning for brand ambassadors",
      "Fine-tuned domain LLMs on your sales playbooks",
      "Multi-tenant workspace with role-based policies",
      "Real-time call transcription & sentiment telemetry",
      "Custom webhook integrations (Snowflake/BigQuery)",
      "99.99% guaranteed SLA & dedicated infrastructure",
      "Dedicated Solutions Architect & 24/7 priority hotline",
    ],
    ctaLabel: "Schedule Architecture Review",
    ctaTone: "primary",
  },
];

const FAQS = [
  {
    q: "How does the 14-day free trial work?",
    a: "You get full access to the Growth Radar plan with 100 free voice minutes and 250 enriched leads immediately upon signing up. No credit card is required to test.",
  },
  {
    q: "What happens if we exceed our monthly voice minutes?",
    a: "Additional minutes are billed at an affordable pay-as-you-go rate (₹3.50/min or $0.04/min). Your campaigns never pause unexpectedly.",
  },
  {
    q: "Can the AI voice agents speak Gujarati and Hindi fluently?",
    a: "Yes! VYAPERI X voice agents (like Dhruv, Saanvi, and Pooja) are trained on native conversational idioms, business formalities (जैसे 'Ananya जी', 'Bharat भाई'), and regional terminology to sound authentically human.",
  },
  {
    q: "How does VYAPERI X ensure Zero-Spam compliance?",
    a: "Every lead passes through automated DNC list suppression, opt-out registries, and calling window regulations (policy PB-05) before any outbound dial is initiated.",
  },
  {
    q: "Can we connect our existing Twilio or SIP phone numbers?",
    a: "Yes. On the Autonomous Pro and Enterprise Mesh plans, you can bring your own SIP trunks or Twilio/Exotel credentials seamlessly.",
  },
];

function PricingPage() {
  const [annualBilling, setAnnualBilling] = useState(true);
  const [currency, setCurrency] = useState<Currency>("INR");
  const [targetLeads, setTargetLeads] = useState(5000);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  // Dynamic calculations based on target leads slider
  const humanSdrCostMonthlyINR = Math.round((targetLeads / 1000) * 45000);
  const vyaperiCostMonthlyINR = targetLeads <= 2000 ? 4999 : targetLeads <= 10000 ? 18999 : 54999;
  const netSavingsMonthlyINR = humanSdrCostMonthlyINR - vyaperiCostMonthlyINR;
  const savingsPct = Math.round((netSavingsMonthlyINR / humanSdrCostMonthlyINR) * 100);
  const estimatedMeetings = Math.round((targetLeads * 0.61 * 0.22) / 10);

  const formatPrice = (priceINR: number) => {
    const rate = CURRENCY_RATES[currency];
    const converted = priceINR * rate;
    const symbol = CURRENCY_SYMBOLS[currency];

    if (currency === "INR") {
      return `${symbol}${priceINR.toLocaleString("en-IN")}`;
    }
    return `${symbol}${Math.round(converted).toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-paper text-ink transition-colors duration-300 relative selection:bg-lime selection:text-ink">
      <SiteHeader />

      {/* ── HERO BANNER ── */}
      <section className="border-b border-ink/20 py-16 lg:py-24 overflow-hidden relative">
        <div className="grid-paper absolute inset-0 opacity-15 pointer-events-none" />

        <div className="mx-auto max-w-[1400px] px-4 lg:px-8 relative z-10 text-center space-y-6">
          <ScrollReveal variant="fade-down">
            <div className="inline-flex items-center gap-2 border border-ink bg-card px-3 py-1.5 label-mono shadow-sm">
              <span className="h-2 w-2 rounded-full bg-lime live-dot" />
              <span>Transparent Autonomous Pricing · No Hidden Fees</span>
            </div>
          </ScrollReveal>

          <ScrollReveal variant="fade-up" delay={100}>
            <h1 className="font-display text-[clamp(2.5rem,7vw,5.5rem)] font-extrabold leading-[0.9] tracking-tight uppercase">
              Autonomous Sales.
              <br />
              <span className="text-violet">Fraction of SDR Cost.</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal variant="fade-up" delay={200}>
            <p className="max-w-2xl mx-auto font-mono text-sm sm:text-base text-muted-foreground leading-relaxed">
              Deploy multilingual AI voice agents that discover buying intent, resolve phone
              numbers, and book meetings on your calendar 24/7.
            </p>
          </ScrollReveal>

          {/* Billing Frequency & Currency Switcher Cluster */}
          <ScrollReveal variant="fade-up" delay={300}>
            <div className="pt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              {/* Monthly vs Annual Toggle */}
              <div className="flex items-center border-2 border-ink bg-card p-1 shadow-md">
                <button
                  onClick={() => setAnnualBilling(false)}
                  className={`px-4 py-2 font-mono text-xs font-bold transition-all ${
                    !annualBilling ? "bg-ink text-paper" : "text-ink hover:text-violet"
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  onClick={() => setAnnualBilling(true)}
                  className={`px-4 py-2 font-mono text-xs font-bold transition-all flex items-center gap-1.5 ${
                    annualBilling ? "bg-violet text-white" : "text-ink hover:text-violet"
                  }`}
                >
                  <span>Annual Billing</span>
                  <span className="bg-lime text-black px-1.5 py-0.5 text-[10px] font-extrabold uppercase">
                    Save 25%
                  </span>
                </button>
              </div>

              {/* Currency Selector */}
              <div className="flex items-center border border-ink/30 bg-card p-1 shadow-sm font-mono text-xs">
                {(["INR", "USD", "EUR", "AED"] as Currency[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`px-2.5 py-1.5 font-bold transition-all ${
                      currency === c
                        ? "bg-lime text-black font-extrabold border border-lime shadow-sm"
                        : "text-muted-foreground hover:text-ink"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── 3 GRAPHICAL TIER CARDS ── */}
      <section className="border-b border-ink/20 py-16 lg:py-20">
        <div className="mx-auto max-w-[1400px] px-4 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3 items-stretch">
            {PLANS.map((plan, idx) => {
              const price = annualBilling ? plan.annualPriceINR : plan.monthlyPriceINR;

              return (
                <ScrollReveal key={plan.id} variant="fade-up" delay={idx * 120} className="h-full">
                  <div
                    className={`relative flex flex-col justify-between h-full p-7 sm:p-8 bg-card border-2 transition-all duration-300 shadow-xl ${
                      plan.isPopular
                        ? "border-violet ring-2 ring-violet/40 shadow-[0_8px_30px_rgba(139,92,246,0.25)] lg:-translate-y-2 bg-gradient-to-b from-card via-card to-violet/5"
                        : "border-ink hover:border-violet/60"
                    }`}
                  >
                    {/* Popular Badge */}
                    {plan.badge && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                        <span className="border border-ink bg-lime px-3 py-1 font-mono text-[10px] font-extrabold text-black uppercase shadow-md flex items-center gap-1.5 whitespace-nowrap">
                          <Sparkles className="h-3 w-3 fill-current" />
                          {plan.badge}
                        </span>
                      </div>
                    )}

                    <div>
                      {/* Plan Header */}
                      <div className="flex items-center justify-between border-b border-border pb-4">
                        <div>
                          <h3 className="font-display text-2xl font-extrabold text-ink">
                            {plan.name}
                          </h3>
                          <p className="font-mono text-xs text-muted-foreground mt-1 line-clamp-2">
                            {plan.tagline}
                          </p>
                        </div>
                      </div>

                      {/* Pricing Block */}
                      <div className="my-6 border-b border-border pb-6">
                        <div className="flex items-baseline gap-1">
                          <span className="font-display text-4xl sm:text-5xl font-extrabold text-ink tracking-tight">
                            {formatPrice(price)}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground font-semibold">
                            / month
                          </span>
                        </div>
                        {annualBilling && (
                          <div className="mt-1 font-mono text-[11px] text-emerald-700 dark:text-lime font-bold">
                            Billed annually ({formatPrice(price * 12)}/yr) · 2 Months Free
                          </div>
                        )}
                      </div>

                      {/* Core Capacity Highlights */}
                      <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/50 border border-border/80 font-mono text-xs mb-6">
                        <div>
                          <div className="text-[10px] text-muted-foreground">Voice Capacity:</div>
                          <div className="font-bold text-ink truncate">{plan.monthlyMinutes}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">Lead Radar:</div>
                          <div className="font-bold text-violet truncate">{plan.monthlyLeads}</div>
                        </div>
                        <div className="col-span-2 pt-2 border-t border-border/40">
                          <div className="text-[10px] text-muted-foreground">Dialect Engine:</div>
                          <div className="font-bold text-emerald-700 dark:text-lime truncate">
                            {plan.languages}
                          </div>
                        </div>
                      </div>

                      {/* Features List */}
                      <div className="space-y-3 font-mono text-xs mb-8">
                        <div className="label-mono text-[10px] text-muted-foreground uppercase">
                          Included Capabilities:
                        </div>
                        {plan.features.map((feat) => (
                          <div
                            key={feat}
                            className="flex items-start gap-2.5 leading-relaxed text-ink/90"
                          >
                            <span className="h-4 w-4 rounded-full bg-lime/20 text-emerald-700 dark:text-lime flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                              ✓
                            </span>
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CTA Button */}
                    <Link
                      to="/login"
                      className={`flex items-center justify-center gap-2 w-full py-3.5 sm:py-4 font-mono text-xs font-bold uppercase transition-all shadow-md active:scale-95 border-2 ${
                        plan.ctaTone === "lime"
                          ? "bg-lime text-black font-extrabold border-ink hover:bg-ink hover:text-paper"
                          : plan.ctaTone === "primary"
                            ? "bg-ink text-paper border-ink hover:bg-violet hover:border-violet"
                            : "bg-paper text-ink border-ink hover:bg-secondary"
                      }`}
                    >
                      <span>{plan.ctaLabel}</span>
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Link>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── LIVE INTERACTIVE SAVINGS & ROI SIMULATOR ── */}
      <section className="border-b border-ink/20 py-16 lg:py-20 bg-secondary/30">
        <div className="mx-auto max-w-[1400px] px-4 lg:px-8 space-y-8">
          <ScrollReveal variant="fade-up">
            <SectionHead index="01" title="Interactive Cost Savings & Capacity Calculator">
              <span className="label-mono text-muted-foreground">
                Live Human SDR vs VYAPERI X Simulation
              </span>
            </SectionHead>
          </ScrollReveal>

          <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr] items-center">
            {/* Interactive Slider Input Box */}
            <ScrollReveal variant="fade-right">
              <div className="border-2 border-ink bg-card p-6 sm:p-8 space-y-6 shadow-xl">
                <div className="space-y-3">
                  <div className="flex justify-between font-mono text-sm">
                    <span className="font-bold">Target Leads Needed / Month:</span>
                    <span className="text-violet font-extrabold text-base sm:text-lg">
                      {targetLeads.toLocaleString()} Leads
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="25000"
                    step="1000"
                    value={targetLeads}
                    onChange={(e) => setTargetLeads(Number(e.target.value))}
                    className="w-full accent-violet cursor-pointer h-2 bg-paper border border-border"
                  />
                  <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                    <span>1,000 Leads</span>
                    <span>12,500 Leads</span>
                    <span>25,000+ Leads</span>
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimated Monthly Meetings:</span>
                    <span className="text-emerald-700 dark:text-lime font-bold text-sm">
                      ~{estimatedMeetings} Qualified Bookings
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Equivalent Human SDRs Needed:</span>
                    <span className="font-bold text-ink">
                      {Math.max(1, Math.round(targetLeads / 1800))} Full-Time Reps
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recommended Plan:</span>
                    <span className="text-violet font-extrabold">
                      {targetLeads <= 2000
                        ? "Growth Radar"
                        : targetLeads <= 10000
                          ? "Autonomous Pro"
                          : "Enterprise Mesh"}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-paper border border-border font-mono text-[11px] text-muted-foreground leading-relaxed">
                  💡 <strong className="text-ink">ROI Guarantee:</strong> VYAPERI X agents dial 24/7
                  with zero turnover, sub-150ms latency, and 14 native Indian/global dialects.
                </div>
              </div>
            </ScrollReveal>

            {/* Visual Holographic ROI Comparison Matrix */}
            <ScrollReveal variant="fade-left" delay={150}>
              <div className="border-2 border-ink bg-card p-6 sm:p-8 space-y-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <span className="label-mono text-xs text-muted-foreground">
                    Monthly Cost Comparison
                  </span>
                  <Tag tone="lime">{savingsPct}% NET SAVINGS</Tag>
                </div>

                <div className="space-y-4 font-mono">
                  {/* Traditional SDR Cost Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" /> Traditional Human SDR Team
                      </span>
                      <span className="font-extrabold text-danger">
                        {formatPrice(humanSdrCostMonthlyINR)}/mo
                      </span>
                    </div>
                    <div className="h-5 w-full bg-secondary border border-border overflow-hidden">
                      <div className="h-full bg-danger/80 w-full transition-all duration-500" />
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      *Includes salary, payroll taxes, phone dialer tools, and management overhead
                    </div>
                  </div>

                  {/* VYAPERI X Cost Bar */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-ink font-bold flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-lime fill-current" /> VYAPERI X Autonomous
                        AI
                      </span>
                      <span className="font-extrabold text-emerald-700 dark:text-lime">
                        {formatPrice(vyaperiCostMonthlyINR)}/mo
                      </span>
                    </div>
                    <div className="h-5 w-full bg-secondary border border-border overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet via-lime to-emerald-500 transition-all duration-500"
                        style={{
                          width: `${Math.max(8, (vyaperiCostMonthlyINR / humanSdrCostMonthlyINR) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Net Savings Callout Card */}
                <div className="border-2 border-emerald-600 dark:border-lime bg-lime/10 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="label-mono text-[10px] text-emerald-800 dark:text-lime font-extrabold uppercase">
                      Annual Net Capital Preserved:
                    </div>
                    <div className="font-display text-2xl sm:text-3xl font-extrabold text-emerald-900 dark:text-lime">
                      {formatPrice(netSavingsMonthlyINR * 12)} / year
                    </div>
                  </div>
                  <Link
                    to="/login"
                    className="border border-ink bg-ink text-paper px-4 py-2.5 font-mono text-xs font-bold uppercase hover:bg-violet hover:border-violet transition-all active:scale-95 shadow"
                  >
                    Lock In Savings ➔
                  </Link>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── METRIC COMPARISON TABLE ── */}
      <section className="border-b border-ink/20 py-16 lg:py-20">
        <div className="mx-auto max-w-[1400px] px-4 lg:px-8 space-y-8">
          <ScrollReveal variant="fade-up">
            <SectionHead index="02" title="Side-by-Side Operational Benchmarks">
              <span className="label-mono text-muted-foreground">
                Why AI Outperforms Traditional Sales Models
              </span>
            </SectionHead>
          </ScrollReveal>

          <ScrollReveal variant="fade-up" delay={150}>
            <div className="border-2 border-ink bg-card shadow-xl overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-ink bg-secondary">
                    <th className="p-4 font-display text-xs font-extrabold uppercase">
                      Metric / Capability
                    </th>
                    <th className="p-4 font-display text-xs font-extrabold uppercase text-muted-foreground">
                      Traditional Outbound SDR
                    </th>
                    <th className="p-4 font-display text-xs font-extrabold uppercase text-violet bg-violet/10">
                      VYAPERI X AI Mesh
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    [
                      "Speed to Lead Response",
                      "4.5 Hours average",
                      "< 150 milliseconds instantaneous",
                    ],
                    [
                      "Dialing Capacity / Day",
                      "45 - 60 manual dials",
                      "1,200+ autonomous dials / agent",
                    ],
                    [
                      "Supported Dialects",
                      "1 - 2 languages per SDR",
                      "14+ Native Indian & Global dialects",
                    ],
                    [
                      "Turnover & Hiring Latency",
                      "3.2 Months to ramp",
                      "Instant zero-touch deployment",
                    ],
                    ["Average Connect Rate", "32% (cold list)", "61% (in-market intent verified)"],
                    ["Cost per Qualified Booking", "₹4,200 ($50+)", "₹180 ($2.15 average)"],
                    ["Active Operating Hours", "8 Hours / day (Mon-Fri)", "24/7/365 uninterrupted"],
                  ].map(([feature, human, ai], i) => (
                    <tr key={feature} className={i % 2 === 0 ? "bg-paper/40" : "bg-card"}>
                      <td className="p-4 font-bold text-ink">{feature}</td>
                      <td className="p-4 text-muted-foreground">{human}</td>
                      <td className="p-4 font-extrabold text-emerald-700 dark:text-lime bg-violet/5 flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-600 dark:text-lime shrink-0" />
                        <span>{ai}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── FAQ ACCORDION ── */}
      <section className="border-b border-ink/20 py-16 lg:py-20 bg-secondary/20">
        <div className="mx-auto max-w-[1000px] px-4 lg:px-8 space-y-8">
          <ScrollReveal variant="fade-up">
            <div className="text-center space-y-3">
              <span className="label-mono text-violet font-bold">Frequently Asked Questions</span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight">
                Everything You Need to Know
              </h2>
            </div>
          </ScrollReveal>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isExpanded = expandedFaq === idx;

              return (
                <ScrollReveal key={faq.q} variant="fade-up" delay={idx * 60}>
                  <div className="border border-ink bg-card transition-colors">
                    <button
                      onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                      className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-display text-sm sm:text-base font-bold text-ink hover:text-violet transition-colors"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-violet transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-5 sm:px-5 font-mono text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-3 fade-in">
                        {faq.a}
                      </div>
                    )}
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HACKATHON ENTERPRISE CTA ── */}
      <section className="border-b border-ink/20 py-16 lg:py-24 bg-paper overflow-hidden relative">
        <div className="mx-auto max-w-[1200px] px-4 lg:px-8">
          <ScrollReveal variant="zoom-in">
            <div className="border-2 border-ink bg-card p-8 sm:p-14 shadow-2xl space-y-6 text-center relative overflow-hidden">
              <div className="grid-paper absolute inset-0 opacity-15 pointer-events-none" />

              <div className="relative z-10 space-y-4 max-w-2xl mx-auto">
                <span className="label-mono text-violet font-extrabold">
                  Instant Cloud Provisioning
                </span>
                <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight leading-[0.9]">
                  Scale Your Pipeline
                  <br />
                  <span className="text-black bg-lime font-extrabold px-2">With Zero Risk</span>
                </h2>
                <p className="font-mono text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Start your 14-day free trial today. Connect your CRM, deploy your first
                  multilingual voice agent, and discover high-intent prospects in under 3 minutes.
                </p>

                <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
                  <Link
                    to="/login"
                    className="group inline-flex items-center gap-3 border-2 border-ink bg-ink px-7 py-4 font-mono text-xs sm:text-sm font-extrabold text-paper uppercase transition-all hover:bg-violet hover:border-violet active:scale-95 shadow-xl"
                  >
                    Start 14-Day Free Trial
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                  <Link
                    to="/dashboard/simulation"
                    className="inline-flex items-center gap-2 border-2 border-ink bg-paper px-6 py-4 font-mono text-xs sm:text-sm font-bold uppercase hover:bg-secondary transition-all"
                  >
                    <PhoneCall className="h-4 w-4 text-violet" />
                    Test Voice Simulator
                  </Link>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
