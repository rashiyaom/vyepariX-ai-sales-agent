import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Sparkles, Lock, LogOut, Plus } from "lucide-react";
import { Logo } from "@/components/site/Chrome";
import { LeadRadarModule } from "@/components/modules/radar";
import { VoiceFleetModule } from "@/components/modules/voice";
import { AnalyticsModule } from "@/components/modules/analytics";
import { SettingsModule } from "@/components/modules/settings";
import { MODULE_REGISTRY } from "@/modules/registry";
import {
  IntelligenceSuiteModule,
  getCleanReportTitle,
} from "@/components/modules/scraper/IntelligenceSuiteModule";
import type { RecentReport, FullAnalysis, ReportData } from "@/components/modules/scraper/IntelligenceSuiteModule";

const API_BASE = (import.meta.env["VITE_SCRAPER_API_BASE"] as string) || "http://localhost:8000";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "VYAPERI X — Autonomous Intelligence Dashboard" },
      { name: "description", content: "VYAPERI X AI Intelligence Suite, Lead Radar & Voice Fleet Dashboard." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const { user, profile, session, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeNav, setActiveNav] = useState("intelligence");
  const [voiceTargetLead, setVoiceTargetLead] = useState<any>(null);
  const [reportId, setReportId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("reportId");
    }
    return null;
  });
  const [view, setView] = useState<"intake" | "report">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reportId")) return "report";
    }
    return "intake";
  });
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [activeAnalysis, setActiveAnalysis] = useState<FullAnalysis | null>(null);
  const [activeCompanyInfo, setActiveCompanyInfo] = useState<{ name: string; industry: string; score: number }>({
    name: "",
    industry: "",
    score: 0,
  });
  const [time, setTime] = useState("--:--:--");
  const [greeting, setGreeting] = useState<{ company?: string }>({});

  const hasCompletedReport =
    recentReports.some((r) => r.status === "done") || view === "report";

  useEffect(() => {
    const tick = () => setTime(new Date().toISOString().slice(11, 19));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      if (profile?.company_name) {
        setActiveCompanyInfo((prev) => ({ ...prev, name: profile.company_name! }));
      }
      const stored = sessionStorage.getItem("vyaperi_onboarding");
      if (stored) {
        const parsed = JSON.parse(stored);
        setGreeting(parsed);
        if (parsed.company) {
          setActiveCompanyInfo((prev) => ({ ...prev, name: parsed.company }));
        }
      }
    } catch {}
    fetchRecents();
  }, [user]);

  const fetchRecents = async () => {
    try {
      const url = user?.id ? `${API_BASE}/api/reports?user_id=${user.id}` : `${API_BASE}/api/reports`;
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setRecentReports(data);
        const latestDone = data.find((r: any) => r.status === "done" && r.analysis?.company_name);
        if (latestDone) {
          setActiveCompanyInfo({
            name: latestDone.analysis.company_name,
            industry: latestDone.analysis.industry || "B2B Tech",
            score: latestDone.analysis.opportunity_score || 88,
          });
          setActiveAnalysis(latestDone.analysis);
        }
      }
    } catch {}
  };

  const handleNewAnalysis = () => {
    setView("intake");
    setReportId(null);
    try { window.history.replaceState(null, "", "/dashboard"); } catch {}
  };

  const handleReportCreated = (id: string) => {
    setReportId(id);
    setView("report");
    try { window.history.replaceState(null, "", `/dashboard?reportId=${id}`); } catch {}
    fetchRecents();
  };

  const handleReportFinished = (reportData: ReportData) => {
    if (reportData.analysis) {
      setActiveAnalysis(reportData.analysis);
      setActiveCompanyInfo({
        name: reportData.analysis.company_name,
        industry: reportData.analysis.industry || "B2B Tech",
        score: reportData.analysis.opportunity_score || 88,
      });
    }
    fetchRecents();
  };

  const handleSelectReport = (r: RecentReport) => {
    setReportId(r.id);
    setView("report");
    try { window.history.replaceState(null, "", `/dashboard?reportId=${r.id}`); } catch {}
    if (r.analysis) {
      setActiveAnalysis(r.analysis as FullAnalysis);
      if (r.analysis.company_name) {
        setActiveCompanyInfo({
          name: r.analysis.company_name,
          industry: r.analysis.industry || "B2B Tech",
          score: r.analysis.opportunity_score || 88,
        });
      }
    }
  };

  const handleNavigateModule = (moduleId: string) => setActiveNav(moduleId);

  const navItems = MODULE_REGISTRY.map((mod) => ({
    ...mod,
    isUnlocked: mod.id === "intelligence" || hasCompletedReport,
  }));

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col selection:bg-lime selection:text-ink">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-50 border-b border-ink/20 bg-paper/95 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3 gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="border border-ink/20 bg-secondary p-2 hover:border-violet transition-colors"
            >
              {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <Logo />
          </div>
          <div className="flex items-center gap-4">
            {hasCompletedReport ? (
              <div className="hidden sm:flex items-center gap-2 border border-lime/40 bg-lime/10 px-3 py-1 text-lime-700 dark:text-lime label-mono text-[10px] font-bold">
                <Sparkles className="w-3 h-3" /> ALL MODULES UNLOCKED
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2 border border-ink/20 px-3 py-1 label-mono text-[10px] text-muted-foreground">
                <Lock className="w-3 h-3" /> Finish 1 Report to Unlock All
              </div>
            )}
            {greeting.company && (
              <span className="hidden md:block font-mono text-xs text-muted-foreground">
                Workspace: <span className="text-ink font-bold">{greeting.company}</span>
              </span>
            )}
            <div className="hidden sm:block border border-ink/20 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
              <div>SYS.TIME</div>
              <div className="text-ink">{time}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 bg-lime live-dot" />
              <span className="label-mono text-muted-foreground text-[10px]">All Systems Operational</span>
            </div>
            {user && (
              <div className="flex items-center gap-2 border-l border-ink/20 pl-3">
                <div className="hidden lg:flex flex-col text-right">
                  <span className="font-mono text-[10px] font-bold text-ink truncate max-w-[140px]">
                    {profile?.full_name || user.email?.split("@")[0]}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground truncate max-w-[140px]">
                    {profile?.company_name || user.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/login" });
                  }}
                  title="Sign Out of Supabase Workspace"
                  className="border border-ink/20 bg-secondary/50 p-1.5 hover:border-danger hover:text-danger hover:bg-danger/10 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside
          className={`${
            sidebarOpen ? "w-60" : "w-14"
          } shrink-0 border-r border-ink/20 bg-secondary/20 flex flex-col transition-all duration-200 overflow-hidden`}
        >
          <nav className="flex-1 p-2 space-y-1 pt-4">
            {navItems.map((item) => {
              const isActive = activeNav === item.id;
              const isUnlocked = item.isUnlocked;
              return (
                <button
                  key={item.id}
                  onClick={() => { if (isUnlocked) setActiveNav(item.id); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 transition-all group ${
                    isActive
                      ? "border border-violet/40 bg-violet/10 text-violet font-bold"
                      : isUnlocked
                      ? "border border-transparent text-muted-foreground hover:border-ink/20 hover:text-ink hover:bg-secondary"
                      : "border border-transparent text-ink/25 cursor-not-allowed opacity-60"
                  }`}
                >
                  <item.icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive
                        ? "text-violet"
                        : isUnlocked
                        ? "text-muted-foreground group-hover:text-ink"
                        : "text-ink/20"
                    }`}
                  />
                  {sidebarOpen && (
                    <div className="flex-1 flex items-center justify-between text-left min-w-0">
                      <span className="font-mono text-xs font-medium truncate">{item.label}</span>
                      {isUnlocked && item.id !== "intelligence" && (
                        <span className="label-mono border border-lime/30 bg-lime/10 text-lime-700 dark:text-lime text-[8px] px-1 py-0.2 shrink-0">
                          ACTIVE
                        </span>
                      )}
                      {!isUnlocked && <Lock className="w-3 h-3 text-ink/20 shrink-0" />}
                    </div>
                  )}
                  {sidebarOpen && isActive && <div className="w-1.5 h-1.5 bg-violet rounded-full shrink-0" />}
                </button>
              );
            })}
          </nav>

          {/* Recent Reports Mini-List */}
          {sidebarOpen && recentReports.length > 0 && (
            <div className="border-t border-ink/15 p-3 space-y-2">
              <span className="label-mono text-muted-foreground text-[9px]">Recent Analyses</span>
              {recentReports.slice(0, 4).map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setActiveNav("intelligence");
                    handleSelectReport(r);
                  }}
                  className="w-full text-left border border-transparent hover:border-ink/20 p-2 hover:bg-secondary transition-colors group min-w-0 overflow-hidden"
                >
                  <p className="font-mono text-[10px] font-bold text-ink truncate group-hover:text-violet transition-colors block">
                    {getCleanReportTitle(r)}
                  </p>
                  <p className="label-mono text-muted-foreground truncate text-[9px] block">
                    {r.status} · {r.analysis?.opportunity_score ? `Score: ${r.analysis.opportunity_score}` : ""}
                  </p>
                </button>
              ))}
            </div>
          )}

          {sidebarOpen && (
            <div className="border-t border-ink/15 p-3">
              <Link
                to="/"
                className="label-mono text-muted-foreground hover:text-violet transition-colors flex items-center gap-1.5 text-[10px]"
              >
                ← Back to Landing Page
              </Link>
            </div>
          )}
        </aside>

        {/* ── Main Content Area ── */}
        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="max-w-[1250px] mx-auto p-6 space-y-6">
            {/* 1. Intelligence Suite */}
            {activeNav === "intelligence" && (
              <IntelligenceSuiteModule
                view={view}
                reportId={reportId}
                recentReports={recentReports}
                onReportCreated={handleReportCreated}
                onNewAnalysis={handleNewAnalysis}
                onSelectReport={handleSelectReport}
                onNavigateModule={handleNavigateModule}
                onReportFinished={handleReportFinished}
                onFetchRecents={fetchRecents}
              />
            )}

            {/* 2. Lead Radar */}
            {activeNav === "lead-radar" && (
              <LeadRadarModule
                analysis={activeAnalysis}
                companyName={activeCompanyInfo.name}
                industry={activeCompanyInfo.industry}
                onLaunchVoiceAgent={(lead) => {
                  setVoiceTargetLead(lead);
                  setActiveNav("voice-fleet");
                }}
              />
            )}

            {/* 3. Voice Fleet */}
            {activeNav === "voice-fleet" && (
              <VoiceFleetModule
                analysis={activeAnalysis}
                companyName={activeCompanyInfo.name}
                industry={activeCompanyInfo.industry}
                targetLead={voiceTargetLead}
              />
            )}

            {/* 4. Analytics */}
            {activeNav === "analytics" && (
              <AnalyticsModule
                analysis={activeAnalysis}
                companyName={activeCompanyInfo.name}
                opportunityScore={activeCompanyInfo.score}
              />
            )}

            {/* 5. Settings */}
            {activeNav === "settings" && <SettingsModule companyName={activeCompanyInfo.name} />}
          </div>
        </main>
      </div>
    </div>
  );
}
