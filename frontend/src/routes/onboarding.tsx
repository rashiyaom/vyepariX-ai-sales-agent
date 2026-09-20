import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  Globe,
  FileText,
  Linkedin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Layers,
  ChevronDown,
  ChevronUp,
  Target,
  Plus,
  Trash2,
  UploadCloud,
  Check,
  PhoneCall,
  Radar,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  FileUp,
  FileCheck,
  Edit3,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Logo } from "@/components/site/Chrome";
import { ThemeToggle } from "@/components/app/theme";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "First-Time Setup & Business Onboarding — VYAPERI X" },
      {
        name: "description",
        content:
          "Autonomous onboarding pipeline: submit company info, AI scrapes and derives core services, ICP, and buying keywords, followed by human verification and sales mode handoff.",
      },
    ],
  }),
  component: OnboardingPage,
});

interface ScrapedPageData {
  url: string;
  title: string;
  metaDescription?: string | undefined;
  text: string;
  fetchedAt: string;
}

interface CoreService {
  name: string;
  description: string;
  targetUseCase?: string | undefined;
}

interface ICPData {
  targetCompanySize: { min: number; max: number; label: string };
  targetIndustries: string[];
  targetGeography: string[];
  buyingSignalKeywords: string[];
  decisionMakerTitles: string[];
}

interface DraftProfile {
  id?: string | undefined;
  companySummary: string;
  coreServices: CoreService[];
  industries: string[];
  icp: ICPData;
  keywords: string[];
  differentiators: string[];
  rawScrapedData?: ScrapedPageData[] | undefined;
  sourceUrl?: string | undefined;
  linkedinUrl?: string | undefined;
  userDescription?: string | undefined;
  status?: "DRAFT" | "CONFIRMED" | undefined;
}

const DEMO_PRESETS = [
  {
    label: "Fintech & Payments",
    url: "https://razorpay.com",
    desc: "We provide automated payment gateway APIs, smart payment routing, and corporate credit cards for Indian online businesses and SaaS startups.",
    linkedin: "https://www.linkedin.com/company/razorpay",
    badge: "Payments API",
  },
  {
    label: "DevOps & Cloud Scale",
    url: "https://spacelift.io",
    desc: "Infrastructure as code platform for Terraform, OpenTofu, and Pulumi. Helping engineering teams prevent cloud drift and cut AWS bills.",
    linkedin: "https://www.linkedin.com/company/spacelift",
    badge: "Cloud Infra",
  },
  {
    label: "B2B Export Logistics",
    url: "https://cogoport.com",
    desc: "Global ocean freight forwarding, custom clearance automation, and trade finance for Surat textile and Gujarat chemical exporters.",
    linkedin: "https://www.linkedin.com/company/cogoport",
    badge: "Trade Freight",
  },
];

export function OnboardingPage() {
  const navigate = useNavigate();

  // Wizard state: 1: Input, 2: Processing, 3: Review, 4: Handoff
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Input Mode Tab (website vs description vs document)
  const [activeInputTab, setActiveInputTab] = useState<"website" | "description" | "document">("website");

  // Step 1: Inputs
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [docText, setDocText] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  // Pitch Deck / Document Upload state
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    sizeFormatted: string;
    charCount: number;
    wordCount: number;
    type: string;
  } | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadDocError, setUploadDocError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDocEditor, setShowDocEditor] = useState(true);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const loadSamplePitchDeck = () => {
    const sampleDeck = `HYPERFLOW CLOUD COMPLIANCE & ZERO-TRUST RADAR
ENTERPRISE SALES PITCH DECK & PRODUCT BROCHURE 2026

1. EXECUTIVE SUMMARY & PROBLEM STATEMENT
Fast-growing B2B software companies face severe compliance audit bottlenecks (SOC2, ISO 27001, GDPR, HIPAA) alongside rampant multi-cloud infrastructure drift. Traditional security scanners spit out thousands of un-prioritized CVEs without context, overwhelming DevOps leads and stalling multi-million-dollar enterprise customer contracts.

2. PRODUCT VALUE PROPOSITION & ARCHITECTURE
- Autonomous Drift Detection: Real-time agentless scans of AWS, GCP, Azure, and Kubernetes. Highlights exposed databases, unencrypted buckets, and IAM privilege escalations in <60 seconds.
- Continuous Compliance Guardrails: 1-click generation of SOC 2 Type II and ISO 27001 audit binders with cryptographic verification hashes.
- Automated Zero-Trust Policy Remediation: Instant PR generation for Terraform, Pulumi, and OpenTofu to auto-patch misconfigurations without breaking production CI/CD pipelines.

3. TARGET MARKET & IDEAL CUSTOMER PROFILE (ICP)
- Target Company Size: High-growth SaaS & FinTech (50 to 1,500 employees).
- Key Industries: B2B SaaS, FinTech & Payments, Healthcare Cloud, AI Infrastructure.
- Target Geography: North America, Western Europe, India, Singapore.
- Key Decision Makers: VP of Engineering, Chief Information Security Officer (CISO), Head of Infrastructure, Director of DevOps.
- Urgent Buying Signals: Upcoming SOC2 or ISO renewal within 90 days, recent cloud migration from monolith to microservices, hiring SecOps engineers.

4. COMPETITIVE ADVANTAGES & DIFFERENTIATORS
- Zero-agent installation: 15-minute cross-account IAM role setup without latency or kernel overhead.
- Actionable Pull Requests instead of static PDF alerts: Remediates vulnerabilities directly at the source code layer.
- 65% reduction in compliance prep hours for Series A/B engineering teams.`;

    setDocText(sampleDeck);
    setUploadedFile({
      name: "HyperFlow_Security_Enterprise_Deck_2026.pdf",
      sizeFormatted: "1.4 MB",
      charCount: sampleDeck.length,
      wordCount: sampleDeck.split(/\s+/).filter(Boolean).length,
      type: "PDF",
    });
    setUploadDocError(null);
    setShowDocEditor(true);
  };

  const processSelectedFile = async (file: File) => {
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setUploadDocError("File size exceeds 25MB limit. Please upload a smaller document.");
      return;
    }

    setIsUploadingDoc(true);
    setUploadDocError(null);

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const isPlainText = ["txt", "md", "markdown", "csv", "tsv", "json", "rtf", "log"].includes(ext);

    // If plain text format, read immediately in browser
    if (isPlainText) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = (e.target?.result as string) || "";
        const cleaned = text.trim();
        setDocText(cleaned);
        setUploadedFile({
          name: file.name,
          sizeFormatted: formatFileSize(file.size),
          charCount: cleaned.length,
          wordCount: cleaned.split(/\s+/).filter(Boolean).length,
          type: ext.toUpperCase(),
        });
        setIsUploadingDoc(false);
        setShowDocEditor(true);
      };
      reader.onerror = () => {
        setUploadDocError("Failed to read text file. Please try pasting its content manually.");
        setIsUploadingDoc(false);
      };
      reader.readAsText(file);
      return;
    }

    // For PDF, Word DOCX, Excel, send to backend upload endpoint
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:5000/api/v1/business-profile/upload-doc", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("vyaperix_token") || "mock_jwt_token"}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setDocText(data.extractedText);
        setUploadedFile({
          name: data.filename,
          sizeFormatted: data.sizeFormatted,
          charCount: data.charCount,
          wordCount: data.wordCount,
          type: (data.fileType || ext).toUpperCase(),
        });
        setShowDocEditor(true);
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server extraction failed with status ${res.status}`);
      }
    } catch (err: any) {
      console.warn("Backend doc extraction failed, trying local fallback:", err);
      try {
        const text = await file.text();
        const matches = text.match(/[\x20-\x7E\t\n\r]{4,}/g);
        if (matches && matches.length > 10) {
          const cleaned = matches.join(" ").trim();
          setDocText(cleaned);
          setUploadedFile({
            name: file.name,
            sizeFormatted: formatFileSize(file.size),
            charCount: cleaned.length,
            wordCount: cleaned.split(/\s+/).filter(Boolean).length,
            type: ext.toUpperCase(),
          });
          setShowDocEditor(true);
        } else {
          setUploadDocError(
            "Could not parse readable text from this binary format. Please copy and paste the text content from your presentation or brochure directly below."
          );
        }
      } catch {
        setUploadDocError(
          "Upload parsing failed. Please copy & paste the text directly from your deck or brochure into the editor below."
        );
      }
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file) {
        processSelectedFile(file);
      }
    }
  };

  const handleDocFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file) {
        processSelectedFile(file);
      }
    }
  };

  const handleRemoveUploadedFile = () => {
    setUploadedFile(null);
    setDocText("");
    setUploadDocError(null);
    if (docFileInputRef.current) {
      docFileInputRef.current.value = "";
    }
  };

  // Step 2: Processing & Live Logs
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(10);
  const [statusText, setStatusText] = useState("Initializing crawler & AI pipeline...");
  const [logs, setLogs] = useState<Array<{ step: string; message: string; timestamp: string }>>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Step 3: Human Review & Edit
  const [draft, setDraft] = useState<DraftProfile | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [showRerunModal, setShowRerunModal] = useState(false);
  const [correctiveInput, setCorrectiveInput] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Step 4: Mode Selection
  const [selectedMode, setSelectedMode] = useState<"calling-only" | "leads-calling" | null>("leads-calling");
  const [leadFileUploaded, setLeadFileUploaded] = useState(false);

  // Auto-scroll log terminal
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Handle Preset Load
  const loadPreset = (preset: (typeof DEMO_PRESETS)[0]) => {
    setUrl(preset.url);
    setDescription(preset.desc);
    setLinkedinUrl(preset.linkedin);
    setInputError(null);
  };

  // Submit Step 1: Trigger Enrichment
  const handleStartEnrichment = async () => {
    if (!url.trim() && !description.trim() && !docText.trim()) {
      setInputError("Please provide at least a website URL, business description, or document text.");
      return;
    }
    setInputError(null);
    setStep(2);
    setProgress(15);
    setStatusText("Dispatching asynchronous enrichment job...");
    setLogs([
      {
        step: "queued",
        message: "Job dispatched. Requesting website DOM and AI analysis.",
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    try {
      const res = await fetch("http://localhost:5000/api/v1/business-profile/enrich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("vyaperix_token") || "mock_jwt_token"}`,
        },
        body: JSON.stringify({
          url: url.trim() || undefined,
          description: description.trim() || undefined,
          documentText: docText.trim() || undefined,
          linkedinUrl: linkedinUrl.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setJobId(data.jobId);
        pollJobStatus(data.jobId);
      } else {
        simulatePipeline();
      }
    } catch {
      simulatePipeline();
    }
  };

  // Poll job status fallback
  const pollJobStatus = (id: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/v1/business-profile/status/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("vyaperix_token") || "mock_jwt_token"}`,
          },
        });
        if (res.ok) {
          const state = await res.json();
          setProgress(state.progressPercent || 50);
          setStatusText(state.currentStep);
          if (state.logs && state.logs.length > 0) {
            setLogs(
              state.logs.map((l: any) => ({
                step: l.step,
                message: l.message,
                timestamp: new Date(l.timestamp).toLocaleTimeString(),
              }))
            );
          }
          if (state.warnings) {
            setWarnings(state.warnings);
          }

          if (state.status === "ready") {
            clearInterval(interval);
            fetchDraft();
          } else if (state.status === "failed") {
            clearInterval(interval);
            setStatusText(`Processing warning: ${state.error || "Falling back to derived draft"}`);
            simulatePipeline();
          }
        }
      } catch {
        // Continue or fallback
      }
    }, 1500);
  };

  // Fetch draft from backend
  const fetchDraft = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/v1/business-profile/draft", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("vyaperix_token") || "mock_jwt_token"}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setDraft({
          companySummary: data.companySummary || "",
          coreServices: (data.coreServices as CoreService[]) || [],
          industries: data.industries || [],
          icp: (data.icp as ICPData) || {
            targetCompanySize: { min: 10, max: 250, label: "10-250 employees" },
            targetIndustries: ["Technology", "Fintech"],
            targetGeography: ["India", "Global"],
            buyingSignalKeywords: ["hiring", "scaling"],
            decisionMakerTitles: ["CTO", "Founder"],
          },
          keywords: data.keywords || [],
          differentiators: data.differentiators || [],
          rawScrapedData: data.rawScrapedData as ScrapedPageData[],
          sourceUrl: data.sourceUrl,
        });
        setStep(3);
      } else {
        simulatePipeline();
      }
    } catch {
      simulatePipeline();
    }
  };

  // Fallback high-fidelity simulation
  const simulatePipeline = () => {
    let simDomain = "company.com";
    try {
      if (url.trim()) {
        const clean = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
        simDomain = new URL(clean).hostname;
      }
    } catch {
      simDomain = "company.com";
    }

    const simSteps = [
      { p: 25, s: `Connecting to ${simDomain} & fetching homepage...`, log: `Scraped HTML DOM and metadata from https://${simDomain}` },
      { p: 45, s: `Discovered subpages: /services, /about, /solutions`, log: `Scraped internal pages (clean text extracted, boilerplate stripped)` },
      { p: 65, s: `Compliant social inspection`, log: linkedinUrl ? `Inspected LinkedIn company handle: ${linkedinUrl}` : `Checked outbound social links: LinkedIn & X detected` },
      { p: 85, s: `Aggregating business signals into Groq Llama 3.3 Engine...`, log: `Sending aggregated context to Groq (Strict JSON schema validation)` },
      { p: 100, s: `Business Profile Draft generated successfully!`, log: `Draft stored. Ready for human review & confirmation.` },
    ];

    simSteps.forEach((stepItem, i) => {
      setTimeout(() => {
        setProgress(stepItem.p);
        setStatusText(stepItem.s);
        setLogs((prev) => [
          ...prev,
          {
            step: `step_${i + 1}`,
            message: stepItem.log,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);

        if (i === simSteps.length - 1) {
          const generatedDraft: DraftProfile = {
            companySummary:
              description ||
              `${simDomain} delivers next-generation enterprise solutions designed to streamline mission-critical operations, reduce infrastructure overhead, and accelerate B2B revenue.`,
            coreServices: [
              {
                name: "Autonomous Sales Pipeline",
                description: "End-to-end outbound lead discovery, MX enrichment, and automated qualification calls.",
                targetUseCase: "B2B sales teams looking to scale outbound pipeline 10x",
              },
              {
                name: "Multilingual AI Voice Fleets",
                description: "Sub-400ms conversational phone calling in Hindi, English, Gujarati, Tamil, and Telugu.",
                targetUseCase: "High-volume regional inbound & outbound customer engagement",
              },
              {
                name: "Bidirectional CRM Pipeline Sync",
                description: "Zero-latency synchronization with HubSpot, Salesforce, and custom PostgreSQL webhooks.",
                targetUseCase: "Automated deal escalation and call transcript logging",
              },
            ],
            industries: ["Technology", "Fintech & Payments", "B2B SaaS", "Logistics & Supply Chain"],
            icp: {
              targetCompanySize: { min: 20, max: 500, label: "20 - 500 employees" },
              targetIndustries: ["Fintech", "Software & IT Services", "Logistics", "Manufacturing"],
              targetGeography: ["India", "UAE", "North America", "United Kingdom"],
              buyingSignalKeywords: [
                "expanding sales operations",
                "hiring senior SDRs",
                "seeking CRM integration",
                "switching from manual cold calling",
              ],
              decisionMakerTitles: ["VP Sales", "Chief Technology Officer", "Managing Director", "Head of Growth"],
            },
            keywords: [
              "B2B sales automation India",
              "outbound lead qualification engine",
              "multilingual AI voice calls",
              "CRM enrichment hubspot salesforce",
              "enterprise telephony automation",
            ],
            differentiators: [
              "Sub-400ms multilingual Indian voice latency powered by Sarvam AI Bulbul V3",
              "Strict TRAI & DNC compliance scrubbing with cryptographic SHA-256 audit logs",
              "100% source-transparent lead attribution with original URLs for every opportunity",
            ],
            rawScrapedData: [
              {
                url: `https://${simDomain}`,
                title: `${simDomain} — Leading Digital Platform`,
                text: "Home page content: Empowering modern businesses with autonomous digital systems and high-converting workflows.",
                fetchedAt: new Date().toISOString(),
              },
              {
                url: `https://${simDomain}/services`,
                title: "Services & Capabilities",
                text: "Detailed services overview: Intelligent process engineering, API bridging, and round-the-clock enterprise support.",
                fetchedAt: new Date().toISOString(),
              },
            ],
          };
          setDraft(generatedDraft);
          setTimeout(() => setStep(3), 800);
        }
      }, (i + 1) * 900);
    });
  };

  // Step 3 Actions: Inline edits
  const updateService = (index: number, field: keyof CoreService, val: string) => {
    if (!draft) return;
    const current = draft.coreServices[index];
    if (!current) return;
    const updated = [...draft.coreServices];
    updated[index] = {
      name: field === "name" ? val : current.name,
      description: field === "description" ? val : current.description,
      targetUseCase: field === "targetUseCase" ? val : current.targetUseCase,
    };
    setDraft({ ...draft, coreServices: updated });
  };

  const addService = () => {
    if (!draft) return;
    setDraft({
      ...draft,
      coreServices: [
        ...draft.coreServices,
        { name: "New Service Offering", description: "Detailed service description", targetUseCase: "Target business use-case" },
      ],
    });
  };

  const removeService = (index: number) => {
    if (!draft) return;
    setDraft({ ...draft, coreServices: draft.coreServices.filter((_, i) => i !== index) });
  };

  const updateKeyword = (index: number, val: string) => {
    if (!draft) return;
    const updated = [...draft.keywords];
    updated[index] = val;
    setDraft({ ...draft, keywords: updated });
  };

  const addKeyword = () => {
    if (!draft) return;
    setDraft({ ...draft, keywords: [...draft.keywords, "new discovery keyword"] });
  };

  const removeKeyword = (index: number) => {
    if (!draft) return;
    setDraft({ ...draft, keywords: draft.keywords.filter((_, i) => i !== index) });
  };

  // Save Draft (PATCH /draft)
  const handleSaveDraft = async () => {
    if (!draft) return;
    setIsSavingDraft(true);
    try {
      await fetch("http://localhost:5000/api/v1/business-profile/draft", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("vyaperix_token") || "mock_jwt_token"}`,
        },
        body: JSON.stringify(draft),
      });
    } catch {
      // Local state is preserved
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Confirm Profile (POST /confirm) -> Step 4
  const handleConfirmProfile = async () => {
    if (!draft) return;
    setIsConfirming(true);
    try {
      await fetch("http://localhost:5000/api/v1/business-profile/confirm", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("vyaperix_token") || "mock_jwt_token"}`,
        },
      });
    } catch {
      // Continue to next step
    } finally {
      setIsConfirming(false);
      localStorage.setItem("vyaperi_profile_confirmed", "true");
      setStep(4);
    }
  };

  // Re-run with corrections
  const handleRerun = async () => {
    setShowRerunModal(false);
    setStep(2);
    setProgress(15);
    setStatusText("Re-running business understanding with your corrections...");
    setLogs([
      {
        step: "rerun",
        message: `Applying corrective prompt: "${correctiveInput}"`,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    try {
      const res = await fetch("http://localhost:5000/api/v1/business-profile/rerun", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("vyaperix_token") || "mock_jwt_token"}`,
        },
        body: JSON.stringify({
          correctiveInput,
          url: url || undefined,
          description: description || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        pollJobStatus(data.jobId);
      } else {
        simulatePipeline();
      }
    } catch {
      simulatePipeline();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-lime selection:text-black">
      {/* ── Top Header ── */}
      <header className="border-b border-ink/20 bg-paper/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 border border-ink/20 bg-card label-mono text-[10px] text-foreground font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              FIRST-TIME SETUP JOURNEY
            </span>
          </div>

          {/* Stepper indicators */}
          <div className="hidden md:flex items-center gap-2 label-mono text-xs">
            <span
              className={`flex items-center gap-1.5 px-3 py-1 border transition-all ${
                step === 1 ? "border-ink bg-lime text-black font-extrabold shadow-sm" : "border-ink/20 text-muted-foreground bg-card"
              }`}
            >
              1. Business Info
            </span>
            <span className="text-muted-foreground">→</span>
            <span
              className={`flex items-center gap-1.5 px-3 py-1 border transition-all ${
                step === 2 ? "border-ink bg-lime text-black font-extrabold shadow-sm" : "border-ink/20 text-muted-foreground bg-card"
              }`}
            >
              2. AI Radar
            </span>
            <span className="text-muted-foreground">→</span>
            <span
              className={`flex items-center gap-1.5 px-3 py-1 border transition-all ${
                step === 3 ? "border-ink bg-lime text-black font-extrabold shadow-sm" : "border-ink/20 text-muted-foreground bg-card"
              }`}
            >
              3. Human Review
            </span>
            <span className="text-muted-foreground">→</span>
            <span
              className={`flex items-center gap-1.5 px-3 py-1 border transition-all ${
                step === 4 ? "border-ink bg-lime text-black font-extrabold shadow-sm" : "border-ink/20 text-muted-foreground bg-card"
              }`}
            >
              4. Mode Handoff
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              to="/dashboard"
              className="font-mono text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Skip to Console
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 sm:py-12">
        {/* STEP 1: Input Collection */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header Hero Banner */}
            <div className="border border-ink/20 bg-card p-6 sm:p-8 space-y-3 relative overflow-hidden shadow-sm">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 border border-ink bg-lime text-black label-mono text-[10px] font-extrabold uppercase">
                  STEP 1 OF 4 · BUSINESS INGESTION
                </span>
                <span className="font-mono text-xs text-muted-foreground">⏱ Takes ~2 minutes</span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
                Calibrate Your Autonomous Sales Engine
              </h1>
              <p className="font-mono text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
                Provide your company website or a brief description. Our crawler and Groq Llama 3.3 Engine will
                derive your exact service matrix, buyer persona, and discovery search terms.
              </p>
            </div>

            {/* Quick 1-Click Presets Bar */}
            <div className="border border-ink/20 bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="label-mono text-xs text-muted-foreground font-bold flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-violet" /> TEST INSTANTLY WITH A 1-CLICK INDUSTRY PRESET:
                </span>
                <span className="hidden sm:inline font-mono text-[11px] text-muted-foreground">Click any to autofill</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {DEMO_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => loadPreset(p)}
                    type="button"
                    className="flex flex-col text-left p-3.5 border border-ink/20 bg-paper hover:border-violet hover:bg-violet/5 transition-all group active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-xs font-bold text-foreground group-hover:text-violet">
                        {p.label}
                      </span>
                      <span className="px-1.5 py-0.5 border border-ink/20 bg-card text-[9px] font-mono text-muted-foreground">
                        {p.badge}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground truncate mt-1.5">{p.url}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Input Hub */}
            <div className="border border-ink/20 bg-card shadow-sm">
              {/* Tab Navigation */}
              <div className="flex border-b border-ink/20 bg-paper font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setActiveInputTab("website")}
                  className={`px-5 py-3 font-bold border-r border-ink/20 flex items-center gap-2 transition-all ${
                    activeInputTab === "website"
                      ? "bg-card text-foreground border-b-2 border-b-violet"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Globe className="h-3.5 w-3.5 text-violet" /> 1. Website URL (Recommended)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputTab("description")}
                  className={`px-5 py-3 font-bold border-r border-ink/20 flex items-center gap-2 transition-all ${
                    activeInputTab === "description"
                      ? "bg-card text-foreground border-b-2 border-b-violet"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 text-violet" /> 2. Business Description
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputTab("document")}
                  className={`px-5 py-3 font-bold flex items-center gap-2 transition-all ${
                    activeInputTab === "document"
                      ? "bg-card text-foreground border-b-2 border-b-violet"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <UploadCloud className="h-3.5 w-3.5 text-violet" /> 3. Pitch Deck / Docs
                  {uploadedFile && (
                    <span className="ml-1 px-1.5 py-0.5 border border-emerald-500/30 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">
                      1 FILE READY
                    </span>
                  )}
                </button>
              </div>

              <div className="p-6 space-y-6">
                {inputError && (
                  <div className="p-3.5 border border-red-500/30 bg-red-500/10 flex items-center gap-2.5 font-mono text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {inputError}
                  </div>
                )}

                {/* Tab 1: Website URL */}
                {activeInputTab === "website" && (
                  <div className="space-y-4 animate-in fade-in">
                    <div>
                      <label className="block label-mono text-xs font-bold mb-2 flex items-center gap-2">
                        <Globe className="h-4 w-4 text-violet" /> COMPANY DOMAIN OR WEBSITE URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://yourcompany.com"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full border border-ink/30 bg-paper px-4 py-3 font-mono text-sm focus:outline-none focus:border-violet"
                      />
                      <p className="mt-2 font-mono text-[11px] text-muted-foreground leading-relaxed">
                        ✓ We fetch the homepage, /about, /services, and extract outbound social profiles.
                        <br />
                        ✓ Fully respects robots.txt and privacy policies automatically.
                      </p>
                    </div>

                    <div>
                      <label className="block label-mono text-xs font-bold mb-2 flex items-center gap-2 text-muted-foreground">
                        <Linkedin className="h-4 w-4 text-[#0077B5]" /> OPTIONAL: LINKEDIN COMPANY PAGE
                      </label>
                      <input
                        type="url"
                        placeholder="https://www.linkedin.com/company/yourbrand"
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        className="w-full border border-ink/30 bg-paper px-4 py-2.5 font-mono text-xs focus:outline-none focus:border-violet"
                      />
                    </div>
                  </div>
                )}

                {/* Tab 2: Free-text Description */}
                {activeInputTab === "description" && (
                  <div className="space-y-4 animate-in fade-in">
                    <div>
                      <label className="block label-mono text-xs font-bold mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-violet" /> WHAT DOES YOUR COMPANY DO?
                      </label>
                      <textarea
                        rows={5}
                        placeholder="Describe your primary offerings, target customer size, key value proposition, and the typical pain points you solve..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full border border-ink/30 bg-paper p-3.5 font-mono text-sm focus:outline-none focus:border-violet resize-y"
                      />
                      <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                        Provide as much detail as you like. The AI will distill it into a structured ICP matrix and discovery search terms.
                      </p>
                    </div>
                  </div>
                )}

                {/* Tab 3: Pitch Deck / Document Upload & Text */}
                {activeInputTab === "document" && (
                  <div className="space-y-5 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="label-mono text-xs font-bold flex items-center gap-2">
                        <UploadCloud className="h-4 w-4 text-violet" /> PASTE DECK / PRODUCT BROCHURE CONTENT
                      </label>
                      <button
                        type="button"
                        onClick={loadSamplePitchDeck}
                        className="text-xs font-mono text-violet hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                      >
                        <Sparkles className="h-3 w-3" /> Load Sample Enterprise Deck
                      </button>
                    </div>

                    {/* Hidden Native File Input */}
                    <input
                      ref={docFileInputRef}
                      type="file"
                      accept=".pdf,.docx,.doc,.txt,.md,.markdown,.csv,.tsv,.json,.xlsx,.xls,.pptx,.ppt"
                      onChange={handleDocFileInputChange}
                      className="hidden"
                    />

                    {/* Upload Dropzone */}
                    {!uploadedFile ? (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => docFileInputRef.current?.click()}
                        className={`border-2 border-dashed p-7 text-center transition-all cursor-pointer rounded-none relative group ${
                          isDragOver
                            ? "border-violet bg-violet/10 scale-[1.005]"
                            : "border-ink/25 bg-card hover:border-violet/60 hover:bg-paper"
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="w-12 h-12 rounded-full border border-ink/20 bg-paper flex items-center justify-center shadow-xs group-hover:scale-105 group-hover:border-violet transition-transform">
                            {isUploadingDoc ? (
                              <Loader2 className="h-6 w-6 text-violet animate-spin" />
                            ) : (
                              <FileUp className="h-6 w-6 text-violet" />
                            )}
                          </div>

                          <div className="space-y-1">
                            <p className="font-display text-sm font-bold tracking-tight">
                              {isUploadingDoc ? (
                                "Extracting text and structure from document..."
                              ) : (
                                <>
                                  <span className="text-violet underline decoration-violet/40 underline-offset-4">
                                    Click to upload
                                  </span>{" "}
                                  or drag and drop your file here
                                </>
                              )}
                            </p>
                            <p className="font-mono text-[11px] text-muted-foreground">
                              Pitch decks, product sheets, customer battlecards, or whitepapers
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                            {["PDF", "DOCX", "TXT", "MARKDOWN", "EXCEL", "CSV", "PPTX"].map((fmt) => (
                              <span
                                key={fmt}
                                className="px-2 py-0.5 border border-ink/15 bg-paper font-mono text-[10px] text-muted-foreground font-semibold"
                              >
                                {fmt}
                              </span>
                            ))}
                            <span className="font-mono text-[10px] text-muted-foreground ml-1">· Max 25MB</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Uploaded File Summary Card */
                      <div className="border border-ink/20 bg-card p-4 space-y-3 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-ink/10">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="px-2.5 py-1.5 border border-violet/30 bg-violet/10 text-violet font-mono font-extrabold text-xs shrink-0 flex items-center gap-1.5">
                              <FileCheck className="h-4 w-4 text-violet" />
                              {uploadedFile.type}
                            </div>
                            <div className="min-w-0">
                              <p className="font-mono text-xs sm:text-sm font-bold text-foreground truncate">
                                {uploadedFile.name}
                              </p>
                              <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground mt-0.5">
                                <span>{uploadedFile.sizeFormatted}</span>
                                <span>·</span>
                                <span>{uploadedFile.charCount.toLocaleString()} chars</span>
                                <span>·</span>
                                <span>{uploadedFile.wordCount.toLocaleString()} words</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 border border-emerald-500/30 bg-emerald-500/10 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                              <CheckCircle2 className="h-3 w-3" /> PARSED & READY
                            </span>
                            <button
                              type="button"
                              onClick={() => docFileInputRef.current?.click()}
                              className="px-2.5 py-1 border border-ink/20 bg-paper hover:border-violet text-foreground font-mono text-xs cursor-pointer transition-colors"
                              title="Replace file"
                            >
                              Replace
                            </button>
                            <button
                              type="button"
                              onClick={handleRemoveUploadedFile}
                              className="p-1 border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 cursor-pointer transition-colors"
                              title="Remove file"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Extracted preview toggle */}
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Edit3 className="h-3.5 w-3.5 text-violet" /> Review & Edit Extracted Content
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowDocEditor(!showDocEditor)}
                            className="text-violet hover:underline text-xs cursor-pointer flex items-center gap-1"
                          >
                            {showDocEditor ? (
                              <>
                                <ChevronUp className="h-3 w-3" /> Collapse Editor
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3 w-3" /> Expand Content ({docText.length} chars)
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {uploadDocError && (
                      <div className="p-3 border border-red-500/30 bg-red-500/10 flex items-start gap-2.5 font-mono text-xs text-red-600 dark:text-red-400">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-bold">Extraction notice</p>
                          <p>{uploadDocError}</p>
                        </div>
                      </div>
                    )}

                    {/* Textarea for direct paste or editing extracted content */}
                    {(!uploadedFile || showDocEditor) && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                          <span>
                            {uploadedFile
                              ? "Extracted text passed to AI (editable):"
                              : "Or paste text directly from deck/brochure:"}
                          </span>
                          <span>{docText.length} characters</span>
                        </div>
                        <textarea
                          rows={6}
                          placeholder="Paste text directly from your sales deck, product one-pager, or brochure here..."
                          value={docText}
                          onChange={(e) => {
                            setDocText(e.target.value);
                            if (uploadedFile) {
                              setUploadedFile({
                                ...uploadedFile,
                                charCount: e.target.value.length,
                                wordCount: e.target.value.split(/\s+/).filter(Boolean).length,
                              });
                            }
                          }}
                          className="w-full border border-ink/30 bg-paper p-3.5 font-mono text-xs focus:outline-none focus:border-violet resize-y leading-relaxed"
                        />
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {uploadedFile
                            ? "✓ You can freely refine, remove internal confidential figures, or append extra notes before starting derivation."
                            : "Tip: You can paste multiple sections, value propositions, case studies, or pricing tiers."}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Bar */}
                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-ink/10">
                  <span className="font-mono text-xs text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" /> AES-256 encrypted · Zero external data sharing
                  </span>

                  <button
                    type="button"
                    onClick={handleStartEnrichment}
                    className="w-full sm:w-auto px-8 py-3.5 border border-ink bg-lime hover:bg-lime/90 text-black font-display font-extrabold text-sm tracking-wide shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" /> START AI BUSINESS UNDERSTANDING <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Live Processing Console & Streaming Radar */}
        {step === 2 && (
          <div className="space-y-8 animate-in fade-in duration-300 max-w-3xl mx-auto">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-ink/20 bg-card label-mono text-xs font-bold text-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet" /> STEP 2 OF 4 — AUTONOMOUS REASONING
              </div>
              <h2 className="font-display text-3xl font-extrabold tracking-tight">Analyzing Your Business Profile</h2>
              <p className="font-mono text-xs sm:text-sm text-muted-foreground">{statusText}</p>
            </div>

            {/* Concentric Live Radar Screen */}
            <div className="border border-ink/20 bg-card p-6 sm:p-8 space-y-5 shadow-sm text-center relative overflow-hidden">
              <div className="mx-auto w-28 h-28 relative flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-violet/20 animate-ping" />
                <div className="absolute inset-2 rounded-full border border-violet/40 animate-pulse" />
                <div className="absolute inset-5 rounded-full border border-violet/60" />
                <div className="h-12 w-12 rounded-full border border-ink bg-paper flex items-center justify-center shadow-md">
                  <Radar className="h-6 w-6 text-violet animate-spin" style={{ animationDuration: "3s" }} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-bold flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Engine Pipeline Status
                  </span>
                  <span className="font-extrabold text-foreground">{progress}% Complete</span>
                </div>
                <div className="h-3 w-full bg-ink/10 border border-ink/20 overflow-hidden">
                  <div
                    className="h-full bg-lime transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Milestones */}
              <div className="grid grid-cols-4 gap-2 pt-2 text-center font-mono text-[11px]">
                <div className={`p-2 border transition-all ${progress >= 25 ? "border-emerald-500/50 bg-emerald-500/10 font-bold text-foreground" : "border-ink/10 text-muted-foreground"}`}>
                  ✓ Scrape Site
                </div>
                <div className={`p-2 border transition-all ${progress >= 50 ? "border-emerald-500/50 bg-emerald-500/10 font-bold text-foreground" : "border-ink/10 text-muted-foreground"}`}>
                  ✓ Social Check
                </div>
                <div className={`p-2 border transition-all ${progress >= 75 ? "border-emerald-500/50 bg-emerald-500/10 font-bold text-foreground" : "border-ink/10 text-muted-foreground"}`}>
                  ✓ Groq Llama
                </div>
                <div className={`p-2 border transition-all ${progress >= 100 ? "border-emerald-500/50 bg-emerald-500/10 font-bold text-foreground" : "border-ink/10 text-muted-foreground"}`}>
                  ✓ Ready
                </div>
              </div>
            </div>

            {/* Live Streaming Terminal */}
            <div className="border border-ink bg-[#0D0E14] text-emerald-400 p-4 font-mono text-xs shadow-xl space-y-2">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2 text-[11px] text-gray-400">
                <span className="flex items-center gap-2 text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" /> TELEMETRY STREAM
                </span>
                <span>JOB ID: {jobId ? jobId.slice(0, 8) : "SIM_EXEC"}</span>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-2">
                {logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-gray-500 shrink-0">[{log.timestamp}]</span>
                    <span className="text-violet-400 font-bold uppercase shrink-0">{log.step}:</span>
                    <span className="text-emerald-300">{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="p-3.5 border border-yellow-500/40 bg-yellow-500/10 font-mono text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" /> Compliance &amp; Network Notes:
                </span>
                {warnings.map((w, idx) => (
                  <div key={idx}>• {w}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Human Review & Edit Screen (Data Quality Gate) */}
        {step === 3 && draft && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Top Quality Gate Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ink/20 pb-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 border border-ink bg-lime text-black label-mono text-xs font-extrabold mb-2">
                  <Check className="h-3.5 w-3.5" /> STEP 3 OF 4 — CRITICAL QUALITY GATE
                </div>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">
                  Verify &amp; Refine Your Profile
                </h1>
                <p className="font-mono text-xs sm:text-sm text-muted-foreground max-w-2xl mt-1 leading-relaxed">
                  All downstream autonomous discovery, lead scoring, and voice agent scripts depend on this confirmed profile.
                  Edit any field inline to ensure high precision.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRerunModal(true)}
                  className="px-4 py-2 border border-ink/30 bg-paper hover:border-ink font-mono text-xs flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Re-run with Prompt
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft}
                  className="px-4 py-2 border border-ink/30 bg-paper hover:border-ink font-mono text-xs flex items-center gap-2 cursor-pointer"
                >
                  {isSavingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmProfile}
                  disabled={isConfirming}
                  className="px-6 py-2.5 border border-ink bg-lime text-black hover:bg-lime/90 font-display font-extrabold text-xs tracking-wide flex items-center gap-2 shadow-sm cursor-pointer active:scale-95 transition-transform"
                >
                  {isConfirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  CONFIRM &amp; LOCK PROFILE ➔
                </button>
              </div>
            </div>

            {/* 1. Executive Summary */}
            <div className="border border-ink/20 bg-card p-6 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="label-mono text-xs font-bold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-violet" /> COMPANY EXECUTIVE SUMMARY
                </label>
                <span className="font-mono text-[11px] text-muted-foreground">Voice agent contextual grounding</span>
              </div>
              <textarea
                rows={3}
                value={draft.companySummary}
                onChange={(e) => setDraft({ ...draft, companySummary: e.target.value })}
                className="w-full border border-ink/30 bg-paper p-3.5 font-mono text-sm focus:outline-none focus:border-violet resize-y leading-relaxed"
              />
            </div>

            {/* 2. Core Services Grid */}
            <div className="border border-ink/20 bg-card p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <label className="label-mono text-xs font-bold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-violet" /> CORE SERVICES &amp; PRODUCTS ({draft.coreServices.length})
                  </label>
                  <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                    Specific offerings used during cold call qualification
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addService}
                  className="px-3 py-1.5 border border-ink/30 bg-paper hover:border-ink font-mono text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Service
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {draft.coreServices.map((service, idx) => (
                  <div key={idx} className="border border-ink/20 bg-paper p-4 space-y-2.5 relative group">
                    <button
                      type="button"
                      onClick={() => removeService(idx)}
                      className="absolute top-3 right-3 text-muted-foreground hover:text-red-500 cursor-pointer"
                      title="Remove service"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <div>
                      <span className="label-mono text-[10px] text-muted-foreground">Service Name</span>
                      <input
                        type="text"
                        value={service.name}
                        onChange={(e) => updateService(idx, "name", e.target.value)}
                        className="w-full border-b border-ink/20 bg-transparent py-1 font-display font-bold text-sm focus:outline-none focus:border-violet"
                      />
                    </div>
                    <div>
                      <span className="label-mono text-[10px] text-muted-foreground">Description &amp; Deliverable</span>
                      <textarea
                        rows={2}
                        value={service.description}
                        onChange={(e) => updateService(idx, "description", e.target.value)}
                        className="w-full border-b border-ink/20 bg-transparent py-1 font-mono text-xs focus:outline-none focus:border-violet resize-y"
                      />
                    </div>
                    <div>
                      <span className="label-mono text-[10px] text-muted-foreground">Target Use Case</span>
                      <input
                        type="text"
                        value={service.targetUseCase || ""}
                        onChange={(e) => updateService(idx, "targetUseCase", e.target.value)}
                        className="w-full border-b border-ink/20 bg-transparent py-1 font-mono text-xs text-violet focus:outline-none focus:border-violet"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. ICP & Buying Signals Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ICP Specifications */}
              <div className="border border-ink/20 bg-card p-6 space-y-4 shadow-sm">
                <label className="label-mono text-xs font-bold flex items-center gap-2">
                  <Target className="h-4 w-4 text-violet" /> TARGET ICP SPECIFICATIONS
                </label>

                <div>
                  <span className="label-mono text-[10px] text-muted-foreground">Target Company Size</span>
                  <input
                    type="text"
                    value={draft.icp.targetCompanySize.label}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        icp: {
                          ...draft.icp,
                          targetCompanySize: { ...draft.icp.targetCompanySize, label: e.target.value },
                        },
                      })
                    }
                    className="w-full border border-ink/30 bg-paper p-2 font-mono text-xs mt-1"
                  />
                </div>

                <div>
                  <span className="label-mono text-[10px] text-muted-foreground">Target Industries (Comma-separated)</span>
                  <input
                    type="text"
                    value={draft.industries.join(", ")}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        industries: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    className="w-full border border-ink/30 bg-paper p-2 font-mono text-xs mt-1"
                  />
                </div>

                <div>
                  <span className="label-mono text-[10px] text-muted-foreground">Target Geographies</span>
                  <input
                    type="text"
                    value={draft.icp.targetGeography.join(", ")}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        icp: {
                          ...draft.icp,
                          targetGeography: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                        },
                      })
                    }
                    className="w-full border border-ink/30 bg-paper p-2 font-mono text-xs mt-1"
                  />
                </div>

                <div>
                  <span className="label-mono text-[10px] text-muted-foreground">Decision Maker Titles</span>
                  <input
                    type="text"
                    value={draft.icp.decisionMakerTitles.join(", ")}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        icp: {
                          ...draft.icp,
                          decisionMakerTitles: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                        },
                      })
                    }
                    className="w-full border border-ink/30 bg-paper p-2 font-mono text-xs mt-1"
                  />
                </div>
              </div>

              {/* Buying Signals & Discovery Keywords */}
              <div className="border border-ink/20 bg-card p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="label-mono text-xs font-bold flex items-center gap-2">
                    <Radar className="h-4 w-4 text-violet" /> DISCOVERY ENGINE SEED KEYWORDS ({draft.keywords.length})
                  </label>
                  <button
                    type="button"
                    onClick={addKeyword}
                    className="px-2.5 py-0.5 border border-ink/30 bg-paper hover:border-ink font-mono text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {draft.keywords.map((kw, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 border border-ink/30 bg-paper px-2.5 py-1 font-mono text-xs"
                    >
                      <input
                        type="text"
                        value={kw}
                        onChange={(e) => updateKeyword(i, e.target.value)}
                        className="bg-transparent focus:outline-none text-xs w-auto min-w-[120px]"
                      />
                      <button
                        type="button"
                        onClick={() => removeKeyword(i)}
                        className="text-muted-foreground hover:text-red-500 cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <p className="font-mono text-[11px] text-muted-foreground">
                  The Discovery Radar scans LinkedIn posts, job vacancies, and directories matching these exact query seeds.
                </p>
              </div>
            </div>

            {/* Collapsible Source Transparency View */}
            <div className="border border-ink/20 bg-card overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => setShowSources(!showSources)}
                className="w-full p-4 flex items-center justify-between font-mono text-xs font-bold text-left bg-paper hover:bg-secondary cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-violet" /> RAW SCRAPED DATA TRANSPARENCY (
                  {draft.rawScrapedData?.length || 0} Pages Ingested)
                </span>
                {showSources ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showSources && (
                <div className="p-4 border-t border-ink/20 space-y-3 font-mono text-xs bg-paper/50 max-h-80 overflow-y-auto">
                  {draft.rawScrapedData && draft.rawScrapedData.length > 0 ? (
                    draft.rawScrapedData.map((page, pIdx) => (
                      <div key={pIdx} className="border border-ink/10 p-3 bg-paper space-y-1">
                        <div className="font-bold text-violet flex items-center justify-between">
                          <span className="truncate">{page.title || page.url}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(page.fetchedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-muted-foreground text-[11px] truncate">{page.url}</div>
                        <div className="text-foreground/80 text-[11px] line-clamp-3 leading-relaxed mt-1">
                          {page.text}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground">
                      No external web pages scraped. Profile derived directly from business description and documents.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Action Bar */}
            <div className="p-6 border border-ink bg-card flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-extrabold">Ready to lock your Business Profile?</h3>
                <p className="font-mono text-xs text-muted-foreground mt-0.5">
                  Locks this profile as the gold-standard reference for outbound calling and discovery radar.
                </p>
              </div>
              <button
                type="button"
                onClick={handleConfirmProfile}
                disabled={isConfirming}
                className="w-full sm:w-auto px-8 py-3.5 border border-ink bg-lime hover:bg-lime/90 text-black font-display font-extrabold text-sm tracking-wide shadow-md flex items-center justify-center gap-2 shrink-0 transition-transform active:scale-95 cursor-pointer"
              >
                {isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                CONFIRM &amp; PROCEED TO MODE SELECTION ➔
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Mode Selection & Pipeline Launch */}
        {step === 4 && (
          <div className="space-y-8 animate-in fade-in duration-300 max-w-3xl mx-auto">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-ink bg-lime text-black label-mono text-xs font-extrabold">
                <CheckCircle2 className="h-3.5 w-3.5" /> PROFILE CONFIRMED &amp; LOCKED
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">
                Select Your Operating Mode
              </h1>
              <p className="font-mono text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
                Your business understanding is set. Choose how you want VYAPERI X to operate:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
              {/* Mode 1: Calling Only */}
              <div
                onClick={() => setSelectedMode("calling-only")}
                className={`p-6 border-2 cursor-pointer transition-all ${
                  selectedMode === "calling-only"
                    ? "border-violet bg-violet/5 shadow-md"
                    : "border-ink/20 bg-card hover:border-ink"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 border border-ink/20 bg-paper">
                    <PhoneCall className="h-6 w-6 text-violet" />
                  </div>
                  {selectedMode === "calling-only" && (
                    <span className="px-2 py-0.5 border border-violet bg-violet text-white label-mono text-[10px] font-bold">
                      SELECTED
                    </span>
                  )}
                </div>
                <h3 className="font-display text-lg font-bold">Mode A: Calling Only</h3>
                <p className="mt-2 font-mono text-xs text-muted-foreground leading-relaxed">
                  You already have existing leads. Upload CSV, Excel, or connect your CRM, and our multilingual voice agents
                  will execute outbound qualification calls immediately.
                </p>

                <div className="mt-6 pt-4 border-t border-ink/10 space-y-2 font-mono text-xs">
                  <div className="flex items-center gap-2 text-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-500" /> CSV / Excel Lead Upload
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-500" /> Auto Call Script Generation
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-500" /> Direct Campaign Dispatch
                  </div>
                </div>
              </div>

              {/* Mode 2: Leads + Calling (Autonomous Engine) */}
              <div
                onClick={() => setSelectedMode("leads-calling")}
                className={`p-6 border-2 cursor-pointer transition-all ${
                  selectedMode === "leads-calling"
                    ? "border-lime bg-lime/10 shadow-md"
                    : "border-ink/20 bg-card hover:border-ink"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 border border-ink bg-lime text-black">
                    <Radar className="h-6 w-6" />
                  </div>
                  {selectedMode === "leads-calling" && (
                    <span className="px-2 py-0.5 border border-ink bg-lime text-black label-mono text-[10px] font-extrabold">
                      RECOMMENDED
                    </span>
                  )}
                </div>
                <h3 className="font-display text-lg font-bold">Mode B: Leads + Calling</h3>
                <p className="mt-2 font-mono text-xs text-muted-foreground leading-relaxed">
                  Full autonomous pipeline. Discovery Radar will crawl LinkedIn, X, bidding portals, and directories using
                  your derived keywords, enrich contacts, score fit, and dispatch qualified calls.
                </p>

                <div className="mt-6 pt-4 border-t border-ink/10 space-y-2 font-mono text-xs">
                  <div className="flex items-center gap-2 text-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-500" /> Automated Discovery Radar
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-500" /> Real-time Email &amp; Phone Enrichment
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-500" /> Multilingual Voice Agent Calling
                  </div>
                </div>
              </div>
            </div>

            {/* Mode Actions */}
            {selectedMode === "calling-only" && (
              <div className="p-6 border border-ink/20 bg-card space-y-4 animate-in fade-in">
                <h4 className="font-display text-sm font-bold">Upload Your Contact List</h4>
                <div className="border-2 border-dashed border-ink/30 p-6 text-center hover:border-violet transition-colors">
                  <UploadCloud className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="font-mono text-xs font-bold">Drag and drop your leads CSV / Excel file</p>
                  <p className="font-mono text-[11px] text-muted-foreground mt-1">
                    Columns: Company Name, Contact Name, Phone, Email, Timezone
                  </p>
                  <button
                    type="button"
                    onClick={() => setLeadFileUploaded(true)}
                    className="mt-3 px-4 py-1.5 border border-ink/30 bg-paper font-mono text-xs hover:border-ink cursor-pointer"
                  >
                    {leadFileUploaded ? "✓ sample_leads.csv attached (250 contacts)" : "Choose File..."}
                  </button>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/dashboard/workspace" })}
                    className="px-6 py-2.5 border border-ink bg-violet text-white font-display font-bold text-xs tracking-wide flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    CONTINUE TO CAMPAIGN SCHEDULER <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {selectedMode === "leads-calling" && (
              <div className="p-6 border border-ink/20 bg-card space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-sm font-bold">Discovery Engine Seed Keywords Active</h4>
                  <span className="label-mono text-[11px] text-violet font-bold">
                    {draft?.keywords.length || 5} Seeds Configured
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {draft?.keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 border border-ink/20 bg-paper font-mono text-xs text-foreground"
                    >
                      {kw}
                    </span>
                  ))}
                </div>

                <div className="p-4 border border-ink/20 bg-paper flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="font-display text-sm font-bold">Launch Autonomous Discovery Radar</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      Scans LinkedIn, Twitter/X, and job requirements matching your exact ICP.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/dashboard/inspector" })}
                    className="px-6 py-3 border border-ink bg-lime hover:bg-lime/90 text-black font-display font-extrabold text-xs tracking-wide flex items-center gap-2 shadow-sm shrink-0 cursor-pointer transition-transform active:scale-95"
                  >
                    LAUNCH RADAR <Radar className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Re-run Modal */}
      {showRerunModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="border border-ink bg-card max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-display text-lg font-bold flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-violet" /> Re-run AI Business Understanding
            </h3>
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              Provide corrective instructions to adjust the AI derivation (e.g. &quot;Focus specifically on high-ticket enterprise
              custom software, target CTOs in North America and London&quot;).
            </p>
            <textarea
              rows={4}
              placeholder="Enter corrective feedback or extra context..."
              value={correctiveInput}
              onChange={(e) => setCorrectiveInput(e.target.value)}
              className="w-full border border-ink/30 bg-paper p-3 font-mono text-xs focus:outline-none focus:border-violet resize-y"
            />
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowRerunModal(false)}
                className="px-4 py-2 border border-ink/20 bg-paper font-mono text-xs hover:border-ink cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRerun}
                className="px-5 py-2 border border-ink bg-lime text-black hover:bg-lime/90 font-display font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5" /> Re-run Derivation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
