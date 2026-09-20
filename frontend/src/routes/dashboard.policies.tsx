import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/components/app/store";
import { Btn, PageHead, Panel, Stat, StatGrid, Tag } from "@/components/app/ui";

export const Route = createFileRoute("/dashboard/policies")({
  head: () => ({
    meta: [
      { title: "Admin Console — VYAPERI X Sales Console" },
      {
        name: "description",
        content:
          "Manage users, subscriptions, AI voice usage, billing and platform monitoring. Full administrator controls.",
      },
      { property: "og:title", content: "Admin Console — VYAPERI X Sales Console" },
      {
        property: "og:description",
        content: "Platform administration: users, billing, subscription and monitoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminConsolePage,
});

const PLAN_TONE = (plan: string): "lime" | "violet" | "muted" => {
  if (plan === "Enterprise") return "lime";
  if (plan === "Growth") return "violet";
  return "muted";
};

const ROLE_TONE = (role: string): "lime" | "violet" | "muted" => {
  if (role === "Owner") return "lime";
  if (role === "Sales Manager") return "violet";
  return "muted";
};

function AdminConsolePage() {
  const { users, toggleUser, audit } = useApp();

  const active = users.filter((u) => u.status === "active").length;
  const totalMinutes = users.reduce((s, u) => s + u.minutes, 0);

  return (
    <div className="space-y-8">
      <PageHead
        index="/11"
        title="Admin Console"
        subtitle="User management, subscription tracking, AI voice usage and platform security monitoring."
      />

      <StatGrid>
        <Stat label="Active users" value={String(active)} note={`of ${users.length} total`} />
        <Stat
          label="Total voice minutes"
          value={totalMinutes.toLocaleString()}
          note="across all users"
        />
        <Stat
          label="Subscriptions"
          value={String(new Set(users.map((u) => u.plan)).size)}
          note="plan tiers active"
        />
        <Stat
          label="Security events"
          value={String(audit.filter((a) => a.tone === "bad").length)}
          note="last 24h"
        />
      </StatGrid>

      <Panel title="User management" hint={`${users.length} users`}>
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-ink/20">
                {["User", "Role", "Plan", "Voice minutes", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="pb-3 pr-4 text-left label-mono text-muted-foreground whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-secondary/40 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="font-bold text-ink whitespace-nowrap">{u.name}</div>
                    <div className="text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <Tag tone={ROLE_TONE(u.role)}>{u.role}</Tag>
                  </td>
                  <td className="py-3 pr-4">
                    <Tag tone={PLAN_TONE(u.plan)}>{u.plan}</Tag>
                  </td>
                  <td className="py-3 pr-4">{u.minutes.toLocaleString()}</td>
                  <td className="py-3 pr-4">
                    <Tag tone={u.status === "active" ? "lime" : "danger"}>{u.status}</Tag>
                  </td>
                  <td className="py-3">
                    <Btn
                      variant={u.status === "active" ? "outline" : "lime"}
                      onClick={() => toggleUser(u.id)}
                    >
                      {u.status === "active" ? "Suspend" : "Activate"}
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-8 lg:grid-cols-2">
        <Panel title="Subscription tiers">
          <div className="space-y-4">
            {[
              {
                plan: "Starter",
                price: "₹4,999/mo",
                features: ["500 contacts", "1,000 AI minutes", "2 voice agents", "3 integrations"],
              },
              {
                plan: "Growth",
                price: "₹14,999/mo",
                features: [
                  "5,000 contacts",
                  "10,000 AI minutes",
                  "5 voice agents",
                  "All integrations",
                ],
              },
              {
                plan: "Enterprise",
                price: "Custom",
                features: [
                  "Unlimited contacts",
                  "Unlimited AI minutes",
                  "Unlimited agents",
                  "Dedicated support",
                ],
              },
            ].map(({ plan, price, features }) => (
              <div key={plan} className="border border-ink/20 p-4">
                <div className="flex items-center justify-between">
                  <Tag tone={PLAN_TONE(plan)}>{plan}</Tag>
                  <span className="font-display text-sm font-extrabold">{price}</span>
                </div>
                <ul className="mt-3 space-y-1">
                  {features.map((f) => (
                    <li key={f} className="flex gap-2 font-mono text-[11px] text-muted-foreground">
                      <span className="text-violet">+</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Audit log" hint="recent activity">
          <div className="divide-y divide-ink/10">
            {audit.map((a) => (
              <div key={a.id} className="py-3 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{a.ts}</span>
                  <Tag tone={a.tone === "ok" ? "lime" : a.tone === "warn" ? "violet" : "danger"}>
                    {a.tone}
                  </Tag>
                </div>
                <div className="mt-1 text-muted-foreground">{a.actor}</div>
                <div className="mt-0.5 text-ink">{a.action}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
