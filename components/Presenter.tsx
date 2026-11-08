"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Deck, SlideVideo, VoiceId } from "@/lib/types";
import { FEMALE_VOICES } from "@/lib/types";

export default function Presenter({
  deck,
  videos,
  photo,
  voice,
  live,
  onExit,
}: {
  deck: Deck;
  videos: SlideVideo[];
  photo: string;
  voice: VoiceId;
  live: boolean;
  onExit: () => void;
}) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const total = deck.slides.length;
  const slide = deck.slides[i];
  const vid = videos[i]?.status === "done" ? videos[i]?.url : undefined;

  const go = useCallback((n: number) => setI(Math.max(0, Math.min(total - 1, n))), [total]);

  const advance = useCallback(() => {
    if (i < total - 1) setTimeout(() => setI((x) => x + 1), 700);
    else setPlaying(false);
  }, [i, total]);

  // Play the current slide's narration whenever slide or play state changes.
  useEffect(() => {
    if (!live) return;
    speechSynthesis.cancel();
    const v = videoRef.current;
    if (!playing) {
      v?.pause();
      return;
    }
    if (vid && v) {
      v.currentTime = 0;
      v.play().catch(() => setPlaying(false));
      return;
    }
    // Fallback: browser voice-over over the still photo.
    const u = new SpeechSynthesisUtterance(slide.script);
    const lang = voice.slice(0, 5);
    const female = FEMALE_VOICES.includes(voice);
    const voices = speechSynthesis.getVoices().filter((x) => x.lang.replace("_", "-").startsWith(lang));
    u.voice =
      voices.find((x) => (female ? /female|zira|jenny|aria|samantha|sonia/i : /male|david|guy|daniel|ryan/i).test(x.name)) ??
      voices[0] ?? null;
    u.onstart = () => setSpeaking(true);
    u.onend = () => {
      setSpeaking(false);
      advance();
    };
    speechSynthesis.speak(u);
    return () => {
      u.onend = null;
      speechSynthesis.cancel();
      setSpeaking(false);
    };
  }, [i, playing, vid, live, slide.script, voice, advance]);

  useEffect(() => () => speechSynthesis.cancel(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") go(i + 1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") go(i - 1);
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key.toLowerCase() === "f") toggleFs();
      else if (e.key === "Escape" && !document.fullscreenElement) onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go, onExit]);

  function toggleFs() {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  }

  return (
    <div ref={rootRef} className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-black p-2 sm:p-4">
      <div className="relative aspect-video w-full max-w-[min(100%,calc((100dvh-6rem)*16/9))] overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-blue-900 text-slate-50 shadow-2xl"
        style={{ containerType: "inline-size" }}>
        <div className="absolute inset-0 p-[5.7cqw] pr-[36cqw]">
          <div className="mb-[2cqw] h-[0.5cqw] w-[6cqw] bg-sky-400" />
          <h2 className="text-[4.4cqw] leading-tight font-bold">
            {slide.emoji} {slide.title}
          </h2>
          <ul className="mt-[2.5cqw] space-y-[1.4cqw] text-[2.4cqw] text-slate-300">
            {slide.bullets.filter(Boolean).map((b, k) => (
              <li key={k} className="flex gap-[1.2cqw]">
                <span className="mt-[1cqw] h-[1cqw] w-[1cqw] shrink-0 rounded-full bg-sky-400" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {live && (vid || photo) && (
          <div className="absolute top-[7.8cqw] right-[4.7cqw] aspect-[13/16] w-[27cqw] overflow-hidden rounded-[1.9cqw] border-[0.3cqw] border-sky-400/80 bg-black">
            {vid ? (
              <video ref={videoRef} key={vid} src={vid} playsInline className="h-full w-full object-cover"
                onEnded={advance} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="Presenter"
                className={`h-full w-full object-cover ${speaking ? "animate-[talk_3s_ease-in-out_infinite]" : ""}`} />
            )}
            {!vid && (
              <span className="absolute bottom-[1cqw] left-[1cqw] rounded bg-black/60 px-[0.8cqw] text-[1.1cqw] text-slate-300">
                voice-over preview
              </span>
            )}
          </div>
        )}

        <div className="absolute right-[5.7cqw] bottom-[3cqw] left-[5.7cqw] flex justify-between text-[1.6cqw] text-slate-50/55">
          <span>{deck.title}</span>
          <span>{i + 1} / {total}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <button className="btn-ghost" onClick={onExit}>✕ Exit</button>
        <button className="btn-ghost" onClick={() => go(i - 1)} disabled={i === 0}>◀ Prev</button>
        {live && (
          <button className="btn-primary min-w-28" onClick={() => setPlaying((p) => !p)}>
            {playing ? "❚❚ Pause" : "▶ Play"}
          </button>
        )}
        <button className="btn-ghost" onClick={() => go(i + 1)} disabled={i === total - 1}>Next ▶</button>
        <button className="btn-ghost" onClick={toggleFs}>⛶ Fullscreen</button>
      </div>
      {!live && (
        <details className="w-full max-w-3xl text-sm text-slate-300">
          <summary className="cursor-pointer text-slate-400">Speaker notes</summary>
          <p className="mt-2 whitespace-pre-wrap">{slide.script}</p>
        </details>
      )}
    </div>
  );
}
