import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/components/app/store";
import { Bar, PageHead, Panel, Stat, StatGrid, Tag } from "@/components/app/ui";

export const Route = createFileRoute("/dashboard/delegation-audit")({
  head: () => ({
    meta: [
      { title: "Market Intelligence — VYAPERI X Sales Console" },
      {
        name: "description",
        content:
          "Real-time funding, hiring, technology stack and competitor signals for your prospect universe.",
      },
      { property: "og:title", content: "Market Intelligence — VYAPERI X Sales Console" },
      {
        property: "og:description",
        content:
          "Act on funding rounds, hiring surges and competitor-switch signals before anyone else.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketIntelligencePage,
});

const SIGNAL_TONE = (type: string): "lime" | "violet" | "danger" | "muted" => {
  if (type === "Funding") return "lime";
  if (type === "Hiring") return "violet";
  if (type === "Competitor") return "danger";
  return "muted";
};

function MarketIntelligencePage() {
  const { signals } = useApp();

  return (
    <div className="space-y-8">
      <PageHead
        index="/03"
        title="Market Intelligence"
        subtitle="Funding rounds, hiring surges, tech-stack changes and competitor-switch signals — updated continuously."
      />

      <StatGrid>
        <Stat label="Active signals" value={String(signals.length + 38)} note="last 30 days" />
        <Stat
          label="Funding events"
          value={String(signals.filter((s) => s.type === "Funding").length + 9)}
          note="high-budget expansion"
        />
        <Stat
          label="Hiring surges"
          value={String(signals.filter((s) => s.type === "Hiring").length + 14)}
          note="intent to buy headcount"
        />
        <Stat
          label="Competitor alerts"
          value={String(signals.filter((s) => s.type === "Competitor").length + 8)}
          note="act fast"
        />
      </StatGrid>

      <Panel title="Signal feed" hint={`${signals.length} recent signals`}>
        <div className="divide-y divide-ink/10">
          {signals.map((s) => (
            <div
              key={s.id}
              className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <span>{s.id}</span>
                  <span>{s.date}</span>
                  <Tag tone={SIGNAL_TONE(s.type)}>{s.type}</Tag>
                </div>
                <div className="mt-1 font-display text-sm font-bold uppercase">{s.company}</div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">{s.detail}</div>
              </div>
              <div>
                <div className="flex items-baseline justify-between font-mono text-[11px]">
                  <span className="label-mono text-muted-foreground">impact</span>
                  <span>{s.impact}</span>
                </div>
                <div className="mt-2">
                  <Bar
                    value={s.impact}
                    tone={s.impact > 75 ? "lime" : s.impact > 50 ? "violet" : "danger"}
                  />
                </div>
              </div>
              <div className="shrink-0">
                <span className="border border-ink px-3 py-2 label-mono hover:bg-secondary cursor-pointer transition-colors">
                  Add to pipeline
                </span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-8 lg:grid-cols-3">
        {[
          {
            type: "Funding",
            label: "Budget expansion signals",
            desc: "Companies that recently closed a funding round typically expand headcount and technology budgets within 60 days.",
          },
          {
            type: "Hiring",
            label: "Hiring surge = buying intent",
            desc: "A surge in hiring for specific technical or operational roles is a leading indicator of new technology procurement.",
          },
          {
            type: "Competitor",
            label: "Competitor-switch window",
            desc: "Prospects actively evaluating or mentioning competitors are in an active buying cycle — the highest-urgency signal.",
          },
        ].map(({ type, label, desc }) => (
          <div key={type} className="border border-ink/20 p-5">
            <Tag tone={SIGNAL_TONE(type)}>{type}</Tag>
            <h3 className="mt-4 font-display text-sm font-extrabold uppercase">{label}</h3>
            <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
