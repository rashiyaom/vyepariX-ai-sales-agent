/**
 * Citation Card — expandable source reference
 * Matches VYAPERI X brutalist design: sharp corners, violet badges.
 */
import { useState } from "react";
import { ExternalLink, FileText, ChevronDown, ChevronUp } from "lucide-react";

export interface Citation {
  title: string;
  url?: string;
  file_name?: string;
  page_number?: number;
  excerpt?: string;
}

interface CitationCardProps {
  citation: Citation;
  index: number;
}

export function CitationCard({ citation, index }: CitationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isPdf = !!citation.file_name;

  return (
    <div className="border border-border bg-card text-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-2 p-2 text-left hover:bg-secondary/60 transition-colors"
        id={`citation-${index}`}
        aria-expanded={expanded}
      >
        {/* Source badge */}
        <span className={[
          "label-mono mt-0.5 shrink-0 px-1.5 py-0.5 text-[9px]",
          isPdf ? "bg-violet text-white" : "bg-lime text-black",
        ].join(" ")}>
          {isPdf ? "PDF" : "WEB"}
        </span>

        {/* Title + source */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{citation.title}</p>
          {isPdf ? (
            <p className="text-xs text-muted-foreground">
              <FileText className="inline h-3 w-3 mr-0.5" />
              {citation.file_name} — Page {citation.page_number ?? "?"}
            </p>
          ) : (
            <a
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-violet underline truncate inline-flex items-center gap-0.5 hover:no-underline"
            >
              {citation.url}
              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
            </a>
          )}
        </div>

        {citation.excerpt && (
          <span className="shrink-0 text-muted-foreground">
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </span>
        )}
      </button>

      {expanded && citation.excerpt && (
        <div className="border-t border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground font-mono leading-relaxed">
          &ldquo;{citation.excerpt}&rdquo;
        </div>
      )}
    </div>
  );
}
