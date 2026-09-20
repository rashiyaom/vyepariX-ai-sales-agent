/**
 * Chat Widget - floating chatbot panel
 *
 * Floating action button (lime) + slide-up panel anchored to bottom-right.
 * Matches VYAPERI X design system exactly:
 * - Sharp 0px corners
 * - Violet accent for AI messages, lime FAB
 * - Archivo font, JetBrains Mono labels
 * - slide-in-l / fade-in animations from styles.css
 *
 * Uses fetch + ReadableStream for SSE streaming from POST /api/v1/chat.
 * Supports conversational memory (conversationId persisted in session).
 */
import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from "react";
import { MessageSquare, X, Send, RotateCcw, Bot } from "lucide-react";
import { ChatMessages, type ChatMessage } from "./ChatMessages";
import { type Citation } from "./CitationCard";
import { Button } from "@/components/ui/button";

interface ChatWidgetProps {
  knowledgeBaseId: string;
  knowledgeBaseName?: string;
  token: string;
  isOpen?: boolean;
  onClose?: () => void;
  initialOpen?: boolean;
}

const API = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/v1";

let msgCounter = 0;
function nextId(): string { return `msg_${++msgCounter}`; }

export function ChatWidget({
  knowledgeBaseId,
  knowledgeBaseName = "Knowledge Base",
  token,
  isOpen,
  onClose,
  initialOpen = false,
}: ChatWidgetProps) {
  const [internalOpen, setInternalOpen] = useState(initialOpen);

  useEffect(() => {
    if (isOpen !== undefined) {
      setInternalOpen(isOpen);
    }
  }, [isOpen]);

  const open = isOpen !== undefined ? isOpen : internalOpen;

  const handleToggle = () => {
    if (open) {
      onClose?.();
      setInternalOpen(false);
    } else {
      setInternalOpen(true);
    }
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setError(null);

    const userMsg: ChatMessage = {
      id: nextId(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);
    setStreamBuffer("");

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text, knowledgeBaseId, conversationId }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullAnswer = "";
      let citations: Citation[] = [];
      let abstained = false;
      let convId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as {
              type: string;
              content?: string;
              citations?: Citation[];
              abstained?: boolean;
              score?: number;
              message?: string;
              conversationId?: string;
            };

            if (evt.conversationId && !convId) convId = evt.conversationId;

            if (evt.type === "token" && evt.content) {
              fullAnswer += evt.content;
              const cleanBuffer = fullAnswer
                .replace(/\[CITATIONS[\s\S]*$/i, "")
                .replace(/【\d+】/g, "")
                .replace(/\[SOURCE\s*\d+\]/gi, "");
              setStreamBuffer(cleanBuffer);
            } else if (evt.type === "citations") {
              citations = evt.citations ?? [];
            } else if (evt.type === "done") {
              abstained = evt.abstained ?? false;
            } else if (evt.type === "error") {
              throw new Error(evt.message ?? "Generation error");
            }
          } catch {
            // skip malformed events
          }
        }
      }

      if (convId) setConversationId(convId);

      // Commit final assistant message
      const cleanedFinal = (fullAnswer || "No response received.")
        .replace(/\[CITATIONS[\s\S]*$/i, "")
        .replace(/【\d+】/g, "")
        .replace(/\[SOURCE\s*\d+\]/gi, "")
        .trim();

      const assistantMsg: ChatMessage = {
        id: nextId(),
        role: "assistant",
        content: cleanedFinal,
        citations,
        abstained,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamBuffer("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setError(msg);
    } finally {
      setStreaming(false);
      setStreamBuffer("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, streaming, knowledgeBaseId, conversationId, token]);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function reset() {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setStreamBuffer("");
  }

  return (
    <>
      {/* FAB: Only visible when chat is closed so it doesn't block the input */}
      {!open && (
        <button
          onClick={handleToggle}
          className={[
            "fixed bottom-20 right-6 z-50 h-14 w-14 flex items-center justify-center",
            "bg-lime text-black font-bold shadow-xl hover:shadow-2xl transition-all",
            "border-2 border-black hover:scale-105 active:scale-95",
            "cursor-pointer",
          ].join(" ")}
          aria-label="Open AI chat"
          id="rag-chat-fab"
          title="Open AI Chatbot"
        >
          <MessageSquare className="h-6 w-6 text-black" />
        </button>
      )}

      {/* Slide-up Panel */}
      {open && (
        <div
          className={[
            "fixed bottom-20 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)]",
            "border-2 border-black bg-card flex flex-col shadow-2xl rounded-none",
            "animate-in fade-in slide-in-from-bottom-4 duration-200",
          ].join(" ")}
          style={{ height: "540px" }}
          id="rag-chat-panel"
          role="dialog"
          aria-label="AI Chat"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-secondary/80">
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 bg-lime text-black flex items-center justify-center font-bold text-xs">
                AI
              </div>
              <div>
                <p className="text-xs font-bold text-foreground font-display uppercase tracking-wide">
                  AI Assistant
                </p>
                <p className="label-mono text-[10px] text-muted-foreground truncate max-w-[220px]">
                  {knowledgeBaseName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={reset}
                className="p-1.5 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Reset conversation"
                title="New conversation"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleToggle}
                className="p-1.5 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Close chat"
                title="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-2">
            {messages.length === 0 && !streaming && (
              <div className="p-6 text-center">
                <div className="mx-auto h-10 w-10 bg-lime/20 text-lime flex items-center justify-center mb-3">
                  <Bot className="h-6 w-6 text-foreground" />
                </div>
                <p className="text-sm font-bold text-foreground">Ask anything about your data</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Answers are grounded strictly in your indexed sources with verified citations.
                </p>
                {/* Suggested questions */}
                <div className="mt-4 space-y-2 text-left">
                  {[
                    "What does this business / website do?",
                    "What products or services do you recommend?",
                    "Can you summarize the main offerings and services?",
                    "How can I contact this business or team?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setInput(q);
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      className="w-full text-left text-xs border border-border px-3 py-2 hover:border-lime hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-between group"
                    >
                      <span>{q}</span>
                      <span className="text-[10px] text-lime font-mono opacity-0 group-hover:opacity-100 transition-opacity">Click to ask →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <ChatMessages messages={messages} streamingContent={streaming ? streamBuffer : undefined} />
          </div>

          {/* Error */}
          {error && (
            <div className="border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive font-medium">
              {error}
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-border p-3 bg-background">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask a question about this knowledge base... (Enter to send)"
                disabled={streaming}
                rows={2}
                className={[
                  "flex-1 resize-none bg-secondary/30 border border-input px-3 py-2 text-xs",
                  "placeholder:text-muted-foreground focus:outline-none focus:border-foreground",
                  "disabled:opacity-60",
                ].join(" ")}
                id="rag-chat-input"
                aria-label="Chat message input"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || streaming}
                className="h-10 w-10 shrink-0 bg-lime text-black hover:bg-lime/90 font-bold p-0 flex items-center justify-center cursor-pointer"
                id="rag-chat-send"
                aria-label="Send message"
              >
                {streaming ? (
                  <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-4 w-4 text-black" />
                )}
              </Button>
            </div>
            <p className="label-mono text-[9px] text-muted-foreground mt-1.5 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-lime" />
              Grounded in Qdrant Cloud vectors  Citations included
            </p>
          </div>
        </div>
      )}
    </>
  );
}


