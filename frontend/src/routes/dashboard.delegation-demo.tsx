import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import {
  Download,
  Upload,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  PhoneCall,
  Filter,
  RefreshCw,
  Layers,
} from "lucide-react";
import { useApp, toCsv, downloadCsv, type Stage } from "@/components/app/store";
import {
  Btn,
  PageHead,
  Panel,
  ScoreDot,
  Stat,
  StatGrid,
  Tag,
  inputCls,
  Bar,
} from "@/components/app/ui";

export const Route = createFileRoute("/dashboard/delegation-demo")({
  head: () => ({
    meta: [
      { title: "Lead Database & Lifecycle Management — VYAPERI X Sales Console" },
      {
        name: "description",
        content:
          "Manage, segment, enrich, and export enterprise prospects with automated CSV import & CRM synchronization.",
      },
    ],
  }),
  component: LeadManagementPage,
});

const STAGES: Stage[] = ["new", "enriched", "qualified", "contacted", "interested", "rejected"];

function LeadManagementPage() {
  const { leads, setStage, pushLead } = useApp();
  const [filter, setFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [industryFilter, setIndustryFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // CSV Import Simulator State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const industries = ["ALL", ...Array.from(new Set(leads.map((l) => l.industry))).sort()];

  const rows = leads.filter(
    (l) =>
      (stageFilter === "ALL" || l.stage === stageFilter) &&
      (industryFilter === "ALL" || l.industry === industryFilter) &&
      (filter === "" ||
        (l.name + l.company + l.title + l.location + l.industry)
          .toLowerCase()
          .includes(filter.toLowerCase())),
  );

  const exportCsv = () => downloadCsv(`vyaperi-enterprise-leads-${Date.now()}.csv`, toCsv(rows));

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === rows.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(rows.map((r) => r.id)));
  };

  const handleBulkStageChange = (newStage: Stage) => {
    selectedIds.forEach((id) => setStage(id, newStage));
    setSelectedIds(new Set());
  };

  const runSimulatedImport = () => {
    setImporting(true);
    setImportProgress(0);
    setImportSuccess(false);

    let p = 0;
    const interval = setInterval(() => {
      p += 25;
      setImportProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setImporting(false);
        setImportSuccess(true);
        // Push 3 new leads to state
        pushLead();
        pushLead();
        pushLead();
      }
    }, 450);
  };

  return (
    <div className="space-y-8">
      <PageHead
        index="/04"
        title="Lead Management Database"
        subtitle="Full prospect lifecycle management with automated deduplication, CSV ingestion & CRM sync."
        action={
          <div className="flex items-center gap-2">
            <Btn variant="outline" onClick={() => setShowImportModal(true)}>
              <Upload className="h-3.5 w-3.5" /> Ingest CSV Batch
            </Btn>
            <Btn variant="solid" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" /> Export Data ({rows.length})
            </Btn>
          </div>
        }
      />

      <StatGrid>
        <Stat
          label="Total Database Contacts"
          value={leads.length.toLocaleString()}
          note="Clean & deduplicated"
        />
        <Stat
          label="Enriched Profiles"
          value={String(leads.filter((l) => ["new", "enriched"].includes(l.stage)).length)}
          note="Verified emails & phones"
        />
        <Stat
          label="Qualified for Dialler"
          value={String(leads.filter((l) => l.stage === "qualified").length)}
          note="Ready for AI voice fleet"
        />
        <Stat
          label="Interested Deals"
          value={String(leads.filter((l) => l.stage === "interested").length)}
          note="Meeting scheduled stage"
        />
      </StatGrid>

      {/* CSV Ingestion Modal */}
      {showImportModal && (
        <div className="border-2 border-violet bg-card p-6 rounded shadow-2xl space-y-5 fade-in-up">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-display text-base font-bold">Ingest CSV / Excel Lead Database</h3>
              <p className="font-mono text-xs text-muted-foreground">
                Upload any spreadsheet: auto-maps headers (Name, Company, Phone, Email, Intent).
              </p>
            </div>
            <Btn variant="outline" onClick={() => setShowImportModal(false)}>
              ✕ Close
            </Btn>
          </div>

          <div className="border-2 border-dashed border-border bg-secondary/40 p-8 rounded text-center space-y-3">
            <Upload className="h-8 w-8 mx-auto text-violet animate-bounce" />
            <div className="font-display text-sm font-bold">
              Drop your CSV file here or click to browse
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">
              Supports .csv, .xlsx, .tsv up to 50,000 records per batch
            </div>
            <Btn variant="solid" onClick={runSimulatedImport} disabled={importing}>
              {importing ? "Parsing & Deduplicating Headers..." : "Select & Ingest Sample CSV"}
            </Btn>
          </div>

          {importing && (
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between">
                <span>Ingesting & Validating Telecom MX Records...</span>
                <span>{importProgress}%</span>
              </div>
              <Bar value={importProgress} tone="lime" />
            </div>
          )}

          {importSuccess && (
            <div className="border border-emerald-500/30 bg-emerald-500/10 p-3 rounded font-mono text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Successfully ingested 24 verified enterprise
              leads. Mapped to Active Pipeline.
            </div>
          )}
        </div>
      )}

      {/* Filters & Bulk Operations Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className={`${inputCls} max-w-xs`}
            placeholder="Search name, company, title, city…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            className={`${inputCls} w-auto`}
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="ALL">All Pipeline Stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            className={`${inputCls} w-auto`}
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
          >
            {industries.map((i) => (
              <option key={i} value={i}>
                {i === "ALL" ? "All Industries" : i}
              </option>
            ))}
          </select>
        </div>

        {/* Bulk Action Controls */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 border border-violet bg-violet/10 px-3 py-1.5 rounded font-mono text-xs fade-in">
            <span className="font-bold text-violet">{selectedIds.size} Selected</span>
            <button
              onClick={() => handleBulkStageChange("qualified")}
              className="px-2 py-1 bg-lime text-black font-extrabold rounded hover:opacity-90"
            >
              Bulk Qualify
            </button>
            <button
              onClick={() => handleBulkStageChange("rejected")}
              className="px-2 py-1 bg-danger text-white rounded hover:opacity-90"
            >
              Suppress
            </button>
          </div>
        )}
      </div>

      {/* Leads Table */}
      <Panel title="Enterprise Prospect Records" hint={`${rows.length} Total Targets`}>
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="p-3 text-left w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === rows.length && rows.length > 0}
                    onChange={selectAll}
                    className="accent-violet h-3.5 w-3.5"
                  />
                </th>
                <th className="pb-3 pr-4 text-left label-mono text-muted-foreground whitespace-nowrap">
                  Score
                </th>
                <th className="pb-3 pr-4 text-left label-mono text-muted-foreground whitespace-nowrap">
                  Prospect / Role
                </th>
                <th className="pb-3 pr-4 text-left label-mono text-muted-foreground whitespace-nowrap">
                  Company
                </th>
                <th className="pb-3 pr-4 text-left label-mono text-muted-foreground whitespace-nowrap">
                  Industry / Loc
                </th>
                <th className="pb-3 pr-4 text-left label-mono text-muted-foreground whitespace-nowrap">
                  Verified Contact
                </th>
                <th className="pb-3 pr-4 text-left label-mono text-muted-foreground whitespace-nowrap">
                  Source
                </th>
                <th className="pb-3 pr-4 text-left label-mono text-muted-foreground whitespace-nowrap">
                  Stage
                </th>
                <th className="pb-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((l) => (
                <tr key={l.id} className="hover:bg-secondary/40 transition-colors">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(l.id)}
                      onChange={() => toggleSelect(l.id)}
                      className="accent-violet h-3.5 w-3.5"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-1.5">
                      <ScoreDot score={l.score} />
                      <span className="font-bold">{l.score}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="font-bold text-ink whitespace-nowrap text-[13px]">{l.name}</div>
                    <div className="text-muted-foreground text-[11px] truncate max-w-[180px]">
                      {l.title}
                    </div>
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap font-semibold">{l.company}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <div>{l.industry}</div>
                    <div className="text-[10px] text-muted-foreground">{l.location}</div>
                  </td>
                  <td className="py-3 pr-4">
                    {l.email ? (
                      <span className="block truncate max-w-[160px] text-violet font-semibold">
                        {l.email}
                      </span>
                    ) : l.phone ? (
                      <span className="text-muted-foreground">{l.phone}</span>
                    ) : (
                      <a
                        href={`https://${l.postUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-violet underline"
                      >
                        <ExternalLink className="h-3 w-3" /> Intent Post
                      </a>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <Tag
                      tone={
                        l.source === "LinkedIn" ? "violet" : l.source === "X" ? "lime" : "muted"
                      }
                    >
                      {l.source}
                    </Tag>
                  </td>
                  <td className="py-3 pr-4">
                    <select
                      className="border border-border bg-card px-2 py-1 font-mono text-[11px] font-semibold outline-none focus:border-violet rounded"
                      value={l.stage}
                      onChange={(e) => setStage(l.id, e.target.value as Stage)}
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 text-right">
                    <a
                      href={`https://${l.postUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-violet hover:text-ink p-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5 inline" />
                    </a>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={9}
                    className="py-12 text-center text-muted-foreground font-mono text-xs"
                  >
                    // No records found matching current query
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
