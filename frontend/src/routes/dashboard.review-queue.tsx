import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useApp } from "@/components/app/store";
import { Bar, Btn, PageHead, Panel, Stat, StatGrid, Tag } from "@/components/app/ui";

export const Route = createFileRoute("/dashboard/review-queue")({
  head: () => ({
    meta: [
      { title: "Qualification Review — VYAPERI X Sales Console" },
      {
        name: "description",
        content:
          "Human-in-the-loop queue for product validations, high-value enterprise leads and compliance items requiring approval before AI calling.",
      },
      { property: "og:title", content: "Qualification Review — VYAPERI X Sales Console" },
      {
        property: "og:description",
        content: "Approve or deny AI calling permissions with full context.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QualificationReviewPage,
});

function QualificationReviewPage() {
  const { review, decideReview } = useApp();
  const [tab, setTab] = useState<"pending" | "approved" | "denied">("pending");
  const rows = review.filter((r) => r.status === tab);

  const kindTone = (kind: string): "violet" | "lime" | "danger" => {
    if (kind === "High-value lead") return "lime";
    if (kind === "Compliance") return "danger";
    return "violet";
  };

  return (
    <div className="space-y-8">
      <PageHead
        index="/05"
        title="Qualification Review"
        subtitle="Items requiring human approval before AI calling begins. Nothing proceeds until a decision is recorded."
      />

      <StatGrid>
        <Stat
          label="Pending approval"
          value={String(review.filter((r) => r.status === "pending").length)}
        />
        <Stat
          label="Approved"
          value={String(review.filter((r) => r.status === "approved").length)}
        />
        <Stat label="Denied" value={String(review.filter((r) => r.status === "denied").length)} />
        <Stat label="SLA" value="< 10 min" note="median decision time" />
      </StatGrid>

      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "denied"] as const).map((t) => (
          <Btn key={t} variant={tab === t ? "solid" : "outline"} onClick={() => setTab(t)}>
            {t} ({review.filter((r) => r.status === t).length})
          </Btn>
        ))}
      </div>

      <Panel title={`${tab} items`} hint={`${rows.length} records`}>
        <div className="divide-y divide-ink/10">
          {rows.map((r) => (
            <div
              key={r.id}
              className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <span>{r.id}</span>
                  <span>{r.raised}</span>
                  <Tag tone={kindTone(r.kind)}>{r.kind}</Tag>
                  <Tag tone={r.score > 80 ? "lime" : r.score > 50 ? "violet" : "danger"}>
                    score {r.score}
                  </Tag>
                </div>
                <div className="mt-1 font-display text-sm font-bold uppercase">{r.subject}</div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">{r.detail}</div>
              </div>
              <Bar
                value={r.score}
                tone={r.score > 80 ? "lime" : r.score > 50 ? "violet" : "danger"}
              />
              {r.status === "pending" ? (
                <div className="flex gap-2">
                  <Btn variant="lime" onClick={() => decideReview(r.id, "approved")}>
                    Approve
                  </Btn>
                  <Btn variant="danger" onClick={() => decideReview(r.id, "denied")}>
                    Deny
                  </Btn>
                </div>
              ) : (
                <Tag tone={r.status === "approved" ? "lime" : "danger"}>{r.status}</Tag>
              )}
            </div>
          ))}
          {!rows.length && (
            <p className="py-6 font-mono text-xs text-muted-foreground">// queue empty</p>
          )}
        </div>
      </Panel>

      <div className="border border-ink/20 p-5 font-mono text-xs text-muted-foreground leading-relaxed">
        <div className="label-mono text-ink mb-3">Review triggers</div>
        <ul className="space-y-2">
          {[
            "Product validation — AI confidence below threshold; admin confirms service is suitable for AI selling.",
            "High-value lead — Enterprise prospects (1,000+ employees) require AE approval before any AI call is placed.",
            "Compliance — Phone number matches DNC list or contact consent cannot be confirmed.",
          ].map((t) => (
            <li key={t} className="flex gap-3">
              <span className="text-violet">+</span> {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
