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
    <div className={`flex gap-4 ${isUser ? "flex-row-reverse" : "flex-row"} animate-in fade-in duration-200`}>
      {/* Avatar */}
      <div
        className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm border transition-all ${
          isUser
            ? "bg-[#1e1b1b] border-white/10 text-white"
            : isBoundary
            ? "bg-amber-50 border-amber-200 text-amber-600"
            : "bg-[#039a85]/10 border-[#039a85]/20 text-[#039a85]"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : isBoundary ? (
          <ShieldAlert className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4 animate-pulse" />
        )}
      </div>

      {/* Content */}
      <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1.5`}>
        <div
          className={`px-4.5 py-3 rounded-2xl text-sm leading-relaxed shadow-sm transition-all ${
            isUser
              ? "bg-[#1e1b1b] text-white rounded-tr-none"
              : isBoundary
              ? "bg-amber-50 border border-amber-200 text-amber-900 rounded-tl-none"
              : "bg-[#f9f9f8] border border-[#e5e5e0] text-obsidian rounded-tl-none"
          }`}
        >
          {isUser ? (
            msg.content
          ) : isBoundary ? (
            <span className="flex items-start gap-2 text-sm italic text-amber-700">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
              {msg.content}
            </span>
          ) : (
            <div className="prose prose-sm max-w-none text-[#1e1b1b]">
              <Markdown content={msg.content} />
            </div>
          )}
          {msg.streaming && (
            <span className="inline-block w-2.5 h-4 bg-[#039a85] rounded-sm ml-1 animate-pulse" />
          )}
        </div>
        <span className="text-[10px] text-ash/60 px-1 font-medium">
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
    <div className="flex flex-col h-full bg-white border border-[#e5e5e0] shadow-xl rounded-2xl overflow-hidden">
      {/* Dynamic Status Header */}
      <div className="bg-[#1e1b1b] px-6 py-4 flex items-center justify-between border-b border-white/5 flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#039a85]/10 border border-[#039a85]/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-[#039a85]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Trixon Codebase Advisor</h3>
            <p className="text-[10px] text-ash font-medium mt-0.5">Continuous Intelligence Copilot</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-[#039a85]/10 border border-[#039a85]/20 px-3 py-1 rounded-full">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#039a85] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#039a85]"></span>
          </span>
          <span className="text-[10px] font-semibold text-[#039a85] tracking-wide uppercase">Context Active</span>
        </div>
      </div>

      {/* Busy banner */}
      {busy && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center gap-2 text-xs text-amber-700 animate-pulse flex-shrink-0 z-10 font-medium">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          Analyzing your latest commit… response will stream once complete.
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 min-h-[350px] bg-[#f9f9f8]/40">
        {loading ? (
          <div className="flex justify-center pt-24">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-800" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center min-h-full py-12">
            {/* Ambient Logo/Sparkle Ring */}
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#039a85]/10 to-[#039a85]/5 flex items-center justify-center mb-6 shadow-inner border border-[#039a85]/15 group">
              <Sparkles className="w-7 h-7 text-[#039a85] transition-all duration-300 group-hover:scale-110" />
            </div>
            
            <h3 className="text-xl font-bold text-obsidian tracking-tight mb-2">Converse with your Codebase</h3>
            <p className="text-xs text-ash text-center max-w-sm mb-8 leading-relaxed">
              I have direct access to your continuous commit reports, technical debt, and codebase structure. Ask me anything.
            </p>

            <div className="w-full max-w-md space-y-2.5">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="w-full text-left text-xs text-[#1e1b1b] bg-white border border-[#e5e5e0] rounded-xl px-4 py-3.5 hover:border-signal hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-3 cursor-pointer group shadow-sm font-medium"
                >
                  <Sparkles className="w-3.5 h-3.5 text-zinc-400 group-hover:text-signal transition-colors flex-shrink-0" />
                  <span className="flex-1 truncate">{prompt}</span>
                  <span className="text-xs text-zinc-300 group-hover:text-signal transition-colors">→</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar capsule */}
      <div className="flex-shrink-0 bg-white border-t border-[#e5e5e0] px-6 py-4">
        <div className="relative flex items-center bg-[#f9f9f8] border border-[#e5e5e0] rounded-2xl px-4 py-2.5 focus-within:border-signal focus-within:ring-2 focus-within:ring-signal/15 transition-all duration-300 shadow-inner">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Trixon about your codebase..."
            rows={1}
            disabled={sending}
            className="flex-1 resize-none bg-transparent border-0 outline-none text-xs text-obsidian placeholder-zinc-400 focus:ring-0 focus:outline-none max-h-24 disabled:opacity-60 pr-12 font-medium"
            style={{ height: "auto" }}
          />
          <div className="absolute right-2.5 bottom-2.5">
            <button
              onClick={() => sendMessage(input)}
              disabled={sending || !input.trim()}
              className="w-8 h-8 rounded-xl bg-signal text-white flex items-center justify-center hover:bg-signal/90 hover:scale-105 transition-all duration-200 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer shadow-[0_2px_8px_rgba(3,154,133,0.2)]"
            >
              {sending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-center text-ash mt-2.5 font-medium">
          Powered by Trixon continuous codebase indexing. Chat history is preserved.
        </p>
      </div>
    </div>
  );
}
