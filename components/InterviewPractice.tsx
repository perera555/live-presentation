"use client";

import { useEffect, useRef, useState } from "react";

type Feedback = { score: number; strengths: string[]; improve: string[]; betterAnswer: string };

// Minimal typing for the Web Speech API (Chrome, Edge, Safari).
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getRecognition(): Recognition | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
}

/** Interview PRACTICE: AI asks questions out loud, you answer by voice, you get feedback. Pauses during real calls. */
export default function InterviewPractice() {
  const [role, setRole] = useState("");
  const [details, setDetails] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [inCall, setInCall] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setCanListen(Boolean(getRecognition()));
    const onCall = (e: Event) => {
      const active = Boolean((e as CustomEvent<boolean>).detail);
      setInCall(active);
      if (active) {
        recRef.current?.stop();
        speechSynthesis.cancel();
      }
    };
    window.addEventListener("lp-call-state", onCall);
    return () => window.removeEventListener("lp-call-state", onCall);
  }, []);

  const question = questions[idx];

  async function call(payload: object) {
    const res = await fetch("/api/interview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role, details, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    return data;
  }

  async function start() {
    setError("");
    setBusy("Preparing your practice questions…");
    try {
      const data = await call({ action: "questions" });
      setQuestions(data.questions);
      setIdx(0);
      setAnswer("");
      setFeedback(null);
      ask(data.questions[0]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function ask(q = question) {
    if (!q) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(q));
  }

  function listen() {
    const rec = getRecognition();
    if (!rec) return;
    speechSynthesis.cancel();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalText) setAnswer((a) => `${a} ${finalText}`.trim());
      setInterim(interimText);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    rec.onerror = () => setError("Voice recognition stopped. Check the microphone, or type your answer.");
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function stopListening() {
    recRef.current?.stop();
  }

  async function getFeedback() {
    stopListening();
    setError("");
    setBusy("Reviewing your answer…");
    try {
      setFeedback(await call({ action: "feedback", question, answer }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function next() {
    const n = idx + 1;
    setIdx(n);
    setAnswer("");
    setFeedback(null);
    if (questions[n]) ask(questions[n]);
  }

  return (
    <section className="card space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">🎯 Interview practice</h2>
        <p className="text-xs text-slate-400">
          Practise <b>before</b> your interview: the AI asks, you answer out loud, you get coaching.
        </p>
      </div>

      {inCall ? (
        <p className="rounded-xl bg-amber-400/10 p-4 text-center text-sm text-amber-200">
          Paused while you&apos;re in a call. Good luck, you&apos;ve practised for this! 💪
        </p>
      ) : questions.length === 0 ? (
        <div className="space-y-3">
          <input className="input" value={role} onChange={(e) => setRole(e.target.value)}
            placeholder="Interview for… e.g. Software intern, MSc Data Science" />
          <textarea className="input min-h-20 text-sm" value={details} onChange={(e) => setDetails(e.target.value)}
            placeholder="Optional: about you (studies, projects, experience) so feedback fits you" />
          <button type="button" className="btn-primary w-full" disabled={!role.trim() || !!busy} onClick={start}>
            {busy || "▶ Start practice"}
          </button>
        </div>
      ) : idx >= questions.length ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-emerald-300">✓ You practised all {questions.length} questions. Great work!</p>
          <button type="button" className="btn-secondary w-full" onClick={() => { setQuestions([]); setIdx(0); }}>
            New practice session
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Question {idx + 1} of {questions.length}</span>
            <button type="button" className="text-sky-300 hover:underline" onClick={() => ask()}>🔊 Repeat</button>
          </div>
          <p className="rounded-xl bg-black/30 p-4 text-base font-medium leading-relaxed">{question}</p>

          <div className="space-y-2">
            <textarea className="input min-h-24 text-sm" value={answer + (interim ? ` ${interim}` : "")}
              onChange={(e) => setAnswer(e.target.value)} readOnly={listening}
              placeholder={canListen ? "Press 🎙 and answer out loud (or type)" : "Type your answer"} />
            <div className="grid grid-cols-2 gap-2">
              {canListen && (
                listening ? (
                  <button type="button" className="rounded-xl bg-red-600 px-3 py-2.5 font-semibold text-white" onClick={stopListening}>
                    ■ Stop
                  </button>
                ) : (
                  <button type="button" className="btn-secondary" onClick={listen}>🎙 Answer</button>
                )
              )}
              <button type="button" className={`btn-primary ${canListen ? "" : "col-span-2"}`}
                disabled={!answer.trim() || !!busy} onClick={getFeedback}>
                {busy || "Get feedback"}
              </button>
            </div>
          </div>

          {feedback && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm">
              <p className="text-center text-2xl font-bold">
                {feedback.score}<span className="text-sm text-slate-400">/10</span>
              </p>
              <div>
                <p className="font-semibold text-emerald-300">What was good</p>
                <ul className="list-disc pl-5 text-slate-300">{feedback.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
              <div>
                <p className="font-semibold text-amber-300">To improve</p>
                <ul className="list-disc pl-5 text-slate-300">{feedback.improve.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
              <details>
                <summary className="cursor-pointer font-semibold text-sky-300">Stronger version of your answer</summary>
                <p className="mt-2 text-slate-300">{feedback.betterAnswer}</p>
              </details>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn-ghost" onClick={() => { setAnswer(""); setFeedback(null); }}>↺ Try again</button>
                <button type="button" className="btn-primary" onClick={next}>Next question →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-center text-sm text-red-300">{error}</p>}
    </section>
  );
}
