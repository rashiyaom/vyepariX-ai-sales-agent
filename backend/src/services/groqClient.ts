import Groq from "groq-sdk";

let _client: Groq | null = null;
function getClient(): Groq {
  if (!_client) {
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY || "gsk_dev_placeholder_key" });
  }
  return _client;
}

export interface CompletionOptions {
  model:
    | "llama-3.1-8b-instant"      // real-time voice turns (lowest latency)
    | "llama-3.3-70b-versatile"   // business understanding, qualification
    | "llama3-70b-8192"           // general purpose fallback
    | string;
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionResult {
  text: string;
  usage: { promptTokens: number; completionTokens: number };
}

export const groqClient = {
  async getCompletion(opts: CompletionOptions): Promise<CompletionResult> {
    try {
      const activeModel = process.env.GROQ_MODEL || 
        (opts.model && opts.model.startsWith("llama-3") ? "groq/compound-mini" : opts.model);

      const response = await getClient().chat.completions.create({
        model: activeModel,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.3,
        messages: [
          { role: "system", content: opts.systemPrompt },
          ...opts.messages,
        ],
      });

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        throw new Error("Groq returned empty completion");
      }

      return {
        text: choice.message.content,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
        },
      };
    } catch (err) {
      console.error("[GroqClient] Completion error:", err);
      throw err;
    }
  },

  /** Parse JSON from a Groq completion — retries once on parse failure */
  async getJsonCompletion<T>(opts: CompletionOptions): Promise<T> {
    const jsonOpts: CompletionOptions = {
      ...opts,
      systemPrompt: opts.systemPrompt + "\n\nRespond with ONLY valid JSON. No markdown, no explanation.",
    };
    const result = await groqClient.getCompletion(jsonOpts);
    try {
      return JSON.parse(result.text) as T;
    } catch {
      // Strip markdown code fences if present and retry parse
      const stripped = result.text.replace(/^```json\n?|\n?```$/g, "").trim();
      return JSON.parse(stripped) as T;
    }
  },
};
