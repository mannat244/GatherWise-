"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, AlertCircle, Compass } from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  followUpQuestion?: string;
  suggestedAnswers?: string[];
  isGrounded?: boolean;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onSelectSuggestion?: (text: string) => void;
}

export function ChatPanel({
  messages,
  isLoading,
  onSendMessage,
  onSelectSuggestion,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="flex h-full flex-col rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white shadow-xs">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-stone-900">GatherWise Copilot</h3>
            <span className="flex items-center gap-1 text-[10px] text-stone-600 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Conversational Planning Assistant
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-[10px] font-medium text-stone-600">
          <Sparkles className="h-3 w-3 text-brand-600" />
          <span>Gemini GenAI</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <div
              key={message.id}
              className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 mt-0.5 text-xs">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? "bg-stone-900 text-white rounded-br-xs"
                    : "bg-stone-100 text-stone-900 rounded-bl-xs border border-stone-200/60"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>

                {/* Grounding Source Badge */}
                {message.isGrounded && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/50">
                    <Compass className="h-3 w-3 text-emerald-600" />
                    <span>Grounded with Google Search / Places</span>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-700 mt-0.5 text-xs">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-stone-500 italic p-2">
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-ping" />
            <span>GatherWise is reasoning and updating plan...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Follow-up Quick Suggestion Chips */}
      {lastAssistantMessage?.suggestedAnswers &&
        lastAssistantMessage.suggestedAnswers.length > 0 &&
        !isLoading && (
          <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-2">
            <span className="block text-[11px] font-medium text-stone-600 mb-1.5">
              Suggested quick replies:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {lastAssistantMessage.suggestedAnswers.map((suggestion, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSelectSuggestion?.(suggestion)}
                  className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50 transition-colors shadow-2xs"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="border-t border-stone-200 bg-white p-3">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your reply, change constraints, or ask for places..."
            disabled={isLoading}
            className="w-full rounded-xl border border-stone-300 bg-stone-50/50 px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="absolute right-1.5 rounded-lg bg-brand-600 p-1.5 text-white hover:bg-brand-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
