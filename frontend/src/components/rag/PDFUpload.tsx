/**
 * PDF Upload component
 * Drag-and-drop + click-to-browse PDF uploader.
 * Matches VYAPERI X design system: sharp corners, violet accent, Archivo font.
 */
import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { Upload, FileText, X, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PDFUploadProps {
  knowledgeBaseId: string;
  onUploadComplete: () => void;
}

type UploadState = "idle" | "uploading" | "success" | "error";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/v1";
const TOKEN = () => localStorage.getItem("vyaperi_token") ?? "mock_jwt_token";

export function PDFUpload({ knowledgeBaseId, onUploadComplete }: PDFUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    setDragging(true);
  }
  function onDragLeave() { setDragging(false); }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("File exceeds 25 MB limit.");
      return;
    }
    setError("");
    setSelectedFile(file);
  }

  async function upload() {
    if (!selectedFile) return;
    setState("uploading");
    setProgress("Uploading and parsing PDF...");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch(`${API}/knowledge-bases/${knowledgeBaseId}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN()}` },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Upload failed" })) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as { warnings?: string[] };
      setState("success");
      setProgress(`Indexed successfully${data.warnings?.length ? ` (${data.warnings.length} warnings)` : ""}`);
      setTimeout(() => {
        setState("idle");
        setSelectedFile(null);
        setProgress("");
        onUploadComplete();
      }, 2000);
    } catch (err: unknown) {
      setState("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onClick={() => state === "idle" && inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={[
          "border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
          dragging ? "border-violet bg-violet/5" : "border-border hover:border-violet/50",
          state === "uploading" ? "pointer-events-none opacity-70" : "",
        ].join(" ")}
        role="button"
        aria-label="Upload PDF file"
      >
        {selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="h-6 w-6 text-violet" />
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            {state === "idle" && (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                className="ml-2 text-muted-foreground hover:text-foreground"
                aria-label="Remove selected file"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              Drop PDF here or <span className="text-violet underline">click to browse</span>
            </p>
            <p className="text-xs text-muted-foreground">PDF only · max 25 MB</p>
          </div>
        )}
        <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onInputChange} />
      </div>

      {/* Status */}
      {state === "uploading" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-3 w-3 border-2 border-violet border-t-transparent rounded-full animate-spin" />
          {progress}
        </div>
      )}
      {state === "success" && (
        <div className="flex items-center gap-2 text-sm text-lime-600 dark:text-lime">
          <CheckCircle className="h-4 w-4" /> {progress}
        </div>
      )}
      {(error || state === "error") && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {error || "Upload failed"}
        </div>
      )}

      {selectedFile && state === "idle" && (
        <Button onClick={upload} className="w-full" id="pdf-upload-submit">
          Index PDF
        </Button>
      )}
    </div>
  );
}
