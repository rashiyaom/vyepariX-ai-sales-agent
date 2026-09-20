/**
 * Chat Messages list — renders streaming tokens progressively
 * with full markdown formatting (lists, bold, clean paragraphs)
 * and citations shown separately via CitationCard.
 */
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { CitationCard, type Citation } from "./CitationCard";
import { Bot, User } from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  abstained?: boolean;
  streaming?: boolean;
}

interface ChatMessagesProps {
  messages: ChatMessage[];
  streamingContent?: string | undefined;
}

export function cleanChatText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\[CITATIONS[\s\S]*$/i, "")
    .replace(/【\d+】/g, "")
    .replace(/\[SOURCE\s*\d+\]/gi, "")
    .trim();
}

export function ChatMessages({ messages, streamingContent }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto" id="rag-chat-messages">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* In-flight streaming message */}
      {streamingContent !== undefined && streamingContent !== "" && (
        <StreamingBubble content={streamingContent} />
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const cleanedContent = isUser ? message.content : cleanChatText(message.content);

  return (
    <div className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="h-7 w-7 shrink-0 border border-border bg-violet flex items-center justify-center">
          <Bot className="h-3.5 w-3.5 text-white" />
        </div>
      )}

      <div className={`max-w-[88%] space-y-2 ${isUser ? "items-end flex flex-col" : ""}`}>
        {/* Message bubble */}
        <div
          className={[
            "px-3.5 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground font-medium"
              : message.abstained
              ? "border border-border bg-secondary text-muted-foreground italic"
              : "border border-border bg-card text-foreground shadow-xs",
          ].join(" ")}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <div className="chat-markdown text-sm leading-relaxed space-y-2">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                  ul: ({ children }) => <ul className="my-2 pl-4 list-disc space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="my-2 pl-4 list-decimal space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                  h1: ({ children }) => <h3 className="text-base font-bold text-foreground mt-2 mb-1">{children}</h3>,
                  h2: ({ children }) => <h3 className="text-base font-bold text-foreground mt-2 mb-1">{children}</h3>,
                  h3: ({ children }) => <h4 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h4>,
                }}
              >
                {cleanedContent}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Citations */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="w-full space-y-1 pt-1">
            <p className="label-mono text-[9px] text-muted-foreground">SOURCES</p>
            {message.citations.map((c, i) => (
              <CitationCard key={i} citation={c} index={i} />
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="h-7 w-7 shrink-0 border border-border bg-secondary flex items-center justify-center">
          <User className="h-3.5 w-3.5 text-foreground" />
        </div>
      )}
    </div>
  );
}

function StreamingBubble({ content }: { content: string }) {
  const cleaned = cleanChatText(content);

  return (
    <div className="flex gap-2.5 justify-start">
      <div className="h-7 w-7 shrink-0 border border-border bg-violet flex items-center justify-center">
        <Bot className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="max-w-[88%] border border-border bg-card px-3.5 py-2.5 text-sm leading-relaxed text-foreground shadow-xs">
        <div className="chat-markdown text-sm leading-relaxed space-y-2">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="my-2 pl-4 list-disc space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="my-2 pl-4 list-decimal space-y-1">{children}</ol>,
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
            }}
          >
            {cleaned}
          </ReactMarkdown>
        </div>
        {/* Blinking cursor */}
        <span className="inline-block w-1.5 h-3.5 bg-violet ml-1 align-middle animate-[status-blink_1.2s_step-end_infinite]" />
      </div>
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      {[70, 85, 60].map((w, i) => (
        <div key={i} className={`flex gap-2 ${i % 2 === 0 ? "" : "justify-end"}`}>
          {i % 2 === 0 && <div className="h-7 w-7 shrink-0 bg-secondary" />}
          <div className="h-10 bg-secondary" style={{ width: `${w}%` }} />
          {i % 2 !== 0 && <div className="h-7 w-7 shrink-0 bg-secondary" />}
        </div>
      ))}
    </div>
  );
}
