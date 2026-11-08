"use client";

import { useEffect, useRef, useState } from "react";
import type { Deck } from "@/lib/types";

export type ChatMsg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Add a slide with real-world examples",
  "Make the speech sound more confident",
  "Shorten it to fit 5 minutes",
  "Add a conclusion with 3 key takeaways",
  "Make it more formal and academic",
];

export default function ChatPanel({
  deck,
  messages,
  setMessages,
  onDeck,
}: {
  deck: Deck;
  messages: ChatMsg[];
  setMessages: (m: ChatMsg[]) => void;
  onDeck: (d: Deck) => void;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [messages, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: ChatMsg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/slides/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deck, messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      onDeck(data.deck);
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex h-[28rem] flex-col p-0">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="font-semibold">💬 Chat with AI to edit your presentation</h3>
        <p className="text-xs text-slate-400">Ask for any change, the slides update instantly.</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)}
                className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300 hover:bg-white/10">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, k) => (
          <div key={k} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-wrap ${
              m.role === "user" ? "bg-sky-500 text-slate-950" : "bg-white/10 text-slate-100"}`}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex gap-1 px-2 py-2">
            {[0, 1, 2].map((d) => (
              <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                style={{ animationDelay: `${d * 150}ms` }} />
            ))}
          </div>
        )}
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div ref={endRef} />
      </div>
      <form className="flex gap-2 border-t border-white/10 p-3"
        onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <textarea
          className="input max-h-32 min-h-10 flex-1 resize-none"
          rows={1}
          value={input}
          placeholder="e.g. Add a slide about the costs and make slide 2 simpler"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <button className="btn-primary" disabled={busy || !input.trim()}>Send</button>
      </form>
    </div>
  );
}
