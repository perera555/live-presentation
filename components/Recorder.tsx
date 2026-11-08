"use client";

import { useEffect, useRef, useState } from "react";
import type { Deck } from "@/lib/types";
import { downloadBlob, safeName } from "@/lib/export";

function pickMime() {
  const c = [
    "video/mp4;codecs=avc1,mp4a",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm",
  ];
  return c.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

/**
 * Phone / webcam recording with a teleprompter: the presenter records themselves
 * while their script scrolls over the camera preview, then saves the video.
 */
export default function Recorder({ deck, onExit }: { deck: Deck; onExit: () => void }) {
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState(1.4);
  const [fontSize, setFontSize] = useState(26);
  const [scrolling, setScrolling] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; url: string; ext: string } | null>(null);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  const script = deck.slides.map((s, i) => `— Slide ${i + 1}: ${s.title} —\n${s.script}`).join("\n\n");

  // camera on
  useEffect(() => {
    let active: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        active = s;
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError("Camera or microphone permission was blocked. Allow access and reload."));
    return () => {
      cancelled = true;
      active?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  // teleprompter auto-scroll
  useEffect(() => {
    if (!scrolling) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const el = promptRef.current;
      if (el) el.scrollTop += ((t - last) / 16.7) * speed * 0.5;
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scrolling, speed]);

  // timer
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  function start() {
    if (!stream) return;
    setResult(null);
    const mimeType = pickMime();
    const rec = new MediaRecorder(stream, {
      mimeType: mimeType || undefined,
      videoBitsPerSecond: 10_000_000,
      audioBitsPerSecond: 192_000,
    });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const type = rec.mimeType || mimeType || "video/webm";
      const blob = new Blob(chunks, { type });
      setResult({ blob, url: URL.createObjectURL(blob), ext: type.includes("mp4") ? "mp4" : "webm" });
    };
    rec.start(1000);
    recRef.current = rec;
    setElapsed(0);
    if (promptRef.current) promptRef.current.scrollTop = 0;
    setRecording(true);
    setScrolling(true);
  }

  function stop() {
    recRef.current?.stop();
    setRecording(false);
    setScrolling(false);
  }

  async function save() {
    if (!result) return;
    const name = `${safeName(deck.title)}-recording.${result.ext}`;
    const file = new File([result.blob], name, { type: result.blob.type });
    // On phones, the share sheet lets you "Save Video" straight to the Photos / Gallery app.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: deck.title });
        return;
      } catch {
        /* user cancelled share — fall back to download */
      }
    }
    downloadBlob(result.blob, name);
  }

  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white">
      <div className="relative flex-1 overflow-hidden">
        {result ? (
          <video src={result.url} controls playsInline className="h-full w-full object-contain" />
        ) : (
          <video ref={videoRef} autoPlay muted playsInline
            className={`h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`} />
        )}

        {!result && (
          <div ref={promptRef}
            className="absolute inset-x-0 top-0 h-[45%] overflow-y-auto bg-gradient-to-b from-black/80 via-black/60 to-transparent px-5 pt-4 pb-24 whitespace-pre-wrap"
            style={{ fontSize, lineHeight: 1.45 }}
            onClick={() => setScrolling((s) => !s)}>
            {script}
            <div className="h-[40vh]" />
          </div>
        )}

        {recording && (
          <span className="absolute top-3 right-3 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-sm font-bold">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> REC {mm}
          </span>
        )}
        {error && <p className="absolute inset-x-4 bottom-4 rounded bg-red-600/80 p-3 text-sm">{error}</p>}
      </div>

      <div className="space-y-3 bg-slate-950 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {!result && (
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <label className="flex flex-1 items-center gap-2">
              Speed
              <input type="range" min={0.4} max={4} step={0.1} value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))} className="flex-1 accent-sky-400" />
            </label>
            <label className="flex flex-1 items-center gap-2">
              Text
              <input type="range" min={18} max={44} value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))} className="flex-1 accent-sky-400" />
            </label>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <button className="btn-ghost" onClick={onExit} disabled={recording}>✕</button>
          {result ? (
            <>
              <button className="btn-ghost" onClick={() => setResult(null)}>↺ Retake</button>
              <button className="btn-primary flex-1" onClick={save}>⬇ Save video</button>
            </>
          ) : recording ? (
            <button onClick={stop} className="mx-auto h-16 w-16 rounded-full border-4 border-white bg-red-600" aria-label="Stop">
              <span className="mx-auto block h-6 w-6 rounded bg-white" />
            </button>
          ) : (
            <button onClick={start} disabled={!stream}
              className="mx-auto h-16 w-16 rounded-full border-4 border-white bg-red-600 disabled:opacity-40" aria-label="Record" />
          )}
          {!result && (
            <button className="btn-ghost" disabled={recording}
              onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}>⟲</button>
          )}
        </div>
        {!result && !recording && (
          <p className="text-center text-xs text-slate-400">
            Your speech scrolls at the top. Tap it to pause/resume. Hold the phone at eye level, close to the camera lens.
          </p>
        )}
      </div>
    </div>
  );
}
