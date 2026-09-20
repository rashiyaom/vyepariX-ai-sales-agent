import { Router, Request, Response, NextFunction } from "express";
import { voiceAgentService } from "../services/voiceAgentService.js";
import { voiceAgentLimiter } from "../middleware/rateLimiter.js";
import { z } from "zod";

const router = Router();

const CreateVoiceAgentSchema = z.object({
  campaignId: z.string().uuid(),
  languages: z.array(z.string()).min(1),
  leadIds: z.array(z.string()).optional(),
});

// POST /api/v1/voice-agents  — configure and trigger voice agent for a campaign
router.post(
  "/",
  voiceAgentLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { campaignId, languages, leadIds } = CreateVoiceAgentSchema.parse(req.body);

      if (leadIds?.length) {
        // Specific leads — call them directly
        await Promise.all(
          leadIds.map((leadId, i) =>
            voiceAgentService.placeOutboundCall({
              leadId,
              campaignId,
              organizationId: req.organizationId!,
              attemptNumber: 1,
              languages,
            })
          )
        );
        res.json({ message: `${leadIds.length} calls initiated` });
      } else {
        res.json({ message: "Use PATCH /campaigns/:id with status=RUNNING to launch full campaign" });
      }
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/calls/:id
router.get("/calls/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const call = await voiceAgentService.getCall(id);
    if (!call) {
      res.status(404).json({ error: "Call not found" });
      return;
    }
    res.json(call);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/calls/:id/transcript
router.get("/calls/:id/transcript", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const transcript = await voiceAgentService.getTranscript(id);
    res.json(transcript);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/voice/twiml/:callId  — Twilio TwiML response (no auth — called by Twilio)
router.post("/twiml/:callId", async (req: Request, res: Response) => {
  const { callId } = req.params;
  res.type("text/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${req.headers.host}/ws/voice-stream/${callId}" />
  </Connect>
</Response>`);
});

// POST /api/v1/voice/status/:callId  — Twilio status webhook (no auth — called by Twilio)
router.post("/status/:callId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { CallStatus } = req.body as { CallStatus: string };
    const callId = typeof req.params.callId === "string" ? req.params.callId : "";
    await voiceAgentService.finalizeCall(callId, CallStatus);
    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
});

export default router;
