"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { useAIStore, type AIProvider } from "@/store/ai-store";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  X,
  Send,
  Settings,
  Bot,
  User,
  Loader2,
  AlertCircle,
  Check,
  ChevronDown,
  RotateCcw,
  Wrench,
  Square,
} from "lucide-react";

function ProviderSelector() {
  const { provider, setProvider, anthropicKey, openaiKey, setAnthropicKey, setOpenaiKey, showSettings, setShowSettings } = useAIStore();
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "valid" | "invalid">("idle");
  const [testError, setTestError] = useState<string | null>(null);

  const currentKey = provider === "anthropic" ? anthropicKey : openaiKey;

  // Reset test status when key or provider changes
  useEffect(() => {
    setTestStatus("idle");
    setTestError(null);
  }, [currentKey, provider]);

  const testKey = async () => {
    if (!currentKey) return;
    setTestStatus("testing");
    setTestError(null);
    try {
      const res = await fetch("/api/ai/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: currentKey }),
      });
      const data = await res.json();
      if (data.valid) {
        setTestStatus("valid");
      } else {
        setTestStatus("invalid");
        setTestError(data.error || "Invalid key");
      }
    } catch {
      setTestStatus("invalid");
      setTestError("Connection failed");
    }
  };

  return (
    <div className="border-b border-border/50 px-3 py-2">
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <Settings className="h-3 w-3" />
        <span>AI Settings</span>
        {/* Show a dot indicator when settings are collapsed */}
        {!showSettings && currentKey && (
          <span className={cn(
            "ml-1 h-1.5 w-1.5 rounded-full",
            testStatus === "valid" ? "bg-green-500" : testStatus === "invalid" ? "bg-destructive" : "bg-muted-foreground/40"
          )} />
        )}
        <ChevronDown className={cn("h-3 w-3 ml-auto transition-transform", showSettings && "rotate-180")} />
      </button>
      {showSettings && (
        <div className="mt-2 space-y-2 pb-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Provider</label>
            <div className="flex gap-1 mt-1">
              {(["anthropic", "openai"] as AIProvider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={cn(
                    "flex-1 text-xs py-1.5 px-2 rounded-lg border transition-colors capitalize",
                    provider === p
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p === "anthropic" ? "Claude" : "OpenAI"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {provider === "anthropic" ? "Anthropic" : "OpenAI"} API Key
            </label>
            <div className="flex gap-1.5 mt-1">
              <input
                type="password"
                value={currentKey}
                onChange={(e) =>
                  provider === "anthropic"
                    ? setAnthropicKey(e.target.value)
                    : setOpenaiKey(e.target.value)
                }
                placeholder="sk-..."
                className={cn(
                  "flex-1 text-xs px-2 py-1.5 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary",
                  testStatus === "valid" && "border-green-500/50",
                  testStatus === "invalid" && "border-destructive/50"
                )}
              />
              <button
                onClick={testKey}
                disabled={!currentKey || testStatus === "testing"}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                {testStatus === "testing" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Test"
                )}
              </button>
            </div>
            {testStatus === "valid" && (
              <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                <Check className="h-3 w-3" /> Key is valid
              </p>
            )}
            {testStatus === "invalid" && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {testError}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  list_milestones: "Listing milestones",
  list_features: "Listing features",
  create_milestone: "Creating milestone",
  create_feature: "Creating feature",
  update_feature: "Updating feature",
  bulk_update_features: "Updating features",
  delete_feature: "Deleting feature",
  create_dependency: "Creating dependency",
  list_teams: "Listing teams",
  summarize_milestone: "Summarizing milestone",
};

function ToolPart({ part }: { part: { toolName: string; state: string; output?: unknown } }) {
  const label = TOOL_LABELS[part.toolName] || part.toolName;
  const isComplete = part.state === "output-available";
  const hasError =
    isComplete &&
    part.output &&
    typeof part.output === "object" &&
    "error" in (part.output as Record<string, unknown>);

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-0.5">
      {!isComplete ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : hasError ? (
        <AlertCircle className="h-3 w-3 text-destructive" />
      ) : (
        <Check className="h-3 w-3 text-green-500" />
      )}
      <Wrench className="h-3 w-3" />
      <span>{label}</span>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  // Extract text and tool parts from message.parts
  const textContent = message.parts
    ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
    .trim();

  // In AI SDK v6, tool parts have type "dynamic-tool" or "tool-<name>"
  const toolParts = message.parts?.filter(
    (p) => p.type === "dynamic-tool" || (p.type.startsWith("tool-") && p.type !== "tool-invocation")
  ) as Array<{ type: string; toolName: string; state: string; output?: unknown }> | undefined;

  // Skip rendering empty assistant messages (tool-only steps with no text)
  if (!isUser && !textContent && (!toolParts || toolParts.length === 0)) {
    return null;
  }

  return (
    <div className={cn("flex gap-2 px-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      <div className="flex flex-col gap-1 max-w-[85%]">
        {toolParts?.map((tp, i) => (
          <ToolPart key={i} part={tp} />
        ))}
        {textContent && (
          <div
            className={cn(
              "text-sm rounded-2xl px-3 py-2 whitespace-pre-wrap break-words",
              isUser
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-card border border-border/50 text-foreground rounded-bl-md"
            )}
          >
            {textContent}
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export function AIChatPanel() {
  const { isOpen, setIsOpen, provider, anthropicKey, openaiKey } = useAIStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [hasScrolled, setHasScrolled] = useState(false);

  const queryClient = useQueryClient();
  const apiKey = provider === "anthropic" ? anthropicKey : openaiKey;
  const needsKey = !apiKey;

  const chatOptions = useMemo(
    () => ({
      api: "/api/ai/chat",
      body: { provider, apiKey },
      onError: (err: Error) => {
        console.error("Chat error:", err);
      },
      onFinish: () => {
        // Invalidate all data queries so UI reflects AI-made changes
        queryClient.invalidateQueries({ queryKey: ["milestones"] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        queryClient.invalidateQueries({ queryKey: ["teams"] });
        queryClient.invalidateQueries({ queryKey: ["dependencies"] });
        queryClient.invalidateQueries({ queryKey: ["projectStats"] });
      },
    }),
    [provider, apiKey, queryClient]
  );

  const { messages, sendMessage, status, error, setMessages, stop, clearError, regenerate } =
    useChat(chatOptions);

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current && !hasScrolled) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, hasScrolled]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Global hotkey: Ctrl+/ to toggle AI panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, setIsOpen]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setHasScrolled(scrollHeight - scrollTop - clientHeight > 50);
  }, []);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isLoading || needsKey) return;
    const text = inputValue.trim();
    setInputValue("");
    sendMessage({ text });
  }, [inputValue, isLoading, needsKey, sendMessage]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-5 right-5 z-50 h-11 w-11 rounded-2xl shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-105",
          isOpen
            ? "bg-muted text-muted-foreground hover:bg-muted/80"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          "fixed bottom-20 right-5 z-50 w-[380px] max-h-[600px] rounded-2xl border border-border/50 bg-background shadow-2xl flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right",
          isOpen
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-2 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-card/50">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium flex-1">AI Assistant</span>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Clear chat"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Settings */}
        <ProviderSelector />

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto py-3 space-y-3 min-h-0"
          style={{ maxHeight: "400px" }}
        >
          {messages.length === 0 && !needsKey && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">How can I help?</p>
              <p className="text-xs text-muted-foreground mt-1">
                I can create features, manage milestones, set up dependencies, and summarize your projects.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-4 justify-center">
                {[
                  "Summarize my project",
                  "Create a feature",
                  "What's at risk?",
                  "Break down an epic",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInputValue(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {needsKey && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8">
              <AlertCircle className="h-8 w-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-foreground">API Key Required</p>
              <p className="text-xs text-muted-foreground mt-1">
                Open AI Settings above and enter your {provider === "anthropic" ? "Anthropic" : "OpenAI"} API key to get started.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-2 px-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="bg-card border border-border/50 rounded-2xl rounded-bl-md px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          {error && (
            <div className="px-3">
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <div>
                  <p>Something went wrong.</p>
                  <button
                    onClick={() => {
                      clearError();
                      regenerate();
                    }}
                    className="underline mt-1 hover:no-underline"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border/50 p-3">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={needsKey ? "Configure API key first..." : "Ask me anything..."}
              disabled={needsKey}
              rows={1}
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary resize-none disabled:opacity-50 min-h-[36px] max-h-[100px]"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            {isLoading ? (
              <button
                type="button"
                onClick={() => stop()}
                className="h-9 w-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80 transition-colors flex-shrink-0"
                title="Stop generating"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!inputValue.trim() || needsKey}
                className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
