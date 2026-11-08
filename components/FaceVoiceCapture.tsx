"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_SAMPLE_SECONDS, toWav } from "@/lib/audio";
import type { ClonedVoice } from "./VoiceCloner";

const PASSAGE = `Hello everyone, and thank you for joining me today. I'm going to walk you through a topic I've been researching, explain the most important ideas, and share some examples that make them easier to understand. I'll finish with my conclusions and what I think they mean for the future. If anything is unclear, please ask me at the end. Now, let's get started with a little background, and then we'll move on to the main points.`;

/** Grabs a still frame from a <video>, resized to max 1024px, as a JPEG data URL. */
function grabFrame(video: HTMLVideoElement, mirror = false) {
  const max = 1024;
  const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(video.videoWidth * scale);
  c.height = Math.round(video.videoHeight * scale);
  const ctx = c.getContext("2d")!;
  if (mirror) {
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.92);
}

async function cloneFrom(audio: Blob, name: string): Promise<ClonedVoice> {
  const wav = await toWav(audio);
  const fd = new FormData();
  fd.append("files", wav);
  fd.append("name", `${name || "Presenter"} voice`);
  fd.append("consent", "yes");
  const res = await fetch("/api/voice/clone", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Voice cloning failed");
  return { id: data.voiceId, name: name || "My voice" };
}

type Phase = "ready" | "countdown" | "recording" | "processing" | "done";

export default function FaceVoiceCapture({
  name,
  readingText,
  onPhoto,
  onVoice,
  onClose,
}: {
  name: string;
  readingText?: string;
  onPhoto: (dataUrl: string) => void;
  onVoice: (v: ClonedVoice) => void;
  onClose: () => void;
}) {
  const fromPresentation = Boolean(readingText?.trim());
  const text = fromPresentation ? readingText!.trim() : PASSAGE;
  const [phase, setPhase] = useState<Phase>("ready");
  const [count, setCount] = useState(3);
  const [seconds, setSeconds] = useState(0);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError("Camera/microphone blocked. Allow access, or upload a video from your phone instead."));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // countdown → take photo → start recording voice
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count === 0) {
      const v = videoRef.current;
      const s = streamRef.current;
      if (!v || !s) return;
      onPhoto(grabFrame(v, true));
      const rec = new MediaRecorder(new MediaStream(s.getAudioTracks()));
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => finish(new Blob(chunks, { type: rec.mimeType }));
      rec.start(250);
      recRef.current = rec;
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setSeconds(0);
      setPhase("recording");
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, count]);

  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === "recording" && seconds >= MAX_SAMPLE_SECONDS) recRef.current?.stop();
  }, [phase, seconds]);

  async function finish(audio: Blob) {
    setPhase("processing");
    setStatus("Creating your voice…");
    try {
      onVoice(await cloneFrom(audio, name));
      setPhase("done");
    } catch (e) {
      setError(`Photo saved ✓. Voice: ${(e as Error).message}`);
      setPhase("done");
    }
  }

  async function fromPhoneVideo(file?: File) {
    if (!file) return;
    if (!consent) return setError("Please tick the consent box first.");
    setError("");
    setPhase("processing");
    setStatus("Reading your video…");
    try {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.src = url;
      await new Promise<void>((res, rej) => {
        v.onloadeddata = () => res();
        v.onerror = () => rej(new Error("This video format can't be read here. Try MP4 or MOV."));
      });
      v.currentTime = Math.min(0.5, v.duration / 2);
      await new Promise<void>((res) => (v.onseeked = () => res()));
      onPhoto(grabFrame(v));
      URL.revokeObjectURL(url);
      setStatus("Creating your voice…");
      onVoice(await cloneFrom(file, name));
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("done");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="card max-h-full w-full max-w-4xl space-y-4 overflow-y-auto bg-slate-900">
        <div className="relative text-center">
          <h3 className="text-lg font-semibold">🎥 Quick setup: your face + your voice</h3>
          <button className="btn-ghost absolute top-0 right-0 px-2 py-1" onClick={onClose} disabled={phase === "recording"}>✕</button>
        </div>

        {/* camera on the left, instructions / reading text on the right; stacked on phones */}
        <div className="grid items-start gap-5 sm:grid-cols-[minmax(0,280px)_1fr]">
        <div className="relative mx-auto aspect-3/4 w-full max-w-64 overflow-hidden rounded-xl bg-black sm:max-w-none">
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
          {/* face guide */}
          <div className="pointer-events-none absolute inset-[12%_18%_22%] rounded-[50%] border-2 border-dashed border-white/60" />
          {phase === "countdown" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 text-center">
              <span className="text-6xl font-bold">{count || "📸"}</span>
              <span className="mt-2 text-sm">Look at the camera · mouth closed · still</span>
            </div>
          )}
          {phase === "recording" && (
            <span className="absolute top-2 right-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold">● {seconds}s</span>
          )}
        </div>

        <div className="space-y-3">
        {phase === "ready" && (
          <>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
              <li>Put your face inside the oval, in good light.</li>
              <li>After a 3-second countdown, a <b>photo</b> is taken. Keep still, mouth closed.</li>
              <li>
                Then read {fromPresentation ? <b>your presentation</b> : "the text"} aloud for <b>45–80 seconds</b>.
                That becomes <b>your voice</b>.
              </li>
            </ol>
            <label className="flex items-start gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              This is me. I agree to create an AI version of my face and voice for my own presentations.
            </label>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={!consent || !!error}
                onClick={() => { setCount(3); setPhase("countdown"); }}>
                ● Start
              </button>
              <label className={`btn-ghost cursor-pointer text-center text-sm ${!consent ? "pointer-events-none opacity-40" : ""}`}>
                Upload phone video
                <input type="file" accept="video/*" className="sr-only" onChange={(e) => fromPhoneVideo(e.target.files?.[0])} />
              </label>
            </div>
          </>
        )}

        {phase === "recording" && (
          <>
            <p className="max-h-[50vh] overflow-y-auto rounded-lg bg-black/40 p-4 text-center text-xl leading-relaxed whitespace-pre-wrap sm:text-2xl">
              {text}
            </p>
            <div className="h-1.5 overflow-hidden rounded bg-white/10">
              <div className="h-full bg-red-400" style={{ width: `${(seconds / MAX_SAMPLE_SECONDS) * 100}%` }} />
            </div>
            <button className="btn-primary w-full bg-red-500 hover:bg-red-400" onClick={() => recRef.current?.stop()}
              disabled={seconds < 20}>
              {seconds < 20 ? `Keep reading… (${20 - seconds}s)` : "■ Stop: I'm done"}
            </button>
          </>
        )}

        {phase === "processing" && (
          <p className="flex items-center gap-2 text-sm text-sky-200">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" /> {status}
          </p>
        )}

        {phase === "done" && (
          <div className="space-y-2">
            {!error && <p className="text-sm text-emerald-300">✓ Your photo and voice are ready.</p>}
            <button className="btn-primary w-full" onClick={onClose}>Continue</button>
          </div>
        )}

        {error && <p className="text-sm text-red-300">{error}</p>}
        </div>
        </div>
      </div>
    </div>
  );
}
