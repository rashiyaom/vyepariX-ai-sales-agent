/**
 * Ingestion Status component — live SSE progress display
 * Shows pages discovered / indexed / failed as they stream in.
 */
import { useEffect, useRef, useState } from "react";
import { CheckCircle, AlertCircle, Loader } from "lucide-react";

interface IngestionEvent {
  type: IngestionEventType;
  sourceId: string;
  message: string;
  pagesDiscovered?: number;
  pagesIndexed?: number;
  pagesFailed?: number;
  chunksIndexed?: number;
  error?: string;
  timestamp: string;
}

type IngestionEventType = "SCRAPE_STARTED" | "PAGE_FETCHED" | "PAGE_FAILED" | "SCRAPE_COMPLETE" | "INDEX_STARTED" | "CHUNK_INDEXED" | "INDEX_COMPLETE" | "ERROR";

interface IngestionStatusProps {
  sseUrl: string | null;   // null = not started
  token: string;
  onComplete?: (stats: { indexed: number; failed: number; chunks: number }) => void;
}

export function IngestionStatus({ sseUrl, token, onComplete }: IngestionStatusProps) {
  const [events, setEvents] = useState<IngestionEvent[]>([]);
  const [stats, setStats] = useState({ discovered: 0, indexed: 0, failed: 0, chunks: 0 });
  const [done, setDone] = useState(false);
  const [hasError, setHasError] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sseUrl) return;
    setEvents([]);
    setStats({ discovered: 0, indexed: 0, failed: 0, chunks: 0 });
    setDone(false);
    setHasError(false);

    const es = new EventSource(sseUrl + `?token=${encodeURIComponent(token)}`);

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data) as IngestionEvent;
        setEvents((prev) => [...prev.slice(-99), evt]);

        if (evt.pagesDiscovered !== undefined)
          setStats((s) => ({ ...s, discovered: evt.pagesDiscovered! }));
        if (evt.pagesIndexed !== undefined)
          setStats((s) => ({ ...s, indexed: evt.pagesIndexed! }));
        if (evt.pagesFailed !== undefined)
          setStats((s) => ({ ...s, failed: evt.pagesFailed! }));
        if (evt.chunksIndexed !== undefined)
          setStats((s) => ({ ...s, chunks: evt.chunksIndexed! }));

        if (evt.type === "INDEX_COMPLETE" || evt.type === "SCRAPE_COMPLETE") {
          setDone(true);
          onComplete?.({ indexed: evt.pagesIndexed ?? 0, failed: evt.pagesFailed ?? 0, chunks: evt.chunksIndexed ?? 0 });
          es.close();
        }
        if (evt.type === "ERROR") {
          setHasError(true);
          setDone(true);
          es.close();
        }
      } catch {
        // non-JSON frame, ignore
      }
    };

    es.onerror = () => {
      setDone(true);
      es.close();
    };

    return () => es.close();
  }, [sseUrl, token]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  if (!sseUrl && events.length === 0) return null;

  return (
    <div className="border border-border bg-card space-y-3 p-4">
      {/* Stats row */}
      <div className="flex flex-wrap gap-4">
        <Stat label="DISCOVERED" value={stats.discovered} />
        <Stat label="INDEXED" value={stats.indexed} color="text-lime-600 dark:text-lime" />
        <Stat label="FAILED" value={stats.failed} color={stats.failed > 0 ? "text-destructive" : undefined} />
        <Stat label="CHUNKS" value={stats.chunks} />
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2">
        {!done && <Loader className="h-3 w-3 animate-spin text-violet" />}
        {done && !hasError && <CheckCircle className="h-3 w-3 text-lime-600 dark:text-lime" />}
        {done && hasError && <AlertCircle className="h-3 w-3 text-destructive" />}
        <span className="label-mono text-[10px] text-muted-foreground">
          {done ? (hasError ? "COMPLETED WITH ERRORS" : "COMPLETED") : "IN PROGRESS"}
        </span>
      </div>

      {/* Event log */}
      <div
        ref={logRef}
        className="h-32 overflow-y-auto bg-secondary/50 p-2 font-mono text-[10px] space-y-0.5"
      >
        {events.map((evt, i) => (
          <div
            key={i}
            className={[
              "leading-tight",
              evt.type === "PAGE_FAILED" || evt.type === "ERROR" ? "text-destructive" : "text-muted-foreground",
            ].join(" ")}
          >
            <span className="text-violet">[{evt.type}]</span> {evt.message}
          </div>
        ))}
        {events.length === 0 && <span className="text-muted-foreground">Waiting for events...</span>}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="label-mono text-[9px] text-muted-foreground">{label}</span>
      <span className={`text-xl font-bold font-display ${color ?? "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

