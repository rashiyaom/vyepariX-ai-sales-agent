import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Logo } from "@/components/site/Chrome";
import { AppProvider } from "@/components/app/store";
import { LangSwitcher, useLang } from "@/components/app/lang";
import { ThemeToggle } from "@/components/app/theme";
import { LiveDot } from "@/components/app/ui";
import { StaggeredMenu, type MenuItem } from "@/components/app/StaggeredMenu";
import { ChatWidget } from "@/components/rag/ChatWidget";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <AppProvider>
      <DashboardShell />
    </AppProvider>
  );
}

function DashboardShell() {
  const { t } = useLang();
  const location = useLocation();
  const [time, setTime] = useState("--:--:--");
  const [scrolled, setScrolled] = useState(false);
  const [profileConfirmed, setProfileConfirmed] = useState(true);
  const [globalKb, setGlobalKb] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("vyaperi_token") ?? "mock_jwt_token";
    const api = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:5000/api/v1";
    fetch(`${api}/knowledge-bases`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((kbs) => {
        if (Array.isArray(kbs) && kbs.length > 0) {
          setGlobalKb({ id: kbs[0].id, name: kbs[0].name });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const isConfirmed = localStorage.getItem("vyaperi_profile_confirmed") === "true";
    setProfileConfirmed(isConfirmed);
  }, [location.pathname]);

  useEffect(() => {
    const tick = () => setTime(new Date().toISOString().slice(11, 19));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const NAV: { to: string; labelKey: string; group: string; badge?: string }[] = [
    { to: "/onboarding", labelKey: "nav.onboarding", group: "group.discovery", badge: "AI ICP" },
    { to: "/dashboard", labelKey: "nav.overview", group: "group.discovery" },
    {
      to: "/dashboard/inspector",
      labelKey: "nav.discovery",
      group: "group.discovery",
      badge: "Radar",
    },
    { to: "/dashboard/delegation-audit", labelKey: "nav.intel", group: "group.discovery" },
    {
      to: "/dashboard/delegation-demo",
      labelKey: "nav.leads",
      group: "group.pipeline",
      badge: "CSV",
    },
    { to: "/dashboard/review-queue", labelKey: "nav.review", group: "group.pipeline" },
    {
      to: "/dashboard/violations",
      labelKey: "nav.campaigns",
      group: "group.pipeline",
      badge: "SIP",
    },
    { to: "/dashboard/simulation", labelKey: "nav.voice", group: "group.voice", badge: "Fleet" },
    {
      to: "/dashboard/attack-demo",
      labelKey: "nav.livecall",
      group: "group.voice",
      badge: "Studio",
    },
    { to: "/dashboard/identity", labelKey: "nav.analytics", group: "group.analytics" },
    { to: "/dashboard/registry", labelKey: "nav.crm", group: "group.analytics" },
    { to: "/dashboard/policies", labelKey: "nav.admin", group: "group.admin" },
    { to: "/dashboard/rag", labelKey: "nav.knowledgeBase", group: "group.ai", badge: "RAG" },
    { to: "/dashboard/workspace", labelKey: "nav.workspace", group: "group.admin" },
  ];

  const groups = [...new Set(NAV.map((n) => n.group))];

  // Mobile menu items formatted for StaggeredMenu
  const mobileMenuItems: MenuItem[] = NAV.map((item) => ({
    label: t(item.labelKey),
    link: item.to,
    badge: item.badge,
    group: t(item.group),
  }));

  return (
    <div className="min-h-screen bg-paper w-full max-w-full">
      {/* â”€â”€ Top Bar (Guaranteed 0 Horizontal Scroll on Phone) â”€â”€ */}
      <header
        className={`sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-ink transition-all duration-300 px-3 py-2.5 sm:px-6 sm:py-3 lg:px-8 w-full max-w-full ${
          scrolled
            ? "bg-paper/70 dark:bg-[#0D0E14]/75 backdrop-blur-2xl shadow-[0_10px_35px_rgba(0,0,0,0.09)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.5)] dark:border-white/15 py-2"
            : "bg-paper/95 dark:bg-[#0D0E14]/95 backdrop-blur-md"
        }`}
        style={{ WebkitBackdropFilter: scrolled ? "blur(24px)" : "blur(12px)" }}
      >
        <div className="flex shrink-0 items-center gap-3">
          <Logo />
          <span className="hidden border-l border-ink/20 pl-4 label-mono text-muted-foreground md:block">
            {t("header.console")}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          {/* Theme switcher */}
          <ThemeToggle className="p-1 sm:p-2" />

          {/* Language switcher */}
          <LangSwitcher />

          {/* Clock (Desktop) */}
          <div className="hidden border border-ink/20 px-3 py-1.5 font-mono text-[10px] leading-tight text-muted-foreground xl:block">
            <div>SYS.TIME</div>
            <div className="text-ink tabular-nums">{time}</div>
          </div>

          {/* Status badge (Tablet/Desktop) */}
          <span className="hidden items-center gap-2 border border-ink bg-lime px-3 py-2 label-mono text-black font-extrabold sm:inline-flex">
            <span className="h-1.5 w-1.5 bg-black live-dot" />
            {t("header.status")}
          </span>

          {/* Desktop Sign Out */}
          <Link
            to="/login"
            className="hidden sm:inline-flex border border-ink px-3 py-1.5 sm:px-4 sm:py-2 label-mono transition-all hover:bg-secondary active:scale-95 text-xs font-bold whitespace-nowrap"
          >
            {t("header.signout")}
          </Link>

          {/* ðŸ” Mobile Staggered Menu Hamburger (Mobile/Tablet) */}
          <div className="lg:hidden">
            <StaggeredMenu items={mobileMenuItems} isDashboard={true} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[240px_minmax(0,1fr)] w-full">
        {/* â”€â”€ Desktop Sidebar (lg:block) â”€â”€ */}
        <aside className="hidden lg:block border-b border-ink/20 lg:sticky lg:top-[61px] lg:h-[calc(100vh-61px)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          {groups.map((g, gi) => (
            <div
              key={g}
              className="border-b border-ink/15 py-3 fade-in-up"
              style={{ animationDelay: `${gi * 60}ms` }}
            >
              <div className="px-4 pb-2 label-mono text-muted-foreground">{t(g)}</div>
              {NAV.filter((n) => n.group === g).map((n, ni) => (
                <Link
                  key={n.to}
                  to={n.to}
                  activeOptions={{ exact: n.to === "/dashboard" }}
                  activeProps={{
                    className:
                      "block px-4 py-2 font-mono text-xs bg-violet text-violet-foreground border-l-2 border-lime",
                  }}
                  className="block px-4 py-2 font-mono text-xs transition-all hover:bg-secondary hover:pl-5"
                  style={{ animationDelay: `${(gi * 5 + ni) * 40}ms` }}
                >
                  {t(n.labelKey)}
                </Link>
              ))}
            </div>
          ))}

          {/* Sidebar bottom status & upgrade */}
          <div className="px-4 py-5 space-y-3">
            <div className="border border-ink/20 p-3 space-y-2">
              <LiveDot label="Pipeline active" />
              <div className="font-mono text-[10px] text-muted-foreground leading-relaxed">
                AI discovering leads
                <br />
                Voice agents calling
                <br />
                CRM syncing
              </div>
            </div>

            <Link
              to="/pricing"
              className="flex items-center justify-between border border-violet bg-violet/10 hover:bg-violet hover:text-white p-3 font-mono text-xs font-bold text-violet transition-all shadow-sm"
            >
              <span>Upgrade Plan (Save 25%)</span>
              <span className="text-lime">âž”</span>
            </Link>
          </div>
        </aside>

        {/* â”€â”€ Main Content Area â”€â”€ */}
        <main className="min-w-0 px-3 py-6 sm:px-6 sm:py-8 lg:px-8 w-full max-w-full overflow-x-hidden">
          {!profileConfirmed && (
            <div className="mb-6 border-2 border-violet bg-violet/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="p-2 border border-violet bg-violet text-white shrink-0 mt-0.5">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-extrabold text-sm uppercase tracking-wide">
                      First-Time Setup: Business Onboarding Required
                    </span>
                    <span className="px-2 py-0.5 border border-ink bg-lime text-black label-mono text-[9px] font-extrabold">
                      STEP 1
                    </span>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground mt-1 leading-relaxed">
                    Calibrate your AI Business Profile to derive target ICP, core offerings, and high-intent discovery keywords for autonomous calls.
                  </p>
                </div>
              </div>
              <Link
                to="/onboarding"
                className="px-5 py-2.5 border border-ink bg-lime hover:bg-lime/90 text-black font-display font-extrabold text-xs tracking-wider flex items-center gap-2 shadow-sm shrink-0 active:scale-95 transition-transform"
              >
                START ONBOARDING âž”
              </Link>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {/* Global RAG Floating Chat Widget across all dashboard views */}
      {globalKb && location.pathname !== "/dashboard/rag" && (
        <ChatWidget
          key={globalKb.id}
          knowledgeBaseId={globalKb.id}
          knowledgeBaseName={globalKb.name}
          token={typeof window !== "undefined" ? localStorage.getItem("vyaperi_token") ?? "mock_jwt_token" : "mock_jwt_token"}
        />
      )}
    </div>
  );
}

