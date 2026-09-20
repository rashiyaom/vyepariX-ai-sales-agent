import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Database,
  CheckCircle2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Activity,
  Square,
} from "lucide-react";
import { useApp, type CallRecord } from "@/components/app/store";
import { useLang } from "@/components/app/lang";
import {
  Btn,
  LiveDot,
  OutcomeChip,
  PageHead,
  Panel,
  Shimmer,
  SpeakingWave,
  Stat,
  StatGrid,
  Tag,
  Bar,
} from "@/components/app/ui";
import {
  playRealVoiceAudio,
  stopRealVoiceAudio,
  DEMO_VOICE_AGENTS,
} from "@/components/app/voice-synthesizer";

export const Route = createFileRoute("/dashboard/attack-demo")({
  head: () => ({
    meta: [
      { title: "Live Call Operations Studio — VYAPERI X Sales Console" },
      {
        name: "description",
        content:
          "Interactive AI voice call simulator with real-time speech synthesis, DTMF tones, sentiment analysis, and CRM sync.",
      },
    ],
  }),
  component: LiveCallDemoPage,
});

/* DTMF Tone Synthesizer */
const DTMF_FREQS: Record<string, [number, number]> = {
  "1": [697, 1209],
  "2": [697, 1336],
  "3": [697, 1477],
  "4": [770, 1209],
  "5": [770, 1336],
  "6": [770, 1477],
  "7": [852, 1209],
  "8": [852, 1336],
  "9": [852, 1477],
  "*": [941, 1209],
  "0": [941, 1336],
  "#": [941, 1477],
};

function playDTMFTone(key: string) {
  try {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    const freqs = DTMF_FREQS[key] || [440, 880];
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.frequency.value = freqs[0];
    osc2.frequency.value = freqs[1];
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.15);
  } catch (e) {}
}

function LiveCallDemoPage() {
  const { t } = useLang();
  const { calls } = useApp();
  const [selected, setSelected] = useState<CallRecord | null>(calls[0] ?? null);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [crmSynced, setCrmSynced] = useState(false);
  const [dialledDigits, setDialledDigits] = useState("");
  const [liveSentiment, setLiveSentiment] = useState(78);

  const stepTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const stopAll = () => {
    if (stepTimeout.current) {
      clearTimeout(stepTimeout.current);
      stepTimeout.current = null;
    }
    stopRealVoiceAudio();
    setPlaying(false);
    setAgentSpeaking(false);
  };

  useEffect(() => () => stopAll(), []);

  // Smooth scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [step]);

  const playStep = (stepIdx: number) => {
    if (!selected || stepIdx >= selected.transcript.length) {
      setPlaying(false);
      setAgentSpeaking(false);
      setLiveSentiment(94);
      return;
    }

    const item = selected.transcript[stepIdx]!;
    const isAgent = item.who === "AGENT";
    setStep(stepIdx);
    setAgentSpeaking(isAgent);
    setLiveSentiment(68 + Math.floor(Math.random() * 25));

    // Determine language from selected record
    const langCode = selected.language.toLowerCase().includes("gujarati")
      ? ("gu" as const)
      : selected.language.toLowerCase().includes("hindi")
        ? ("hi" as const)
        : ("en" as const);

    // Pick the agent voice persona for this turn
    const gender = isAgent ? "female" : "male";
    const voiceAgent =
      DEMO_VOICE_AGENTS.find((a) => a.langCode === langCode && a.gender === gender) ??
      DEMO_VOICE_AGENTS.find((a) => a.langCode === langCode) ??
      DEMO_VOICE_AGENTS[0]!;

    playRealVoiceAudio({
      text: item.text,
      agent: voiceAgent,
      onStart: () => setAgentSpeaking(isAgent),
      onEnd: () => {
        stepTimeout.current = setTimeout(() => {
          playStep(stepIdx + 1);
        }, 850);
      },
    });
  };

  const play = () => {
    if (!selected) return;
    stopAll();
    setPlaying(true);
    setStep(0);
    setCrmSynced(false);
    setLiveSentiment(72);
    playStep(0);
  };

  const selectCall = (c: CallRecord) => {
    stopAll();
    setSelected(c);
    setStep(-1);
    setCrmSynced(false);
  };

  const pressKey = (k: string) => {
    playDTMFTone(k);
    setDialledDigits((prev) => (prev + k).slice(-15));
  };

  const syncToHubSpot = () => {
    setCrmSynced(true);
    playDTMFTone("9");
  };

  return (
    <div className="space-y-8">
      <PageHead
        index="/08"
        title={t("page.call.title")}
        subtitle="Live AI voice telephonic operations studio. Replay multilingual calls with real-time human speech synthesis & CRM sync."
        action={
          <div className="flex items-center gap-2">
            {playing ? (
              <Btn variant="danger" onClick={stopAll}>
                <Square className="h-3.5 w-3.5 fill-current" /> Stop Replay
              </Btn>
            ) : (
              <Btn variant="solid" onClick={play} disabled={!selected}>
                <PhoneCall className="h-3.5 w-3.5 text-lime" />
                {t("page.call.play")}
              </Btn>
            )}
          </div>
        }
      />

      <StatGrid>
        <Stat
          label="Total Calls Processed"
          value={String(calls.length + 9914)}
          note="Production SIP trunk active"
        />
        <Stat
          label="Interested Deals"
          value={String(calls.filter((c) => c.outcome === "INTERESTED").length + 412)}
          note="Pushed to CRM deals"
        />
        <Stat
          label="Scheduled Callbacks"
          value={String(calls.filter((c) => c.outcome === "CALLBACK").length + 189)}
          note="Auto-retry cadence"
        />
        <Stat label="Average Call Score" value="86/100" note="Calculated by AI adjudicator" />
      </StatGrid>

      {/* Studio Grid */}
      <div className="grid gap-8 lg:grid-cols-[300px_1.4fr_260px]">
        {/* Left Column: Call Selector Stream */}
        <Panel title="Live Call Logs" hint={`${calls.length} Active Records`}>
          <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
            {calls.map((c) => (
              <button
                key={c.id}
                onClick={() => selectCall(c)}
                className={`group w-full border p-3 text-left transition-all rounded hover:border-violet active:scale-[0.98] ${
                  selected?.id === c.id
                    ? "bg-card border-violet shadow-md border-l-4"
                    : "bg-paper border-border hover:bg-secondary"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-bold text-ink truncate">{c.lead}</span>
                  <span className="font-mono text-[9px] text-muted-foreground">{c.ts}</span>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground truncate mt-0.5">
                  {c.company} · <strong className="text-violet">{c.language}</strong>
                </div>
                <div className="mt-2.5 flex items-center justify-between">
                  <OutcomeChip outcome={c.outcome} />
                  <span className="font-mono text-[10px] text-muted-foreground">{c.duration}</span>
                </div>
              </button>
            ))}
          </div>
        </Panel>

        {/* Center Column: Live Transcript & Speech Radar */}
        {selected ? (
          <div className="space-y-6 fade-in">
            {/* Call Detail Header Card */}
            <div className="border border-border bg-card p-5 rounded space-y-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <OutcomeChip outcome={selected.outcome} />
                  <Tag
                    tone={selected.score > 80 ? "lime" : selected.score > 50 ? "violet" : "muted"}
                  >
                    AI Fit Score: {selected.score}/100
                  </Tag>
                  <Tag tone="violet">{selected.language}</Tag>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  Session ID: {selected.id}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-y-1.5 font-mono text-xs pt-2">
                <div>
                  <span className="text-muted-foreground">Prospect:</span>{" "}
                  <strong>{selected.lead}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Company:</span>{" "}
                  <strong>{selected.company}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span> {selected.duration}
                </div>
                <div>
                  <span className="text-muted-foreground">Timestamp:</span> {selected.ts} UTC+5:30
                </div>
              </div>

              <div className="border border-border/80 bg-secondary p-3 rounded font-mono text-xs leading-relaxed text-ink/90">
                <strong className="text-violet">AI Call Summary:</strong> {selected.summary}
              </div>
            </div>

            {/* Live Interactive Transcript Console */}
            <div className="border-2 border-border bg-card p-5 rounded shadow-lg text-ink space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="label-mono text-xs font-bold flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-violet" />
                  Speech Channel — {selected.language} (Real Spoken Audio)
                </div>
                {playing && (
                  <span className="inline-flex items-center gap-2 font-mono text-xs text-emerald-700 dark:text-lime font-bold">
                    <SpeakingWave active={true} />
                    {agentSpeaking ? "AI Voice Speaking" : "Prospect Speaking"}
                  </span>
                )}
                {!playing && step >= 0 && <LiveDot label="Call Completed" />}
              </div>

              {/* Transcript Speech Stream */}
              <div
                ref={scrollRef}
                className="space-y-3.5 max-h-72 overflow-y-auto pr-2 min-h-[160px]"
              >
                {(step < 0 ? selected.transcript : selected.transcript.slice(0, step + 1)).map(
                  (line, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded border font-mono text-xs leading-relaxed transition-all ${
                        line.who === "AGENT"
                          ? "bg-violet/10 border-violet/30 text-ink ml-4"
                          : "bg-secondary border-border mr-4"
                      } ${i === step && playing ? "border-l-4 border-lime shadow-sm" : ""}`}
                    >
                      <div className="flex items-center justify-between font-bold text-[10px] mb-1">
                        <span
                          className={line.who === "AGENT" ? "text-violet" : "text-muted-foreground"}
                        >
                          [
                          {line.who === "AGENT"
                            ? "VYAPERI X AI VOICE AGENT"
                            : selected.lead.toUpperCase()}
                          ]
                        </span>
                      </div>
                      <div>{line.text}</div>
                    </div>
                  ),
                )}
                {step < 0 && (
                  <div className="py-8 text-center font-mono text-xs text-muted-foreground">
                    // Click "Play Transcript" above to replay the interactive live speech session
                    with spoken voice
                  </div>
                )}
              </div>

              {/* Real-time Sentiment Bar */}
              <div className="border-t border-border pt-3 space-y-1.5">
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-muted-foreground">Prospect Intent & Sentiment</span>
                  <span className="font-bold text-emerald-700 dark:text-lime">
                    {liveSentiment}% (Positive Conversion Window)
                  </span>
                </div>
                <Bar value={liveSentiment} tone={liveSentiment > 75 ? "lime" : "violet"} />
              </div>
            </div>

            {/* Next Action & CRM Push Banner */}
            <div className="border border-border bg-paper p-4 rounded flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="label-mono text-[10px] text-muted-foreground">
                  Recommended Next Action:
                </div>
                <div className="font-mono text-xs font-bold text-ink mt-0.5">
                  {selected.nextAction}
                </div>
              </div>
              <Btn
                variant={crmSynced ? "lime" : "solid"}
                onClick={syncToHubSpot}
                className="text-xs"
              >
                {crmSynced ? (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Pushed to HubSpot Deal Pipeline
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-lime" /> Push Deal Object to CRM
                  </span>
                )}
              </Btn>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Shimmer className="h-48" />
            <Shimmer className="h-64" />
          </div>
        )}

        {/* Right Column: Telephonic Dialler Pad */}
        <div className="space-y-6">
          <Panel title="SIP Telephony Pad" hint="Live">
            <div className="space-y-4">
              {/* Dialler Display */}
              <div className="border border-border bg-ink/5 p-2.5 rounded text-right font-mono text-sm font-bold min-h-[38px] tracking-wider text-ink">
                {dialledDigits || <span className="text-muted-foreground/50">Enter digits...</span>}
              </div>

              {/* Dialpad Matrix */}
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (
                  <button
                    key={k}
                    onClick={() => pressKey(k)}
                    className="flex h-11 items-center justify-center border border-border bg-card font-display text-sm font-bold text-ink hover:bg-violet hover:text-white active:scale-95 transition-all rounded shadow-sm"
                  >
                    {k}
                  </button>
                ))}
              </div>

              {/* Call Control Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`flex items-center justify-center gap-1.5 border border-border py-2 text-xs font-mono rounded transition-colors ${
                    isMuted
                      ? "bg-danger text-white border-danger"
                      : "bg-card text-ink hover:bg-secondary"
                  }`}
                >
                  {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {isMuted ? "Muted" : "Mute"}
                </button>
                <button
                  onClick={() => {
                    setDialledDigits("");
                    playDTMFTone("*");
                  }}
                  className="flex items-center justify-center gap-1.5 border border-border bg-card py-2 text-xs font-mono text-ink hover:bg-secondary rounded transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" /> Clear
                </button>
              </div>
            </div>
          </Panel>

          <div className="border border-border bg-secondary/50 p-3.5 rounded space-y-2 font-mono text-[11px]">
            <div className="font-bold text-ink flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-lime" /> Zero-Latency
              Speech
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Sub-150ms speech synthesis model with direct SIP trunk connection for natural
              conversational turns.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
