"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_SAMPLE_SECONDS, speakCloned, toWav } from "@/lib/audio";

export type ClonedVoice = { id: string; name: string };

export const READING_PASSAGE =`Good morning everyone, and thank you for being here today. My name is ____, and I'm going to talk about a topic I find really interesting. Over the next few minutes, I'll explain the key ideas, share a few examples, and finish with what I think it means for the future. Some of these points might surprise you, so please feel free to ask questions at the end. Let's begin with a quick look at the background, and then we'll move on to the main findings.`;

export default function VoiceCloner({
  cloned,
  onCloned,
  onRemove,
  defaultName,
  readingText,
}: {
  cloned: ClonedVoice | null;
  onCloned: (v: ClonedVoice) => void;
  onRemove: () => void;
  defaultName: string;
  /** The presenter's own presentation speech; read aloud to capture their voice. */
  readingText?: string;
}) {
  const fromPresentation = Boolean(readingText?.trim());
  const text = fromPresentation
    ? readingText!.trim()
    : READING_PASSAGE.replace("____", defaultName.trim() || "____");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [sample, setSample] = useState<Blob | null>(null);
  const [sampleUrl, setSampleUrl] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [hasCamera, setHasCamera] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // auto-stop at the maximum length
  useEffect(() => {
    if (recording && seconds >= MAX_SAMPLE_SECONDS) stop();
  }, [recording, seconds]);

  function takeSample(b: Blob) {
    setSample(b);
    if (sampleUrl) URL.revokeObjectURL(sampleUrl);
    setSampleUrl(URL.createObjectURL(b));
  }

  async function start() {
    setError("");
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    try {
      // Show the camera so you can see yourself while you read; fall back to microphone only.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio,
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        setHasCamera(true);
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio });
        setHasCamera(false);
      }
      streamRef.current = stream;
      // Only the voice is recorded.
      const rec = new MediaRecorder(new MediaStream(stream.getAudioTracks()));
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        takeSample(new Blob(chunks, { type: rec.mimeType }));
      };
      rec.start(250);
      recRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Microphone permission was blocked. Allow the microphone, or upload a recording instead.");
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recRef.current?.state === "recording") recRef.current.stop();
    setRecording(false);
  }

  async function create() {
    if (!sample) return;
    setError("");
    setBusy("Creating your voice…");
    try {
      const wav = await toWav(sample);
      const fd = new FormData();
      fd.append("files", wav);
      fd.append("name", `${defaultName || "Presenter"} voice`);
      fd.append("consent", consent ? "yes" : "no");
      const res = await fetch("/api/voice/clone", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Voice cloning failed");
      onCloned({ id: data.voiceId, name: defaultName || "My voice" });
      setSample(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function preview() {
    if (!cloned) return;
    setBusy("Generating preview…");
    setError("");
    try {
      const a = await speakCloned(cloned.id, "Hello everyone! This is my own voice, ready for today's presentation.");
      await a.play();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  if (cloned) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-5 py-4 text-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/20 text-lg">🎙</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-emerald-200">✓ Using your own voice</p>
          <p className="text-xs text-slate-400">Your presentation will be spoken in your voice.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={preview} disabled={!!busy}>
          {busy ? "…" : "▶ Preview"}
        </button>
        <button type="button" className="btn-ghost" onClick={onRemove}>Re-record</button>
        {error && <p className="w-full text-xs text-red-300">{error}</p>}
      </div>
    );
  }

  const tooShort = seconds > 0 && seconds < 30 && !recording;

  return (
    <section className="card text-sm">
      <div className="mb-4 flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400/25 to-fuchsia-400/25 text-lg">🎙</span>
        <div>
          <h3 className="font-semibold">Use my own voice</h3>
          <p className="text-xs text-slate-400">
            {fromPresentation ? (
              <>Read <b>your presentation</b> aloud for <b>45–80 seconds</b>, the way you&apos;d present it.</>
            ) : (
              <>Read this aloud in a quiet room for <b>45–80 seconds</b>, the way you normally present.</>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="max-h-72 min-h-32 overflow-y-auto rounded-xl bg-black/30 p-5 text-center text-lg leading-relaxed whitespace-pre-wrap text-slate-100">
          {text}
        </div>

        <div className="mx-auto max-w-md space-y-3">

        {recording && (
          <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur">
            <div className="flex flex-col items-center justify-center gap-2 border-b border-white/10 px-5 py-3 text-center sm:flex-row sm:gap-4">
              <span className="text-sm font-semibold text-slate-300">
                {fromPresentation ? "Read your presentation aloud" : "Read this aloud"}
              </span>
              <span className="flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-sm font-bold">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> {seconds}s / {MAX_SAMPLE_SECONDS}s
              </span>
            </div>
            <div className="h-1 bg-white/10">
              <div className="h-full bg-red-400 transition-all" style={{ width: `${(seconds / MAX_SAMPLE_SECONDS) * 100}%` }} />
            </div>
            <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-6 overflow-y-auto px-6 py-6 text-center">
              {hasCamera && (
                <video
                  ref={(el) => {
                    if (el && streamRef.current && el.srcObject !== streamRef.current) el.srcObject = streamRef.current;
                  }}
                  autoPlay
                  muted
                  playsInline
                  className="aspect-video w-full max-w-sm shrink-0 -scale-x-100 rounded-2xl border-2 border-red-500/70 bg-black object-cover shadow-2xl"
                />
              )}
              <p className="text-2xl leading-relaxed whitespace-pre-wrap text-white sm:text-3xl sm:leading-relaxed">
                {text}
              </p>
            </div>
            <div className="border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button type="button" className="btn-primary mx-auto block w-full max-w-sm bg-none bg-red-500 py-3 text-lg hover:bg-red-400"
                onClick={stop}>
                {seconds < 30 ? `■ Stop (keep going: ${30 - seconds}s more is better)` : "■ Stop: I'm done"}
              </button>
            </div>
          </div>
        )}
          <button type="button" className="btn-primary w-full py-3" onClick={start} disabled={recording}>
            ● Record my voice
          </button>
          <label className="btn-ghost block cursor-pointer text-center" title="Audio file, or a phone video of you talking">
            ⬆ Upload audio / video
            <input type="file" accept="audio/*,video/*" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSeconds(0); takeSample(f); } }} />
          </label>
        {sample && !recording && (
          <>
            <audio src={sampleUrl} controls className="w-full" />
            {tooShort && <p className="text-xs text-amber-300">Tip: 45+ seconds gives a much more natural voice.</p>}
            <label className="flex items-start gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              This is my own voice and I agree to create an AI copy of it for my presentations.
            </label>
            <button type="button" className="btn-primary w-full" disabled={!consent || !!busy} onClick={create}>
              {busy || "Create my voice"}
            </button>
          </>
        )}
        {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
      </div>
    </section>
  );
}
