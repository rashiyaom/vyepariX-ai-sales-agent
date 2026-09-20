/**
 * dashboard.rag.tsx - Knowledge Base Management & Direct AI Chat
 *
 * Clean, refined UX:
 * - Direct AI Chat from any URL (zero workspace setup)
 * - Clean metrics (pages indexed, status) with zero internal technical jargon
 * - Easy Knowledge Base management with delete actions to prevent duplicates
 * - Streamlined onboarding source integration
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Plus, Globe, Trash2, RefreshCw, ChevronDown, ChevronRight, Database, Sparkles, MessageSquare, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PDFUpload } from "@/components/rag/PDFUpload";
import { ChatWidget } from "@/components/rag/ChatWidget";
import { LiveDot } from "@/components/app/ui";

export const Route = createFileRoute("/dashboard/rag")({
  component: RagAdminPage,
});

const API = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:5000/api/v1";
const TOKEN = () => localStorage.getItem("vyaperi_token") ?? "mock_jwt_token";

interface KBSource {
  id: string;
  sourceType: "website" | "pdf";
  url?: string;
  fileName?: string;
  status: string;
  pagesDiscovered: number;
  pagesIndexed: number;
  pagesFailed: number;
  chunksIndexed: number;
  errorMessage?: string;
  lastSuccessfulScan?: string;
  indexedAt?: string;
}

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  sources: KBSource[];
  createdAt: string;
}

function statusBadge(status: string) {
  switch (status) {
    case "ready":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-lime font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-lime inline-block" /> READY
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-destructive inline-block" /> ERROR
        </span>
      );
    case "partial":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-400 font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-400 inline-block" /> PARTIAL
        </span>
      );
    case "indexing":
    case "scraping":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet font-mono animate-pulse">
          <RefreshCw className="h-2.5 w-2.5 animate-spin" /> INDEXING
        </span>
      );
    default:
      return <span className="text-[10px] font-mono text-muted-foreground">{status.toUpperCase()}</span>;
  }
}

export default function RagAdminPage() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [expandedKb, setExpandedKb] = useState<string | null>(null);
  const [urlInputs, setUrlInputs] = useState<Record<string, string>>({});
  const [activeSseKbId, setActiveSseKbId] = useState<string | null>(null);
  const [scanStatusMessage, setScanStatusMessage] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState<Record<string, boolean>>({});

  // Direct instant URL chat state
  const [directUrl, setDirectUrl] = useState("");
  const [directLoading, setDirectLoading] = useState(false);
  const [directStatus, setDirectStatus] = useState<string | null>(null);

  const [onboardingSource, setOnboardingSource] = useState<{
    available: boolean;
    websiteUrl?: string | null;
    documentFileName?: string | null;
    hasDocumentText?: boolean;
    scrapedPagesCount?: number;
  } | null>(null);
  const [syncingOnboarding, setSyncingOnboarding] = useState(false);
  const [selectedKbForChat, setSelectedKbForChat] = useState<KnowledgeBase | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  async function fetchKbs() {
    try {
      const res = await fetch(`${API}/knowledge-bases`, {
        headers: { Authorization: `Bearer ${TOKEN()}` },
      });
      if (res.ok) {
        const data = (await res.json()) as KnowledgeBase[];
        setKbs(data);
        const first = data[0];
        if (!expandedKb && first) setExpandedKb(first.id);
        if (first) setSelectedKbForChat((prev) => prev ?? first);
      }
    } catch (err) {
      console.error("Failed to fetch knowledge bases:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDirectChat(urlToUse?: string) {
    const target = (urlToUse || directUrl).trim();
    if (!target) return;
    setDirectLoading(true);
    setDirectStatus("1. Connecting and crawling website pages...");

    try {
      const res = await fetch(`${API}/knowledge-bases/quick-chat-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TOKEN()}`,
        },
        body: JSON.stringify({ url: target }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Chat launch error: ${err.error || res.statusText}`);
        return;
      }

      setDirectStatus("2. Processing knowledge base...");
      const data = await res.json();
      await fetchKbs();

      if (data.knowledgeBase) {
        setDirectStatus("3. Launching grounded AI chat!");
        setSelectedKbForChat(data.knowledgeBase);
        setIsChatOpen(true);
        setDirectUrl("");
      }
    } catch (err: unknown) {
      alert(`Failed to launch chat: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDirectLoading(false);
      setDirectStatus(null);
    }
  }

  async function fetchOnboardingSources() {
    try {
      const res = await fetch(`${API}/knowledge-bases/onboarding-sources`, {
        headers: { Authorization: `Bearer ${TOKEN()}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.available) {
          setOnboardingSource(data);
          return;
        }
      }
    } catch {}

    try {
      const res = await fetch(`${API}/business-profile/draft`, {
        headers: { Authorization: `Bearer ${TOKEN()}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sourceUrl || data.rawScrapedData) {
          setOnboardingSource({
            available: true,
            websiteUrl: data.sourceUrl || null,
            documentFileName: null,
            hasDocumentText: false,
            scrapedPagesCount: Array.isArray(data.rawScrapedData) ? data.rawScrapedData.length : 0,
          });
          return;
        }
      }
    } catch {}
  }

  async function syncFromOnboarding(targetKbId?: string) {
    setSyncingOnboarding(true);
    try {
      const localDocText = typeof window !== "undefined" ? localStorage.getItem("vyaperi_onboarding_doc_text") : null;
      const localDocName = typeof window !== "undefined" ? localStorage.getItem("vyaperi_onboarding_doc_name") : null;
      const localUrl = typeof window !== "undefined" ? localStorage.getItem("vyaperi_onboarding_url") : null;

      const res = await fetch(`${API}/knowledge-bases/sync-from-onboarding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TOKEN()}`,
        },
        body: JSON.stringify({
          knowledgeBaseId: targetKbId,
          documentText: localDocText || undefined,
          documentFileName: localDocName || undefined,
          websiteUrl: localUrl || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert("Successfully synced sources from Onboarding!");
        await fetchKbs();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Auto-import failed: ${err.error || res.statusText}`);
      }
    } catch (err: unknown) {
      alert(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncingOnboarding(false);
    }
  }

  useEffect(() => {
    fetchKbs();
    fetchOnboardingSources();
  }, []);

  async function createKb() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/knowledge-bases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TOKEN()}`,
        },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        setNewName("");
        await fetchKbs();
      }
    } finally {
      setCreating(false);
    }
  }

  async function deleteKb(kbId: string) {
    if (!confirm("Delete this Knowledge Base and all its indexed sources?")) return;
    try {
      const res = await fetch(`${API}/knowledge-bases/${kbId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${TOKEN()}` },
      });
      if (res.ok) {
        if (selectedKbForChat?.id === kbId) {
          setSelectedKbForChat(null);
          setIsChatOpen(false);
        }
        await fetchKbs();
      }
    } catch {
      alert("Failed to delete knowledge base");
    }
  }

  async function scanUrl(kbId: string) {
    const url = urlInputs[kbId]?.trim();
    if (!url) return;

    setActiveSseKbId(kbId);
    setScanStatusMessage("Connecting to website and indexing pages...");

    try {
      const res = await fetch(`${API}/knowledge-bases/${kbId}/crawl`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TOKEN()}`,
        },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: "Request failed" }))) as { error?: string };
        alert(err.error ?? "Crawl failed");
        setActiveSseKbId(null);
        setScanStatusMessage(null);
        return;
      }

      setUrlInputs((prev) => ({ ...prev, [kbId]: "" }));

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.message) {
              setScanStatusMessage(evt.message);
            }
            if (evt.type === "INDEX_COMPLETE") {
              await fetchKbs();
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      console.error("Scan error:", err);
    } finally {
      await fetchKbs();
      setActiveSseKbId(null);
      setScanStatusMessage(null);
    }
  }

  async function deleteSource(kbId: string, sourceId: string) {
    if (!confirm("Delete this source? Its indexed content will be permanently removed.")) return;
    await fetch(`${API}/knowledge-bases/${kbId}/sources/${sourceId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${TOKEN()}` },
    });
    await fetchKbs();
  }

  if (loading) {
    return (
      <div className="p-8 animate-pulse space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-secondary" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-display font-black uppercase tracking-tight text-foreground flex items-center gap-2">
            AI Knowledge Bases
            <span className="label-mono text-[9px] bg-secondary px-2 py-0.5 text-muted-foreground">GROUNDED CHAT</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Indexed website pages and documents for factual, hallucination-free AI chat
          </p>
        </div>
        {/* Create new KB */}
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New Knowledge Base name"
            className="w-48 text-xs h-8"
            id="new-kb-name-input"
            onKeyDown={(e) => e.key === "Enter" && createKb()}
          />
          <Button onClick={createKb} disabled={creating || !newName.trim()} id="create-kb-btn" className="h-8 text-xs px-3">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create
          </Button>
        </div>
      </div>

      {/* REFINED DIRECT CHAT BAR */}
      <div className="border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-lime text-black flex items-center justify-center font-bold text-xs">
              ⚡
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide text-foreground">
                Direct AI Chat from Website URL
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Enter any website address to index its pages and start chatting immediately.
              </p>
            </div>
          </div>

          {/* Integrated Onboarding Source pill if detected */}
          {onboardingSource && onboardingSource.available && onboardingSource.websiteUrl && (
            <div className="flex items-center gap-2 bg-secondary/60 border border-border px-2.5 py-1 text-xs">
              <Sparkles className="h-3 w-3 text-lime" />
              <span className="text-[11px] text-muted-foreground">
                From onboarding: <strong className="text-foreground">{onboardingSource.websiteUrl}</strong>
              </span>
              <button
                type="button"
                onClick={() => setDirectUrl(onboardingSource.websiteUrl || "")}
                className="text-[10px] text-lime font-bold hover:underline cursor-pointer ml-1"
              >
                Use this URL
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-0.5">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={directUrl}
              onChange={(e) => setDirectUrl(e.target.value)}
              placeholder="https://example.com"
              className="pl-9 text-xs h-9 font-mono"
              id="direct-url-input"
              onKeyDown={(e) => e.key === "Enter" && handleDirectChat()}
            />
          </div>
          <Button
            onClick={() => handleDirectChat()}
            disabled={directLoading || !directUrl.trim()}
            className="h-9 px-4 bg-lime text-black hover:bg-lime/90 font-bold text-xs shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 border border-black/20"
            id="direct-chat-btn"
          >
            {directLoading ? (
              <><LiveDot className="mr-1.5" /> Indexing & Opening...</>
            ) : (
              <><MessageSquare className="h-3.5 w-3.5" /> Start Chat</>
            )}
          </Button>
        </div>

        {directStatus && (
          <div className="p-2 bg-violet/10 border border-violet/20 text-xs text-foreground flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 text-violet animate-spin" />
            <span className="font-medium text-[11px]">{directStatus}</span>
          </div>
        )}
      </div>

      {/* Empty State */}
      {kbs.length === 0 && (
        <div className="border border-dashed border-border p-10 text-center bg-card/40">
          <Database className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-xs font-semibold text-foreground">No knowledge bases yet</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Enter a website above to index its content and chat.
          </p>
        </div>
      )}

      {/* Clean Knowledge Bases List */}
      <div className="space-y-3">
        {kbs.map((kb) => {
          const isExpanded = expandedKb === kb.id;
          const totalIndexed = kb.sources.reduce((s, src) => s + src.pagesIndexed, 0);
          const isReady = kb.sources.some((s) => s.status === "ready");

          return (
            <div key={kb.id} className="border border-border bg-card">
              {/* Card Header */}
              <div
                className="flex w-full items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
                onClick={() => setExpandedKb(isExpanded ? null : kb.id)}
                id={`kb-toggle-${kb.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-muted-foreground">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display font-bold uppercase text-xs text-foreground tracking-wide">{kb.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="label-mono text-[9px] text-muted-foreground">
                        {kb.sources.length} {kb.sources.length === 1 ? "SOURCE" : "SOURCES"} • {totalIndexed} {totalIndexed === 1 ? "PAGE" : "PAGES"} INDEXED
                      </span>
                      {statusBadge(isReady ? "ready" : kb.sources[0]?.status || "ready")}
                    </div>
                  </div>
                </div>

                {/* Actions: Chat & Delete */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-lime text-black hover:bg-lime/90 font-bold px-3 py-1 text-xs flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer border border-black/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedKbForChat(kb);
                      setIsChatOpen(true);
                    }}
                    id={`open-chat-${kb.id}`}
                    title="Open Chat"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Chat
                  </Button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteKb(kb.id);
                    }}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                    title="Delete Knowledge Base"
                    aria-label="Delete Knowledge Base"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Card Body */}
              {isExpanded && (
                <div className="border-t border-border space-y-3 p-4 bg-secondary/10">
                  {/* Readiness Banner */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-secondary/40 border border-border gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${totalIndexed > 0 ? "bg-lime" : "bg-orange-400"}`} />
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          {totalIndexed > 0 ? "Grounded AI Chat Ready" : "No content indexed yet"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {totalIndexed > 0
                            ? `Grounded on ${totalIndexed} indexed pages. Click "Start Chatting" to ask questions.`
                            : "Add a website or upload a PDF below to index content."}
                        </p>
                      </div>
                    </div>
                    {totalIndexed > 0 && (
                      <Button
                        size="sm"
                        className="bg-lime text-black hover:bg-lime/90 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                        onClick={() => {
                          setSelectedKbForChat(kb);
                          setIsChatOpen(true);
                        }}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Start Chatting
                      </Button>
                    )}
                  </div>

                  {/* Active Scan Progress */}
                  {activeSseKbId === kb.id && (
                    <div className="p-2.5 bg-violet/10 border border-violet/20 flex items-center gap-2.5 text-xs">
                      <RefreshCw className="h-3.5 w-3.5 text-violet animate-spin shrink-0" />
                      <p className="text-[11px] font-medium text-foreground">
                        {scanStatusMessage || "Indexing content into knowledge base..."}
                      </p>
                    </div>
                  )}

                  {/* INDEXED SOURCES (Clean layout, no technical chunk count) */}
                  {kb.sources.length > 0 && (
                    <div>
                      <p className="label-mono text-[9px] text-muted-foreground mb-1.5">INDEXED SOURCES</p>
                      <div className="space-y-1">
                        {kb.sources.map((src) => (
                          <div key={src.id} className="flex items-center justify-between gap-2 border border-border p-2 text-xs bg-background">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={[
                                "label-mono px-1.5 py-0.5 text-[8px] shrink-0",
                                src.sourceType === "pdf" ? "bg-violet text-white" : "bg-secondary text-foreground",
                              ].join(" ")}>
                                {src.sourceType.toUpperCase()}
                              </span>
                              <p className="truncate font-medium text-foreground text-xs">
                                {src.url ?? src.fileName ?? "Unknown source"}
                              </p>
                              <span className="text-[11px] text-muted-foreground">• {src.pagesIndexed} pages indexed</span>
                              {statusBadge(src.status)}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              {src.sourceType === "website" && (
                                <button
                                  onClick={() => {
                                    setUrlInputs((prev) => ({ ...prev, [kb.id]: src.url ?? "" }));
                                    scanUrl(kb.id);
                                  }}
                                  className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                                  title="Rescan source"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </button>
                              )}
                              <button
                                onClick={() => deleteSource(kb.id, src.id)}
                                className="p-1 text-muted-foreground hover:text-destructive cursor-pointer"
                                title="Delete source"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ADD MORE SOURCES */}
                  <div className="border-t border-border/60 pt-2.5 space-y-2">
                    <p className="label-mono text-[9px] text-muted-foreground">ADD ANOTHER SOURCE (OPTIONAL)</p>
                    <div className="flex gap-2">
                      <Input
                        value={urlInputs[kb.id] ?? ""}
                        onChange={(e) => setUrlInputs((prev) => ({ ...prev, [kb.id]: e.target.value }))}
                        placeholder="https://example.com/subpage"
                        className="flex-1 text-xs h-8 font-mono"
                        id={`url-input-${kb.id}`}
                        onKeyDown={(e) => e.key === "Enter" && scanUrl(kb.id)}
                      />
                      <Button
                        onClick={() => scanUrl(kb.id)}
                        disabled={activeSseKbId === kb.id || !(urlInputs[kb.id] ?? "").trim()}
                        id={`scan-btn-${kb.id}`}
                        className="h-8 text-xs cursor-pointer px-3"
                      >
                        {activeSseKbId === kb.id ? (
                          <><LiveDot className="mr-1" /> Indexing...</>
                        ) : (
                          <><Globe className="h-3.5 w-3.5 mr-1" /> Add & Index</>
                        )}
                      </Button>
                      <button
                        type="button"
                        onClick={() => setShowUpload((prev) => ({ ...prev, [kb.id]: !prev[kb.id] }))}
                        className="text-xs px-2.5 py-1 border border-border bg-secondary/50 hover:bg-secondary text-foreground cursor-pointer"
                      >
                        {showUpload[kb.id] ? "Hide PDF" : "+ PDF"}
                      </button>
                    </div>

                    {showUpload[kb.id] && (
                      <div className="pt-2">
                        <PDFUpload
                          knowledgeBaseId={kb.id}
                          onUploadComplete={() => {
                            fetchKbs();
                            setShowUpload((prev) => ({ ...prev, [kb.id]: false }));
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Chat Widget */}
      {selectedKbForChat && (
        <ChatWidget
          key={selectedKbForChat.id}
          knowledgeBaseId={selectedKbForChat.id}
          knowledgeBaseName={selectedKbForChat.name}
          token={TOKEN()}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      )}
    </div>
  );
}
