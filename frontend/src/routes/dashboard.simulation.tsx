import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  PhoneCall,
  PhoneOff,
  Mic,
  Sparkles,
  Volume2,
  ShieldCheck,
  Play,
  Pause,
  Activity,
  Zap,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { useApp, type VoiceAgent } from "@/components/app/store";
import { useLang } from "@/components/app/lang";
import {
  Bar,
  Btn,
  Field,
  LiveDot,
  PageHead,
  Panel,
  SpeakingWave,
  Stat,
  StatGrid,
  Tag,
  Terminal,
  inputCls,
} from "@/components/app/ui";
import {
  playRealVoiceAudio,
  stopRealVoiceAudio,
  VoiceAgentSynthesizerWidget,
  DEMO_VOICE_AGENTS,
} from "@/components/app/voice-synthesizer";

export const Route = createFileRoute("/dashboard/simulation")({
  head: () => ({
    meta: [
      { title: "Voice Agent Fleet — VYAPERI X Sales Console" },
      {
        name: "description",
        content:
          "Configure, deploy, and simulate multilingual autonomous AI sales voice agents with real spoken voice audio.",
      },
    ],
  }),
  component: VoiceAgentsPage,
});

/* Multilingual Real Conversation Datasets */
const AGENT_CONVERSATIONS: Record<
  string,
  {
    role: "AGENT" | "PROSPECT";
    text: string;
    phoneticText: string;
    sentiment: number;
    lang: "hi" | "gu" | "en" | "es";
  }[]
> = {
  Dhruv: [
    {
      role: "AGENT",
      text: "નમસ્તે! હું વ્યાપારી X થી ધ્રુવ વાત કરું છું. આપની કંપની માટે Cloud ERP અને Inventory Automation સોલ્યુશન અંગે વાત કરવી હતી — શું આપ 2 મિનિટ ફાળવી શકશો?",
      phoneticText:
        "Namaste! Hoon Vyaapaari X thi Dhruv vaat karun chhun. Aapni company maate Cloud ERP ane Inventory Automation solution ange vaat karvi hati — shu aap bey minute faalvi shaksho?",
      sentiment: 75,
      lang: "gu",
    },
    {
      role: "PROSPECT",
      text: "હા ધ્રુવ ભાઈ, બોલો. અમે સુરત અને અમદાવાદના ગોડાઉન માટે સેન્ટ્રલાઇઝ્ડ સોફ્ટવેર શોધી રહ્યા છીએ.",
      phoneticText:
        "Haa Dhruv bhai, bolo. Ame Surat ane Ahmedabad na godown maate centralised software shodhhi rahya chhiye.",
      sentiment: 84,
      lang: "gu",
    },
    {
      role: "AGENT",
      text: "ખૂબ સરસ! અમારું સોલ્યુશન GST બિલિંગ, રિયલ-ટાઇમ સ્ટોક અને મલ્ટી-લોકેશન સિંક પૂરી રીતે ઓટોમેટ કરે છે. શું બુધવારે સવારે 10:30 વાગ્યે એક લાઈવ ડેમો રાખીએ?",
      phoneticText:
        "Khoob saras! Amaaru solution GST billing, real-time stock ane multi-location sync poori reete automate kare chhe. Shu budhvaare savaare das tees vaagye ek live demo raakhiye?",
      sentiment: 92,
      lang: "gu",
    },
    {
      role: "PROSPECT",
      text: "હા, બુધવારે ૧૦:૩૦ અનુકૂળ રહેશે. ઇમેઇલ પર લિંક મોકલી આપજો.",
      phoneticText: "Haa, budhvaare das tees anukool raheshe. Email par link mokli aapjo.",
      sentiment: 96,
      lang: "gu",
    },
    {
      role: "AGENT",
      text: "ચોક્કસ, આમંત્રણ મોકલાઈ ગયું છે. આપનો ખૂબ ખૂબ આભાર!",
      phoneticText: "Chokkas, aamantran moklai gayu chhe. Aapno khoob khoob aabhaar!",
      sentiment: 99,
      lang: "gu",
    },
  ],
  Saanvi: [
    {
      role: "AGENT",
      text: "नमस्ते! मैं Vyaperi X से सान्वी बात कर रही हूँ। आपने SharePoint और Microsoft 365 migration के लिए पोस्ट किया था — क्या यह प्रोजेक्ट अभी एक्टिव है?",
      phoneticText:
        "Namaste! Main Vyaperi X se Saanvi baat kar rahi hoon. Aapne SharePoint aur Microsoft 365 migration ke liye post kiya tha — kya yeh project abhi active hai?",
      sentiment: 78,
      lang: "hi",
    },
    {
      role: "PROSPECT",
      text: "हाँ, हम Q4 में पूरा इन्फ्रास्ट्रक्चर क्लाउड पर शिफ्ट करना चाहते हैं। बजट भी क्लियर है।",
      phoneticText:
        "Haan, hum Q4 mein poora infrastructure cloud par shift karna chahte hain. Budget bhi clear hai.",
      sentiment: 88,
      lang: "hi",
    },
    {
      role: "AGENT",
      text: "बढ़िया! हमारी टीम ने 50 से अधिक एंटरप्राइज माइग्रेशन 99.9% अपटाइम के साथ डिलीवर किए हैं। क्या कल दोपहर 2 बजे आर्किटेक्ट रिव्यू कॉल शेड्यूल करें?",
      phoneticText:
        "Badhiya! Hamaari team ne pachaas se adhik enterprise migration ninety-nine point nine percent uptime ke saath deliver kiye hain. Kya kal dopahar do baje architect review call schedule karein?",
      sentiment: 94,
      lang: "hi",
    },
    {
      role: "PROSPECT",
      text: "बिलकुल, कल 2 बजे सही रहेगा।",
      phoneticText: "Bilkul, kal do baje sahi rahega.",
      sentiment: 97,
      lang: "hi",
    },
    {
      role: "AGENT",
      text: "कैलेंडर इनवाइट भेज दिया गया है। बहुत बहुत धन्यवाद!",
      phoneticText: "Calendar invite bhej diya gaya hai. Bahut bahut dhanyavaad!",
      sentiment: 99,
      lang: "hi",
    },
  ],
  Arjun: [
    {
      role: "AGENT",
      text: "Hello! This is Arjun from VYAPERI X. Calling regarding your recent requirements for enterprise Snowflake and dbt data engineering — is this initiative on schedule for Q4?",
      phoneticText:
        "Hello! This is Arjun from VYAPERI X. Calling regarding your recent requirements for enterprise Snowflake and dbt data engineering — is this initiative on schedule for Q4?",
      sentiment: 80,
      lang: "en",
    },
    {
      role: "PROSPECT",
      text: "Yes it is. We are reviewing vendors this week for the pipeline architecture.",
      phoneticText: "Yes it is. We are reviewing vendors this week for the pipeline architecture.",
      sentiment: 86,
      lang: "en",
    },
    {
      role: "AGENT",
      text: "Understood. We specialize in automated ETL pipelines with guaranteed 35% compute cost reduction. Would a 15-minute technical brief with our Principal Architect make sense on Wednesday?",
      phoneticText:
        "Understood. We specialize in automated ETL pipelines with guaranteed 35 percent compute cost reduction. Would a 15-minute technical brief with our Principal Architect make sense on Wednesday?",
      sentiment: 92,
      lang: "en",
    },
    {
      role: "PROSPECT",
      text: "Wednesday 3 PM works. Send over the calendar invite.",
      phoneticText: "Wednesday 3 PM works. Send over the calendar invite.",
      sentiment: 95,
      lang: "en",
    },
    {
      role: "AGENT",
      text: "Invite dispatched. Looking forward to connecting on Wednesday!",
      phoneticText: "Invite dispatched. Looking forward to connecting on Wednesday!",
      sentiment: 98,
      lang: "en",
    },
  ],
  Lucía: [
    {
      role: "AGENT",
      text: "¡Hola! Le saluda Lucía de VYAPERI X. Vi su publicación sobre automatización omnicanal para centros de contacto en LATAM — ¿aún están evaluando opciones?",
      phoneticText:
        "Hola! Le saluda Lucia de VYAPERI X. Vi su publicacion sobre automatizacion omnicanal para centros de contacto en LATAM — aun estan evaluando opciones?",
      sentiment: 82,
      lang: "es",
    },
    {
      role: "PROSPECT",
      text: "Sí, queremos implementar agentes de voz en español y WhatsApp para atención al cliente.",
      phoneticText:
        "Si, queremos implementar agentes de voz en espanol y WhatsApp para atencion al cliente.",
      sentiment: 89,
      lang: "es",
    },
    {
      role: "AGENT",
      text: "Excelente. Nuestros agentes operan en español nativo con 94% de resolución en primera llamada. ¿Podemos agendar una sesión demostrativa este viernes a las 10 AM?",
      phoneticText:
        "Excelente. Nuestros agentes operan en espanol nativo con 94 por ciento de resolucion en primera llamada. Podemos agendar una sesion demostrativa este viernes a las 10 AM?",
      sentiment: 95,
      lang: "es",
    },
    {
      role: "PROSPECT",
      text: "Perfecto, me parece muy bien.",
      phoneticText: "Perfecto, me parece muy bien.",
      sentiment: 98,
      lang: "es",
    },
  ],
};

function VoiceAgentsPage() {
  const { t } = useLang();
  const { voiceAgents, toggleVoiceAgent, addVoiceAgent, playbooks, togglePlaybook } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [lang, setLang] = useState("Hindi + English");
  const [persona, setPersona] = useState("");

  // Clean, Rock-Solid Simulation State Machine
  const [testAgent, setTestAgent] = useState<VoiceAgent | null>(null);
  const [simStatus, setSimStatus] = useState<"idle" | "ringing" | "playing" | "paused" | "ended">(
    "idle",
  );
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0);
  const [activeSpeaker, setActiveSpeaker] = useState<"AGENT" | "PROSPECT" | null>(null);
  const [currentSentiment, setCurrentSentiment] = useState(78);
  const [injectedObjection, setInjectedObjection] = useState<{
    q: string;
    a: string;
    lang: string;
  } | null>(null);

  const activeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const cleanupTimersAndAudio = () => {
    if (activeTimeout.current) {
      clearTimeout(activeTimeout.current);
      activeTimeout.current = null;
    }
    stopRealVoiceAudio();
  };

  useEffect(() => {
    return () => cleanupTimersAndAudio();
  }, []);

  // Smooth auto-scroll
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [currentTurnIdx, injectedObjection, activeSpeaker]);

  const startTestCall = (agent: VoiceAgent) => {
    cleanupTimersAndAudio();
    setTestAgent(agent);
    setSimStatus("ringing");
    setCurrentTurnIdx(0);
    setInjectedObjection(null);
    setCurrentSentiment(75);
    setActiveSpeaker(null);

    // 1.8s Ringing simulation, then start conversation step 0
    activeTimeout.current = setTimeout(() => {
      setSimStatus("playing");
      playConversationStep(agent.name, 0);
    }, 1800);
  };

  const playConversationStep = (agentName: string, stepIdx: number) => {
    const convo = AGENT_CONVERSATIONS[agentName] || AGENT_CONVERSATIONS["Saanvi"]!;

    if (stepIdx >= convo.length) {
      setSimStatus("ended");
      setActiveSpeaker(null);
      return;
    }

    const item = convo[stepIdx]!;
    setCurrentTurnIdx(stepIdx + 1);
    setActiveSpeaker(item.role);
    setCurrentSentiment(item.sentiment);

    // Pick correct gender for this turn
    const isAgentTurn = item.role === "AGENT";
    const agentGender = agentName === "Dhruv" || agentName === "Arjun" ? "male" : "female";
    const speakerGender = isAgentTurn ? agentGender : agentGender === "male" ? "female" : "male";

    // Find the best matching DEMO_VOICE_AGENTS entry
    const voiceAgent =
      DEMO_VOICE_AGENTS.find((a) => a.langCode === item.lang && a.gender === speakerGender) ??
      DEMO_VOICE_AGENTS.find((a) => a.langCode === item.lang) ??
      DEMO_VOICE_AGENTS[0]!;

    // Speak with real human voice
    playRealVoiceAudio({
      text: item.text,
      phoneticText: item.phoneticText,
      agent: voiceAgent,
      onStart: () => setActiveSpeaker(item.role),
      onEnd: () => {
        activeTimeout.current = setTimeout(() => {
          playConversationStep(agentName, stepIdx + 1);
        }, 900);
      },
    });
  };

  const handleInjectObjection = (
    objectionText: string,
    answerText: string,
    langCode: string,
    phoneticObjection?: string,
    phoneticAnswer?: string,
  ) => {
    cleanupTimersAndAudio();
    setInjectedObjection({ q: objectionText, a: answerText, lang: langCode });
    setCurrentSentiment(55);
    setActiveSpeaker("PROSPECT");

    const lang = langCode as "hi" | "gu" | "en";
    const prospectAgent =
      DEMO_VOICE_AGENTS.find((a) => a.langCode === lang && a.gender === "male") ??
      DEMO_VOICE_AGENTS[0]!;
    const agentGender =
      testAgent?.name === "Dhruv" || testAgent?.name === "Arjun" ? "male" : "female";
    const replyAgent =
      DEMO_VOICE_AGENTS.find((a) => a.langCode === lang && a.gender === agentGender) ??
      DEMO_VOICE_AGENTS[0]!;

    playRealVoiceAudio({
      text: objectionText,
      phoneticText: phoneticObjection,
      agent: prospectAgent,
      onEnd: () => {
        activeTimeout.current = setTimeout(() => {
          setActiveSpeaker("AGENT");
          setCurrentSentiment(90);
          playRealVoiceAudio({
            text: answerText,
            phoneticText: phoneticAnswer,
            agent: replyAgent,
            onEnd: () => setActiveSpeaker(null),
          });
        }, 800);
      },
    });
  };

  const handleEndCall = () => {
    cleanupTimersAndAudio();
    setSimStatus("ended");
    setActiveSpeaker(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    addVoiceAgent(name, lang, persona);
    setName("");
    setPersona("");
    setShowForm(false);
  };

  const totalMinutes = voiceAgents.reduce((s, a) => s + a.minutes, 0);
  const avgConnect = voiceAgents.length
    ? Math.round(voiceAgents.reduce((s, a) => s + a.connectRate, 0) / voiceAgents.length)
    : 0;

  return (
    <div className="space-y-8">
      <PageHead
        index="/07"
        title={t("page.voice.title")}
        subtitle="Enterprise autonomous multilingual voice fleet with real-time objection handling & speech intelligence."
        action={
          <Btn variant="solid" onClick={() => setShowForm((v) => !v)}>
            <Sparkles className="h-3.5 w-3.5 text-lime" />
            {showForm ? "Cancel" : "+ Deploy New Agent"}
          </Btn>
        }
      />

      <StatGrid>
        <Stat
          label="Active Voice Fleet"
          value={String(voiceAgents.filter((a) => a.status === "active").length)}
          note="Ready for outbound queues"
        />
        <Stat
          label="Total Voice Minutes"
          value={totalMinutes.toLocaleString()}
          note="Synthesized & delivered"
        />
        <Stat label="Fleet Connect Rate" value={`${avgConnect}%`} note="Industry benchmark: 34%" />
        <Stat
          label="Dialects & Accents"
          value="14 Supported"
          note="Hindi, English, Gujarati, Spanish..."
        />
      </StatGrid>

      {/* Voice Synthesizer Quick Studio */}
      <Panel
        title="Voice Agent Real Speech Testing Studio (Hindi / Gujarati / English)"
        hint="Male & Female Real Voices"
      >
        <VoiceAgentSynthesizerWidget compact={true} />
      </Panel>

      {/* Interactive Agent Call Testing Studio Modal */}
      {testAgent && (
        <div className="border-2 border-violet bg-card p-6 shadow-2xl space-y-6 fade-in-up">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet text-white font-bold text-base shadow">
                {testAgent.name[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-bold">{testAgent.name}</h3>
                  <Tag tone="lime">Interactive Voice Simulation</Tag>
                  <Tag>{testAgent.language}</Tag>
                </div>
                <div className="font-mono text-xs text-muted-foreground">{testAgent.persona}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {simStatus === "ringing" && (
                <span className="flex items-center gap-2 font-mono text-xs text-violet font-bold animate-pulse">
                  <Activity className="h-4 w-4 animate-spin" /> Dialling SIP connection…
                </span>
              )}
              {simStatus === "playing" && (
                <span className="flex items-center gap-2 font-mono text-xs text-emerald-700 dark:text-lime font-bold">
                  <SpeakingWave active={true} />
                  <span>
                    Call Active ·{" "}
                    {activeSpeaker === "AGENT"
                      ? `${testAgent.name} Speaking`
                      : "Prospect Responding"}
                  </span>
                </span>
              )}
              {simStatus === "ended" && (
                <span className="font-mono text-xs text-muted-foreground">Session Completed</span>
              )}

              {simStatus !== "ended" ? (
                <Btn variant="danger" onClick={handleEndCall}>
                  <PhoneOff className="h-3.5 w-3.5" /> End Call
                </Btn>
              ) : (
                <Btn variant="solid" onClick={() => setTestAgent(null)}>
                  Close Simulator
                </Btn>
              )}
            </div>
          </div>

          {/* Dynamic Audio Visualizer & Sentiment Grid */}
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            {/* Conversation Stream */}
            <div
              ref={chatScrollRef}
              className="border border-border bg-ink/5 p-4 rounded space-y-3 min-h-[260px] max-h-[340px] overflow-y-auto"
            >
              <div className="flex justify-between items-center label-mono text-[10px] text-muted-foreground pb-2 border-b border-border/50">
                <span>Real-Time Voice Speech Stream</span>
                {activeSpeaker && <SpeakingWave active={true} />}
              </div>

              {simStatus === "ringing" && (
                <div className="py-14 text-center font-mono text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <PhoneCall className="h-7 w-7 text-violet animate-bounce" />
                  Connecting to SIP trunk… ringing synthetic test receiver…
                </div>
              )}

              {simStatus !== "ringing" && (
                <div className="space-y-3 font-mono text-xs">
                  {(AGENT_CONVERSATIONS[testAgent.name] || AGENT_CONVERSATIONS["Saanvi"]!)
                    .slice(0, currentTurnIdx)
                    .map((line, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded border transition-all shadow-sm ${
                          line.role === "AGENT"
                            ? "bg-violet/10 border-violet/30 text-ink ml-4"
                            : "bg-secondary border-border mr-4"
                        } ${idx === currentTurnIdx - 1 && simStatus === "playing" ? "border-l-4 border-lime" : ""}`}
                      >
                        <div className="flex items-center justify-between mb-1 font-bold text-[10px]">
                          <span
                            className={
                              line.role === "AGENT" ? "text-violet" : "text-muted-foreground"
                            }
                          >
                            [{line.role === "AGENT" ? `AI AGENT — ${testAgent.name}` : "PROSPECT"}]
                          </span>
                          <span className="text-emerald-700 dark:text-lime font-semibold">
                            {line.sentiment}% Intent
                          </span>
                        </div>
                        <div className="leading-relaxed">{line.text}</div>
                      </div>
                    ))}

                  {injectedObjection && (
                    <div className="space-y-2 fade-in">
                      <div className="p-3 rounded border bg-danger/10 border-danger/30 text-ink mr-4">
                        <div className="font-bold text-[10px] text-danger mb-1">
                          [PROSPECT — INJECTED OBJECTION]
                        </div>
                        <div>"{injectedObjection.q}"</div>
                      </div>
                      <div className="p-3 rounded border bg-violet/10 border-violet/30 text-ink ml-4">
                        <div className="font-bold text-[10px] text-violet mb-1">
                          [AI AGENT — {testAgent.name} ADAPTATION]
                        </div>
                        <div>"{injectedObjection.a}"</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Live Gauges & Objection Injection Controls */}
            <div className="space-y-4">
              <div className="border border-border p-4 bg-paper space-y-3">
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-muted-foreground">Prospect Buying Sentiment</span>
                  <span className="font-bold text-emerald-700 dark:text-lime">
                    {currentSentiment}% Positive
                  </span>
                </div>
                <Bar value={currentSentiment} tone={currentSentiment > 75 ? "lime" : "violet"} />

                <div className="pt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
                  <span>Latency: 142ms</span>
                  <span>ASR Accuracy: 99.4%</span>
                </div>
              </div>

              {/* Interactive Objection Triggers */}
              <div className="border border-border p-4 bg-paper space-y-2.5">
                <div className="label-mono text-[10px] text-muted-foreground flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-violet" /> Test Real-Time Objection Adaptation:
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() =>
                      handleInjectObjection(
                        "બજેટ ઘણું વધારે લાગે છે, હાલમાં અમારે નથી કરવું.",
                        "હું સમજી શકું છું. અમારું મોડલ એકદમ ફ્લેક્સિબલ છે અને આપ ૧૪ દિવસ ફ્રી ટ્રાયલ સાથે શરૂ કરી શકો છો.",
                        "gu",
                      )
                    }
                    className="w-full text-left px-3 py-2 border border-border text-[11px] font-mono hover:bg-secondary hover:border-violet transition-colors flex justify-between items-center rounded"
                  >
                    <span>"Budget is too high" (Gujarati)</span>
                    <span className="text-violet font-bold">+</span>
                  </button>

                  <button
                    onClick={() =>
                      handleInjectObjection(
                        "हम पहले से दूसरे वेंडर के साथ काम कर रहे हैं।",
                        "बिल्कुल, वे एक अच्छा टूल हैं। लेकिन हमारा प्लेटफॉर्म 99% कॉलिंग एक्यूरेसी और रियल-टाइम CRM सिंक प्रदान करता है।",
                        "hi",
                      )
                    }
                    className="w-full text-left px-3 py-2 border border-border text-[11px] font-mono hover:bg-secondary hover:border-violet transition-colors flex justify-between items-center rounded"
                  >
                    <span>"Already using another vendor" (Hindi)</span>
                    <span className="text-violet font-bold">+</span>
                  </button>

                  <button
                    onClick={() =>
                      handleInjectObjection(
                        "Can you send an email instead of calling right now?",
                        "Absolutely, I have dispatched our enterprise architectural brief to your verified inbox. Let's touch base on Thursday.",
                        "en",
                      )
                    }
                    className="w-full text-left px-3 py-2 border border-border text-[11px] font-mono hover:bg-secondary hover:border-violet transition-colors flex justify-between items-center rounded"
                  >
                    <span>"Send an email instead" (English)</span>
                    <span className="text-violet font-bold">+</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voice Fleet Grid */}
      <Panel
        title="Autonomous Agent Fleet"
        hint={
          <LiveDot
            label={`${voiceAgents.filter((a) => a.status === "active").length} Operational`}
          />
        }
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {voiceAgents.map((a) => (
            <div
              key={a.id}
              className="border border-border bg-card p-5 space-y-4 rounded hover:border-violet transition-all shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base font-extrabold">{a.name}</h3>
                    <Tag tone={a.status === "active" ? "lime" : "muted"}>{a.status}</Tag>
                  </div>
                  <div className="font-mono text-xs text-violet font-semibold mt-0.5">
                    {a.language}
                  </div>
                </div>
                {a.status === "active" && <SpeakingWave active={true} />}
              </div>

              <p className="font-mono text-xs text-muted-foreground leading-relaxed">{a.persona}</p>

              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-muted-foreground">Historical Connect Rate</span>
                  <span className="font-bold text-ink">{a.connectRate}%</span>
                </div>
                <Bar value={a.connectRate} tone={a.connectRate > 55 ? "lime" : "violet"} />
                <div className="font-mono text-[10px] text-muted-foreground text-right">
                  {a.minutes.toLocaleString()} minutes active
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Btn
                  variant="solid"
                  onClick={() => startTestCall(a)}
                  className="flex-1 text-[11px]"
                >
                  <PhoneCall className="h-3 w-3 text-lime" /> Test Live Call
                </Btn>
                <Btn
                  variant={a.status === "active" ? "outline" : "lime"}
                  onClick={() => toggleVoiceAgent(a.id)}
                  className="text-[11px]"
                >
                  {a.status === "active" ? "Pause" : "Activate"}
                </Btn>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Autonomous Sales Playbooks */}
      <Panel
        title="Autonomous Sales Decision Playbooks"
        hint={`${playbooks.filter((p) => p.enabled).length} Active Policies`}
      >
        <div className="divide-y divide-border">
          {playbooks.map((p, i) => (
            <div
              key={p.id}
              className="grid gap-4 py-3.5 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center fade-in-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <span>{p.id}</span>
                  <Tag>{p.stage}</Tag>
                  <Tag
                    tone={
                      p.action === "QUALIFY"
                        ? "lime"
                        : p.action === "ESCALATE"
                          ? "violet"
                          : "danger"
                    }
                  >
                    {p.action}
                  </Tag>
                </div>
                <div className="mt-1 font-display text-sm font-bold uppercase">{p.name}</div>
                <div className="font-mono text-xs text-muted-foreground">{p.description}</div>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {p.hits.toLocaleString()} hits this month
              </span>
              <Btn variant={p.enabled ? "lime" : "outline"} onClick={() => togglePlaybook(p.id)}>
                {p.enabled ? "Active" : "Disabled"}
              </Btn>
            </div>
          ))}
        </div>
      </Panel>

      <Terminal
        title="voice.fleet.telemetry"
        typewriter
        lines={voiceAgents.map(
          (a) =>
            `AGENT::${a.id}  [${a.name.padEnd(7)}]  STATUS=${a.status.padEnd(7)}  LANG=${a.language.padEnd(20)}  CONNECT=${a.connectRate}%  MINUTES=${a.minutes}`,
        )}
      />
    </div>
  );
}
