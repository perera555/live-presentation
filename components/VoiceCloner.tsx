"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_SAMPLE_SECONDS, speakCloned, toWav } from "@/lib/audio";

export type ClonedVoice = { id: string; name: string };

const READING_PASSAGE = `Good morning everyone, and thank you for being here today. My name is ____, and I'm going to talk about a topic I find really interesting. Over the next few minutes, I'll explain the key ideas, share a few examples, and finish with what I think it means for the future. Some of these points might surprise you, so please feel free to ask questions at the end. Let's begin with a quick look at the background, and then we'll move on to the main findings.`;

export default function VoiceCloner({
  cloned,
  onCloned,
  onRemove,
  defaultName,
}: {
  cloned: ClonedVoice | null;
  onCloned: (v: ClonedVoice) => void;
  onRemove: () => void;
  defaultName: string;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [sample, setSample] = useState<Blob | null>(null);
  const [sampleUrl, setSampleUrl] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recRef.current?.stream.getTracks().forEach((t) => t.stop());
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
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
      <div className="space-y-2 rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm">
        <p className="font-medium text-emerald-200">✓ Using your own voice</p>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost flex-1 text-xs" onClick={preview} disabled={!!busy}>
            {busy ? "…" : "▶ Preview"}
          </button>
          <button type="button" className="btn-ghost flex-1 text-xs" onClick={onRemove}>Re-record</button>
        </div>
        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>
    );
  }

  const tooShort = seconds > 0 && seconds < 30 && !recording;

  return (
    <details className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
      <summary className="cursor-pointer font-medium text-sky-200">🎙 Use my own voice</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-slate-400">
          Read this aloud in a quiet room for <b>45–80 seconds</b> (read it twice if needed), speaking the way you
          normally present:
        </p>
        <p className="max-h-36 overflow-y-auto rounded bg-black/30 p-2 text-xs leading-relaxed text-slate-200">
          {READING_PASSAGE}
        </p>
        <div className="flex items-center gap-2">
          {recording ? (
            <button type="button" className="btn-primary flex-1 bg-red-500 hover:bg-red-400" onClick={stop}>
              ■ Stop ({seconds}s)
            </button>
          ) : (
            <button type="button" className="btn-secondary flex-1" onClick={start}>● Record</button>
          )}
          <label className="btn-ghost cursor-pointer text-xs" title="Audio file, or a phone video of you talking">
            Upload audio / video
            <input type="file" accept="audio/*,video/*" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSeconds(0); takeSample(f); } }} />
          </label>
        </div>
        {recording && (
          <div className="h-1.5 overflow-hidden rounded bg-white/10">
            <div className="h-full bg-red-400 transition-all" style={{ width: `${(seconds / MAX_SAMPLE_SECONDS) * 100}%` }} />
          </div>
        )}
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
    </details>
  );
}
