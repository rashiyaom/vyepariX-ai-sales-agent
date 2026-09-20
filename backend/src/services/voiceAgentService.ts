/**
 * VYAPERI X — Voice Agent Service
 * 
 * Architecture decision: LiveKit Agents pipeline (as per spec default)
 * STT: Sarvam AI Saaras V3 (Hindi/Gujarati/English/code-mixed)
 *      → Groq Whisper fallback for other languages
 * LLM: Groq llama-3.1-8b-instant (lowest latency for real-time voice turns)
 * TTS: Sarvam AI Bulbul V3 (Indian languages)
 *      → ElevenLabs (other languages)
 * 
 * NOTE: Full LiveKit room management requires the @livekit/agents SDK and
 * a running LiveKit server. The service below implements the complete pipeline
 * interface; wire the actual LiveKit room/participant events to the handlers
 * when deploying to a LiveKit-enabled environment.
 */

import { prisma } from "../config/database.js";
import { groqClient } from "./groqClient.js";
import { billingService } from "./billingService.js";
import { notificationService } from "./notificationService.js";
import { decrypt } from "../config/encryption.js";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

interface PlaceCallOptions {
  leadId: string;
  campaignId: string;
  organizationId: string;
  attemptNumber: number;
  languages: string[];
}

interface TurnResult {
  agentText: string;
  audioBase64?: string;
  sentiment?: string;
}

// Language routing
const SARVAM_LANGUAGES = new Set(["hi-IN", "gu-IN", "en-IN", "ta-IN", "te-IN", "ml-IN", "kn-IN", "mr-IN"]);

export const voiceAgentService = {
  async placeOutboundCall(opts: PlaceCallOptions): Promise<void> {
    const { leadId, campaignId, organizationId, attemptNumber, languages } = opts;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        organization: { include: { businessProfile: true } },
        calls: { orderBy: { startedAt: "desc" }, take: 1 },
      },
    });
    if (!lead?.phoneEncrypted) throw new Error(`Lead ${leadId} has no phone number`);

    const phone = decrypt(lead.phoneEncrypted);
    const language = selectLanguage(languages);
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    // Build system prompt from BusinessProfile + Campaign goal
    const systemPrompt = buildAgentSystemPrompt({
      businessProfile: lead.organization.businessProfile as object,
      campaignGoal: campaign.goal,
      language,
      contactName: lead.contactName,
      companyName: lead.companyName,
    });

    // Create Call record
    const callSid = `SIM-${Date.now()}-${Math.random().toString(36).slice(2)}`; // Will be real Twilio SID
    const callRecord = await prisma.call.create({
      data: {
        campaignId,
        leadId,
        direction: "OUTBOUND",
        telephonyCallSid: callSid,
        status: "initiated",
        language,
        attemptNumber,
      },
    });

    // Notify dashboard via WebSocket
    notificationService.push(organizationId, {
      type: "CALL_STARTED",
      callId: callRecord.id,
      leadId,
      language,
      attemptNumber,
      timestamp: new Date().toISOString(),
    });

    try {
      // Place actual Twilio call — points to /api/v1/voice/twiml/:callId for TwiML instructions
      const baseUrl = process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 5000}`;
      await twilioClient.calls.create({
        to: phone,
        from: process.env.TWILIO_PHONE_NUMBER!,
        url: `${baseUrl}/api/v1/voice/twiml/${callRecord.id}`,
        statusCallback: `${baseUrl}/api/v1/voice/status/${callRecord.id}`,
        statusCallbackMethod: "POST",
        machineDetection: "Enable", // Voicemail detection
        asyncAmd: "true",
      });

      await prisma.call.update({
        where: { id: callRecord.id },
        data: { telephonyCallSid: callSid, status: "in-progress" },
      });
    } catch (err) {
      await prisma.call.update({
        where: { id: callRecord.id },
        data: { status: "failed", endedAt: new Date() },
      });
      throw err;
    }

    // Store system prompt for use during live turns (via Redis cache)
    // The actual turn-by-turn conversation is driven by Twilio webhooks hitting /voice/turn/:callId
    await storeCallContext(callRecord.id, { systemPrompt, language, organizationId, leadId, campaignId });
  },

  /** Called by Twilio webhook on each conversation turn */
  async processTurn(callId: string, humanText: string): Promise<TurnResult> {
    const context = await loadCallContext(callId);
    if (!context) throw new Error(`No context for call ${callId}`);

    const history = await prisma.transcriptTurn.findMany({
      where: { callId },
      orderBy: { createdAt: "asc" },
    });

    const messages = history.map((t) => ({
      role: t.speaker === "agent" ? ("assistant" as const) : ("user" as const),
      content: t.text,
    }));
    messages.push({ role: "user", content: humanText });

    // Write human turn immediately (before LLM) so partial transcripts are preserved
    await prisma.transcriptTurn.create({
      data: { callId, speaker: "human", text: humanText, language: context.language },
    });

    // LLM turn — llama-3.1-8b-instant for lowest latency
    const result = await groqClient.getCompletion({
      model: "llama-3.1-8b-instant",
      systemPrompt: context.systemPrompt,
      messages,
      maxTokens: 200, // Keep responses short for natural pacing
      temperature: 0.6,
    });

    const agentText = result.text;

    // Write agent turn immediately
    await prisma.transcriptTurn.create({
      data: { callId, speaker: "agent", text: agentText, language: context.language },
    });

    // Stream turn to dashboard
    notificationService.push(context.organizationId, {
      type: "CALL_TURN",
      callId,
      speaker: "agent",
      text: agentText,
      timestamp: new Date().toISOString(),
    });

    // Convert to audio
    const audioBase64 = await synthesizeSpeech(agentText, context.language);

    return { agentText, audioBase64 };
  },

  /** Called when call ends (via Twilio status webhook) */
  async finalizeCall(callId: string, twilioStatus: string): Promise<void> {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { transcript: true, campaign: true },
    });
    if (!call) return;

    const finalStatus = mapTwilioStatus(twilioStatus);

    // Handle voicemail
    if (twilioStatus === "completed" && call.transcript.length === 0) {
      await prisma.call.update({
        where: { id: callId },
        data: { status: "voicemail", endedAt: new Date() },
      });
      return;
    }

    // Post-call analysis
    let summary = "";
    let sentiment = "unknown";
    let nextBestAction = "";

    if (call.transcript.length > 0) {
      const fullTranscript = call.transcript
        .map((t) => `${t.speaker.toUpperCase()}: ${t.text}`)
        .join("\n");

      try {
        const analysis = await groqClient.getJsonCompletion<{
          summary: string;
          sentiment: "interested" | "not-interested" | "callback" | "needs-followup" | "hostile";
          nextBestAction: string;
        }>({
          model: "llama-3.3-70b-versatile",
          systemPrompt: `Analyze this sales call transcript. Return JSON with:
- summary: 2-3 sentence executive summary
- sentiment: one of "interested" | "not-interested" | "callback" | "needs-followup" | "hostile"  
- nextBestAction: specific recommended next step`,
          messages: [{ role: "user", content: fullTranscript }],
          maxTokens: 512,
        });

        summary = analysis.summary;
        sentiment = analysis.sentiment;
        nextBestAction = analysis.nextBestAction;
      } catch (err) {
        console.error("[VoiceAgent] Post-call analysis failed:", err);
      }
    }

    await prisma.call.update({
      where: { id: callId },
      data: { status: finalStatus, sentiment, summary, nextBestAction, endedAt: new Date() },
    });

    // Cascade lead status
    if (sentiment === "interested") {
      await prisma.lead.update({
        where: { id: call.leadId },
        data: { status: "INTERESTED" },
      });
      await notificationService.notifyInterestedProspect(
        call.campaign.organizationId,
        call.leadId,
        "Interested Prospect"
      );
    } else if (sentiment === "callback") {
      await prisma.lead.update({ where: { id: call.leadId }, data: { status: "CALLBACK" } });
    } else if (sentiment === "not-interested") {
      await prisma.lead.update({ where: { id: call.leadId }, data: { status: "NOT_INTERESTED" } });
    }

    // Record voice minutes for billing
    const durationMin = call.endedAt
      ? (new Date().getTime() - call.startedAt.getTime()) / 60000
      : 0;
    if (durationMin > 0) {
      await billingService.recordVoiceMinutes(call.campaign.organizationId, durationMin);
    }

    // Final telemetry push
    notificationService.push(call.campaign.organizationId, {
      type: "CALL_ENDED",
      callId,
      sentiment,
      summary,
      nextBestAction,
      durationSec: Math.round(durationMin * 60),
      timestamp: new Date().toISOString(),
    });
  },

  async getCall(callId: string) {
    return prisma.call.findUnique({ where: { id: callId }, include: { transcript: true } });
  },

  async getTranscript(callId: string) {
    return prisma.transcriptTurn.findMany({
      where: { callId },
      orderBy: { createdAt: "asc" },
    });
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function selectLanguage(languages: string[]): string {
  return languages[0] ?? process.env.DEFAULT_VOICE_LANGUAGE ?? "en-IN";
}

function buildAgentSystemPrompt(opts: {
  businessProfile: object | null;
  campaignGoal: string;
  language: string;
  contactName?: string | null;
  companyName?: string | null;
}): string {
  const profile = JSON.stringify(opts.businessProfile ?? {});
  const langInstruction =
    opts.language === "hi-IN"
      ? "Speak in Hindi (formal, professional). You may code-switch to English for technical terms."
      : opts.language === "gu-IN"
      ? "Speak in Gujarati (formal, professional). You may code-switch to Hindi or English for technical terms."
      : "Speak in professional English.";

  return `You are Vyaperi X, an AI sales agent making an outbound call on behalf of a company.

LANGUAGE INSTRUCTION: ${langInstruction}

COMPANY INFO: ${profile}

CALL GOAL: ${opts.campaignGoal}

PROSPECT: ${opts.contactName ?? "the prospect"} at ${opts.companyName ?? "their company"}

GUIDELINES:
- Be concise — max 2-3 sentences per turn
- Listen carefully and qualify the prospect's needs
- Do NOT be pushy — if they are not interested, politely acknowledge and offer to call back later
- If they are interested, work toward scheduling a follow-up meeting or demo
- If you reach voicemail, leave a brief professional message
- Always maintain a warm, consultative tone`;
}

async function synthesizeSpeech(text: string, language: string): Promise<string | undefined> {
  try {
    if (SARVAM_LANGUAGES.has(language)) {
      return await synthesizeViaSarvam(text, language);
    } else {
      return await synthesizeViaElevenLabs(text);
    }
  } catch (err) {
    console.error("[VoiceAgent] TTS failed:", err);
    return undefined;
  }
}

async function synthesizeViaSarvam(text: string, language: string): Promise<string> {
  const { default: fetch } = await import("node-fetch");
  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": process.env.SARVAM_API_KEY!,
    },
    body: JSON.stringify({
      inputs: [text],
      target_language_code: language,
      speaker: "priya",
      model: "bulbul:v3",
      pitch: 0,
      pace: 1.0,
      loudness: 1.5,
      enable_preprocessing: true,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Sarvam TTS error: ${res.status}`);
  const data = (await res.json()) as { audios: string[] };
  return data.audios[0] ?? "";
}

async function synthesizeViaElevenLabs(text: string): Promise<string> {
  const { default: fetch } = await import("node-fetch");
  const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel — default ElevenLabs voice
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": process.env.ELEVENLABS_API_KEY!,
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.8 },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS error: ${res.status}`);
  const buffer = await res.buffer();
  return buffer.toString("base64");
}

async function transcribeViaSarvam(audioBase64: string, language: string): Promise<string> {
  const { default: fetch } = await import("node-fetch");
  const res = await fetch("https://api.sarvam.ai/speech-to-text", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": process.env.SARVAM_API_KEY!,
    },
    body: JSON.stringify({
      audio: audioBase64,
      language_code: language,
      model: "saaras:v3",
      with_disfluencies: false,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Sarvam STT error: ${res.status}`);
  const data = (await res.json()) as { transcript: string };
  return data.transcript;
}

async function transcribeViaDeepgram(audioBase64: string): Promise<string> {
  const { default: fetch } = await import("node-fetch");
  const buffer = Buffer.from(audioBase64, "base64");
  const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true", {
    method: "POST",
    headers: {
      "Authorization": `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": "audio/wav",
    },
    body: buffer,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Deepgram STT error: ${res.status}`);
  const data = (await res.json()) as {
    results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> };
  };
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
}

async function transcribeAudio(audioBase64: string, language: string): Promise<string> {
  if (SARVAM_LANGUAGES.has(language) && process.env.SARVAM_API_KEY) {
    try {
      return await transcribeViaSarvam(audioBase64, language);
    } catch (err) {
      console.warn("[VoiceAgent] Sarvam STT failed, falling back to Deepgram", err);
    }
  }
  if (process.env.DEEPGRAM_API_KEY) {
    return await transcribeViaDeepgram(audioBase64);
  }
  return "";
}

// Call context stored in Redis for fast access during live calls
async function storeCallContext(callId: string, context: object): Promise<void> {
  const { redis } = await import("../config/redis.js");
  await redis.set(`call-ctx:${callId}`, JSON.stringify(context), "EX", 3600);
}

async function loadCallContext(callId: string): Promise<{
  systemPrompt: string;
  language: string;
  organizationId: string;
  leadId: string;
  campaignId: string;
} | null> {
  const { redis } = await import("../config/redis.js");
  const raw = await redis.get(`call-ctx:${callId}`);
  return raw ? JSON.parse(raw) : null;
}

function mapTwilioStatus(twilioStatus: string): string {
  const map: Record<string, string> = {
    completed: "completed",
    "no-answer": "no-answer",
    busy: "no-answer",
    failed: "failed",
    canceled: "failed",
  };
  return map[twilioStatus] ?? "completed";
}

export { transcribeViaSarvam, transcribeViaDeepgram, transcribeAudio };
