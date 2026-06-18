"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Loader2, Bot, User, Sparkles, AlertCircle, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { api, type ChatMessage } from "@/lib/api";
import { Markdown } from "@/components/markdown";

// -----------------------------------------------
// Boundary detection
// -----------------------------------------------
const BOUNDARY_PHRASE = "I can only help with questions about your";

function isBoundaryResponse(content: string): boolean {
  return content.includes(BOUNDARY_PHRASE);
}

// -----------------------------------------------
// Report-aware starter prompts (v3.3)
// -----------------------------------------------
const REPORT_PROMPT_MAP: Record<string, string> = {
  executive_summary: "Give me a plain-English overview of what this codebase does",
  architecture: "How do the frontend, backend, and database connect in this project?",
  tech_debt: "What are the messiest parts of the code I should clean up first?",
  security: "What are the biggest security risks in this codebase right now?",
  scalability: "What would break first if I got 10x more users tomorrow?",
  onboarding: "What does a new developer need to know to get started on this project?",
  investor: "How would you summarize this codebase for a technical investor?",
};

const FALLBACK_PROMPTS = [
  "What are the biggest risks in my codebase right now?",
  "Which issue should I fix first this sprint?",
  "Explain the key findings in plain English.",
];

function getStarterPrompts(selectedReports?: string[] | null): string[] {
  if (!selectedReports || selectedReports.length === 0) return FALLBACK_PROMPTS;
  return selectedReports
    .filter((r) => REPORT_PROMPT_MAP[r])
    .map((r) => REPORT_PROMPT_MAP[r])
    .slice(0, 3);
}

// -----------------------------------------------
// Message Bubble (with boundary response variant)
// -----------------------------------------------
function MessageBubble({ msg }: { msg: ChatMessage & { streaming?: boolean } }) {
  const isUser = msg.role === "user";
  const isBoundary = !isUser && isBoundaryResponse(msg.content);

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-1 ${
          isUser
            ? "bg-obsidian"
            : isBoundary
            ? "bg-amber-50 border border-amber-200"
            : "bg-zinc-100 border border-zinc-200"
        }`}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-paper-raised" />
        ) : isBoundary ? (
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-zinc-700" />
        )}
      </div>

      {/* Content */}
      <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? "bg-obsidian text-paper-raised rounded-tr-sm"
              : isBoundary
              ? "bg-amber-50 border border-amber-200 text-amber-800 rounded-tl-sm"
              : "bg-paper-raised border border-paper-sunken text-obsidian rounded-tl-sm"
          }`}
        >
          {isUser ? (
            msg.content
          ) : isBoundary ? (
            <span className="flex items-start gap-2 text-sm italic text-amber-700">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
              {msg.content}
            </span>
          ) : (
            <Markdown content={msg.content} />
          )}
          {msg.streaming && (
            <span className="inline-block w-2 h-3.5 bg-zinc-800 rounded-sm ml-0.5 animate-pulse" />
          )}
        </div>
        <span className="text-[10px] text-ash/70 px-1">
          {new Date(msg.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

// -----------------------------------------------
// Main Component
// -----------------------------------------------
interface ProjectChatProps {
  projectId: string;
  selectedReports?: string[] | null;
}

export function ProjectChat({ projectId, selectedReports }: ProjectChatProps) {
  const supabase = createClient();
  const [messages, setMessages] = useState<(ChatMessage & { streaming?: boolean })[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const starterPrompts = getStarterPrompts(selectedReports);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load chat history
  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await api.getChatHistory(session.access_token, projectId);
        setMessages(res.messages);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || sending) return;
      setSending(true);
      setBusy(false);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      // Optimistically add user message
      const userMsg: ChatMessage & { streaming?: boolean } = {
        id: `temp-user-${Date.now()}`,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
        referenced_action_items: null,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");

      // Add streaming placeholder
      const streamId = `stream-${Date.now()}`;
      const streamMsg: ChatMessage & { streaming?: boolean } = {
        id: streamId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
        referenced_action_items: null,
        streaming: true,
      };
      setMessages((prev) => [...prev, streamMsg]);

      try {
        const response = await api.sendChatMessage(session.access_token, projectId, text);

        if (response.headers.get("X-Trixon-Busy") === "true") {
          setBusy(true);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") break;
                try {
                  const parsed = JSON.parse(data);
                  accumulated += parsed.text;
                } catch {
                  accumulated += data;
                }
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === streamId ? { ...m, content: accumulated } : m
                  )
                );
              }
            }
          }
        }

        // Finalize: remove streaming flag
        setMessages((prev) =>
          prev.map((m) => (m.id === streamId ? { ...m, streaming: false } : m))
        );
      } catch (e) {
        console.error(e);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamId
              ? {
                  ...m,
                  content: "Sorry, something went wrong. Please try again.",
                  streaming: false,
                }
              : m
          )
        );
      } finally {
        setSending(false);
      }
    },
    [projectId, sending]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const isEmpty = messages.length === 0 && !loading;

  return (
    <div className="flex flex-col h-full bg-paper-sunken rounded-2xl border border-paper-sunken overflow-hidden">
      {/* Busy banner */}
      {busy && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-1.5 text-xs text-amber-600">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          Analyzing your latest commit… response will stream once complete.
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 min-h-[350px]">
        {loading ? (
          <div className="flex justify-center pt-20">
            <Loader2 className="w-7 h-7 animate-spin text-zinc-800" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center min-h-full py-8">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-3">
              <Bot className="w-6 h-6 text-zinc-700" />
            </div>
            <h3 className="text-base font-bold text-obsidian mb-1">Ask Trixon about this project</h3>
            <p className="text-xs text-ash text-center max-w-xs mb-6">
              I have access to your reports, action items, and codebase analysis. Ask me anything about this project.
            </p>

            <div className="w-full max-w-sm space-y-1.5">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="w-full text-left text-xs text-[#5a5458] bg-paper-raised border border-paper-sunken rounded-xl px-4 py-2.5 hover:border-zinc-400 hover:text-zinc-900 transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 bg-paper-raised border-t border-paper-sunken px-4 py-3">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your codebase…"
            rows={1}
            disabled={sending}
            className="flex-1 resize-none bg-paper-sunken border border-paper-sunken rounded-xl px-4 py-2.5 text-xs text-obsidian placeholder-[#c0baba] focus:outline-none focus:border-zinc-800 focus:ring-1 focus:ring-zinc-800/10 transition-all max-h-24 disabled:opacity-60"
            style={{ height: "auto" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={sending || !input.trim()}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-zinc-900 text-paper-raised flex items-center justify-center hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
