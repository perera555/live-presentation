"use client";

import { useEffect, useRef, useState } from "react";
import type { Deck, SlideVideo, VoiceId } from "@/lib/types";
import { FEMALE_VOICES, MALE_VOICES, VOICES } from "@/lib/types";
import {
  dataUrlToFile,
  downloadBlob,
  exportFullVideo,
  exportPptx,
  proxyUrl,
  resizePhoto,
  safeName,
} from "@/lib/export";
import Presenter from "./Presenter";
import VoiceCloner, { READING_PASSAGE, type ClonedVoice } from "./VoiceCloner";

/** Text to read for the voice sample before slides exist: the user's own title + prompt,
 *  topped up with a general passage so there is ~45s+ of speech. */
function promptReadingText(title: string, prompt: string, name: string) {
  const typed = [title.trim(), prompt.trim()].filter(Boolean).join(".\n\n");
  if (!typed) return undefined;
  const words = typed.split(/\s+/).length;
  return words >= 110 ? typed : `${typed}\n\n${READING_PASSAGE.replace("____", name.trim() || "____")}`;
}
import ChatPanel, { type ChatMsg } from "./ChatPanel";
import Recorder from "./Recorder";
import InstallButton from "./InstallButton";
import FaceVoiceCapture from "./FaceVoiceCapture";
import CallsPanel from "./CallsPanel";

type Step = "form" | "edit" | "present" | "record";
const STORE_KEY = "lp-state-v1";

export default function Studio() {
  const [step, setStep] = useState<Step>("form");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [presenterName, setPresenterName] = useState("");
  const [slideCount, setSlideCount] = useState(6);
  const [voice, setVoice] = useState<VoiceId>("en-US-JennyNeural");
  const [photo, setPhoto] = useState<string>("");
  const [deck, setDeck] = useState<Deck | null>(null);
  const [videos, setVideos] = useState<SlideVideo[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [liveMode, setLiveMode] = useState(true);
  const [clonedVoice, setClonedVoice] = useState<ClonedVoice | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const photoUrlRef = useRef<string>("");
  const goLiveWhenReady = useRef(false);

  // restore last session
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      /* eslint-disable react-hooks/set-state-in-effect */
      if (s.deck) {
        setDeck(s.deck);
        setVideos(s.videos ?? []);
        setStep("edit");
      }
      setTitle(s.title ?? "");
      setPrompt(s.prompt ?? "");
      setPresenterName(s.presenterName ?? "");
      if (s.voice in VOICES) setVoice(s.voice);
      if (s.photo) setPhoto(s.photo);
      if (s.clonedVoice?.id) setClonedVoice(s.clonedVoice);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ title, prompt, presenterName, voice, photo, deck, videos, clonedVoice }),
      );
    } catch {}
  }, [title, prompt, presenterName, voice, photo, deck, videos, clonedVoice]);

  function changeClonedVoice(v: ClonedVoice | null) {
    setClonedVoice(v);
    setVideos([]); // existing videos were spoken in the old voice
  }

  async function onPhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Please choose an image file.");
    setPhoto(await resizePhoto(file));
    photoUrlRef.current = "";
    setVideos([]);
  }

  async function generateDeck(goLive = false) {
    setError("");
    setBusy("Writing your slides and speech…");
    let made: Deck | null = null;
    try {
      const res = await fetch("/api/slides", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, prompt, slideCount, presenterName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate slides");
      made = data as Deck;
      setDeck(made);
      setVideos([]);
      setChat([]);
      setStep("edit");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
    if (made && goLive) await generateVideos(undefined, made, []);
  }

  /** Applies a deck from the AI chat; slides whose speech changed need a new video. */
  function applyChatDeck(next: Deck) {
    const prev = deck;
    setDeck(next);
    setVideos((v) =>
      next.slides.map((s, i) =>
        prev?.slides[i]?.script === s.script && v[i] ? v[i] : { status: "idle" },
      ),
    );
  }

  function updateSlide(i: number, patch: Partial<Deck["slides"][number]>) {
    if (!deck) return;
    const slides = deck.slides.map((s, j) => (j === i ? { ...s, ...patch } : s));
    setDeck({ ...deck, slides });
    if (patch.script !== undefined) {
      setVideos((v) => v.map((x, j) => (j === i ? { status: "idle" } : x)));
    }
  }

  async function ensurePhotoUploaded() {
    if (photoUrlRef.current) return photoUrlRef.current;
    const fd = new FormData();
    fd.append("image", await dataUrlToFile(photo, "presenter.jpg"));
    const res = await fetch("/api/avatar/image", { method: "POST", body: fd });
    const data = await res.json();
    if (res.status === 503 && data.fallback) {
      throw new Error(
        "Talking-video service is not configured (DID_API_KEY missing). You can still present with the voice-over preview.",
      );
    }
    if (!res.ok) throw new Error(data.error || "Photo upload failed");
    photoUrlRef.current = data.url;
    return data.url as string;
  }

  async function renderSlideVideo(i: number, sourceUrl: string, d: Deck) {
    const set = (v: SlideVideo) => setVideos((all) => {
      const next = [...all];
      next[i] = v;
      return next;
    });
    set({ status: "working" });
    try {
      const res = await fetch("/api/avatar/talk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceUrl,
          text: d.slides[i].script,
          voice,
          clonedVoiceId: clonedVoice?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Video request failed");
      for (let tries = 0; tries < 120; tries++) {
        await new Promise((r) => setTimeout(r, 3000));
        const st = await (await fetch(`/api/avatar/talk/${data.id}`)).json();
        if (st.status === "done" && st.url) return set({ status: "done", talkId: data.id, url: st.url });
        if (st.status === "error" || st.status === "rejected" || st.error)
          throw new Error(st.error || "Video rendering failed");
      }
      throw new Error("Timed out waiting for the video");
    } catch (e) {
      set({ status: "error", error: (e as Error).message });
    }
  }

  async function generateVideos(only?: number, d: Deck | null = deck, current: SlideVideo[] = videos) {
    if (!d || !photo) return setError("Upload your photo first.");
    setError("");
    setBusy("Creating your talking presenter video…");
    goLiveWhenReady.current = only === undefined;
    try {
      const src = await ensurePhotoUploaded();
      const todo = only !== undefined
        ? [only]
        : d.slides.map((_, i) => i).filter((i) => current[i]?.status !== "done");
      // render up to 3 slides at a time
      const queue = [...todo];
      await Promise.all(
        Array.from({ length: Math.min(3, queue.length) }, async () => {
          while (queue.length) await renderSlideVideo(queue.shift()!, src, d);
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function downloadFullVideo() {
    if (!deck) return;
    setError("");
    try {
      const { blob, ext } = await exportFullVideo(deck, videos, (i) =>
        setBusy(`Recording full video — slide ${i + 1} of ${deck.slides.length} (plays in real time, keep this tab open)…`),
      );
      downloadBlob(blob, `${safeName(deck.title)}.${ext}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function reset() {
    setDeck(null);
    setVideos([]);
    setChat([]);
    setStep("form");
  }

  const allDone = deck && deck.slides.every((_, i) => videos[i]?.status === "done");
  const anyWorking = videos.some((v) => v?.status === "working");

  // When the whole set of videos finishes rendering, go straight to the live presentation.
  useEffect(() => {
    if (allDone && goLiveWhenReady.current) {
      goLiveWhenReady.current = false;
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setLiveMode(true);
      setStep("present");
    }
  }, [allDone]);

  if (step === "record" && deck) {
    return <Recorder deck={deck} onExit={() => setStep("edit")} />;
  }

  if (step === "present" && deck) {
    return (
      <Presenter
        deck={deck}
        videos={videos}
        photo={photo}
        voice={voice}
        clonedVoiceId={clonedVoice?.id}
        live={liveMode}
        onExit={() => setStep("edit")}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex flex-col items-center gap-4 text-center">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192" alt="" className="h-12 w-12 rounded-xl shadow-lg shadow-indigo-500/30" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              <span className="brand">Live Presentation</span> Studio
            </h1>
            <p className="text-sm text-slate-400">Your topic, your face, your voice: presented for you.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {step === "edit" && (
            <button onClick={reset} className="btn-ghost whitespace-nowrap">New</button>
          )}
          <InstallButton />
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {busy && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" />
          {busy}
        </div>
      )}

      {step === "form" && (
        <section className="space-y-6">
          {/* Top row: your voice (left) + your face and voice (right) */}
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <VoiceCloner cloned={clonedVoice} onCloned={changeClonedVoice} onRemove={() => changeClonedVoice(null)}
              defaultName={presenterName} readingText={promptReadingText(title, prompt, presenterName)} />
            <PhotoAndVoice wide photo={photo} voice={voice} setVoice={setVoice} onPhoto={onPhoto}
              clonedVoice={clonedVoice} setClonedVoice={changeClonedVoice} name={presenterName}
              readingText={promptReadingText(title, prompt, presenterName)} />
          </div>

          <div className="card space-y-4">
            <StepHeading n={2} title="Describe your presentation" />
            <label className="block">
              <span className="label">Presentation title *</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. The Impact of Renewable Energy on Developing Countries" />
            </label>
            <label className="block">
              <span className="label">What should it cover? (prompt)</span>
              <textarea className="input min-h-32" value={prompt} onChange={(e) => setPrompt(e.target.value)}
                placeholder="Audience, key points, module name, tone, examples to include, time limit…" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">Your name (optional)</span>
                <input className="input" value={presenterName} onChange={(e) => setPresenterName(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">Number of slides: {slideCount}</span>
                <input type="range" min={3} max={15} value={slideCount}
                  onChange={(e) => setSlideCount(Number(e.target.value))} className="mt-3 w-full accent-sky-400" />
              </label>
            </div>
          </div>

          <div className="card space-y-3 text-center">
            <StepHeading n={3} title="Go live" center />
            <div className="mx-auto grid max-w-lg gap-2 sm:grid-cols-2">
              <button disabled={!title.trim() || !photo || !!busy} onClick={() => generateDeck(true)}
                className="btn-primary py-3 text-base" title={photo ? "" : "Upload your photo first"}>
                🔴 Create &amp; go live
              </button>
              <button disabled={!title.trim() || !!busy} onClick={() => generateDeck(false)}
                className="btn-secondary py-3 text-base">
                Create &amp; edit first
              </button>
            </div>
            <p className="mx-auto max-w-lg text-xs text-slate-400">
              {!title.trim()
                ? "Add a presentation title above to start."
                : !photo
                  ? "Add your photo (step 1, at the top) to create the talking video."
                  : "Writes the slides, makes your talking video and opens the live presentation automatically."}
            </p>
          </div>

          <CallsPanel title={title} />
        </section>
      )}

      {step === "edit" && deck && (
        <section className="space-y-6">
          <div className="grid gap-6 md:grid-cols-[1fr_280px]">
            <div className="card space-y-4">
              <div>
                <h2 className="text-xl font-semibold">{deck.title}</h2>
                <p className="text-sm text-slate-400">{deck.subtitle}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => generateVideos()} disabled={!photo || !!busy || anyWorking} className="btn-primary">
                  {allDone ? "All videos ready ✓" : "Generate video & go live"}
                </button>
                <button onClick={() => { setLiveMode(true); setStep("present"); }} className="btn-secondary">
                  🔴 Live presentation
                </button>
                <button onClick={() => { setLiveMode(false); setStep("present"); }} className="btn-secondary">
                  Slides only
                </button>
                <button onClick={() => setStep("record")} className="btn-secondary">
                  📱 Record myself (teleprompter)
                </button>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
                <button onClick={downloadFullVideo} disabled={!allDone || !!busy} className="btn-ghost"
                  title={allDone ? "" : "Generate the talking video first"}>
                  ⬇ Download full video (1080p)
                </button>
                <button onClick={() => exportPptx(deck, photo || undefined)} className="btn-ghost">
                  ⬇ PowerPoint (.pptx)
                </button>
              </div>
            </div>
            <PhotoAndVoice photo={photo} voice={voice} setVoice={(v) => { setVoice(v); setVideos([]); }} onPhoto={onPhoto}
              clonedVoice={clonedVoice} setClonedVoice={changeClonedVoice} name={presenterName}
              readingText={deck.slides.map((s) => s.script).join("\n\n")} />
          </div>

          <VoiceCloner cloned={clonedVoice} onCloned={changeClonedVoice} onRemove={() => changeClonedVoice(null)}
            defaultName={presenterName} readingText={deck.slides.map((s) => s.script).join("\n\n")} />

          <ChatPanel deck={deck} messages={chat} setMessages={setChat} onDeck={applyChatDeck} />

          <CallsPanel title={deck.title} />

          <ol className="space-y-4">
            {deck.slides.map((s, i) => {
              const v = videos[i];
              return (
                <li key={i} className="card grid gap-4 md:grid-cols-[1fr_220px]">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-sky-500/20 px-2 py-0.5 text-xs text-sky-200">Slide {i + 1}</span>
                      <input className="input flex-1 font-semibold" value={s.title}
                        onChange={(e) => updateSlide(i, { title: e.target.value })} />
                    </div>
                    <textarea className="input min-h-24 text-sm" value={s.bullets.join("\n")}
                      onChange={(e) => updateSlide(i, { bullets: e.target.value.split("\n") })} />
                    <label className="block">
                      <span className="label">Speech for this slide</span>
                      <textarea className="input min-h-28 text-sm" value={s.script}
                        onChange={(e) => updateSlide(i, { script: e.target.value })} />
                    </label>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="aspect-[4/5] overflow-hidden rounded-lg bg-black/40">
                      {v?.status === "done" && v.url ? (
                        <video src={v.url} controls playsInline className="h-full w-full object-cover" />
                      ) : photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" className="h-full w-full object-cover opacity-60" />
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-400">
                      {v?.status === "working" && "Rendering…"}
                      {v?.status === "error" && <span className="text-red-300">{v.error}</span>}
                      {(!v || v.status === "idle") && "No video yet"}
                      {v?.status === "done" && "Video ready"}
                    </p>
                    <div className="flex gap-2">
                      <button className="btn-ghost flex-1 text-xs" disabled={!photo || v?.status === "working" || !!busy}
                        onClick={() => generateVideos(i)}>
                        {v?.status === "done" ? "Regenerate" : "Generate"}
                      </button>
                      {v?.status === "done" && v.url && (
                        <a className="btn-ghost flex-1 text-center text-xs"
                          href={proxyUrl(v.url, `${safeName(deck.title)}-slide-${i + 1}.mp4`)}>
                          MP4
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </main>
  );
}

function PhotoAndVoice({
  photo,
  voice,
  setVoice,
  onPhoto,
  clonedVoice,
  setClonedVoice,
  name,
  readingText,
  wide = false,
}: {
  photo: string;
  voice: VoiceId;
  setVoice: (v: VoiceId) => void;
  onPhoto: (f?: File) => void;
  clonedVoice: ClonedVoice | null;
  setClonedVoice: (v: ClonedVoice | null) => void;
  name: string;
  readingText?: string;
  /** Two-column layout for the centered home page. */
  wide?: boolean;
}) {
  const [capture, setCapture] = useState(false);
  return (
    <aside className={`card ${wide ? "space-y-5" : "space-y-4"}`}>
      {wide && <StepHeading n={1} title="Add your face and voice" />}
      <div className={wide ? "mx-auto max-w-md" : ""}>
        <button type="button" className="btn-primary w-full py-3" onClick={() => setCapture(true)}>
          🎥 Quick setup: record a short video
        </button>
        <p className="mt-1.5 text-center text-xs text-slate-400">Takes your photo and your voice in one go</p>
      </div>
      {capture && (
        <FaceVoiceCapture
          name={name}
          readingText={readingText}
          onPhoto={async (dataUrl) => onPhoto(await dataUrlToFile(dataUrl, "camera.jpg"))}
          onVoice={setClonedVoice}
          onClose={() => setCapture(false)}
        />
      )}
      <div className={wide ? "grid items-start gap-6 border-t border-white/10 pt-5 sm:grid-cols-2" : "space-y-4"}>
      <div className="space-y-3">
      <span className="label">Or add your photo</span>
      <label className={`relative mx-auto flex aspect-4/5 w-full cursor-pointer ${wide ? "max-w-56" : "max-w-56 md:max-w-none"} items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-white/20 bg-black/30 hover:border-sky-400`}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Presenter" className="h-full w-full object-cover" />
        ) : (
          <span className="px-4 text-center text-sm text-slate-400">
            Tap to upload a clear, front-facing photo of yourself
          </span>
        )}
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
      </label>
      <label className="btn-ghost block cursor-pointer text-center text-sm">
        📷 Take photo with camera
        <input type="file" accept="image/*" capture="user" className="sr-only"
          onChange={(e) => onPhoto(e.target.files?.[0])} />
      </label>
      <p className="text-center text-xs text-slate-400">
        Best results: face centred, looking at the camera, good light, neutral background, mouth closed.
      </p>
      </div>
      <div className={clonedVoice ? "pointer-events-none opacity-40" : ""}>
        <span className="label">{clonedVoice ? "Ready-made voice (not used)" : "Or choose a ready-made voice"}</span>
        <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-black/30 p-1">
          {([["Female", FEMALE_VOICES], ["Male", MALE_VOICES]] as const).map(([label, list]) => {
            const active = list.includes(voice);
            return (
              <button key={label} type="button" onClick={() => !active && setVoice(list[0])}
                className={`rounded-md py-1.5 text-sm font-medium ${active ? "bg-sky-500 text-slate-950" : "text-slate-300 hover:bg-white/10"}`}>
                {label === "Female" ? "♀ Female" : "♂ Male"}
              </button>
            );
          })}
        </div>
        <select className="input" value={voice} onChange={(e) => setVoice(e.target.value as VoiceId)}
          aria-label="Voice accent">
          {(FEMALE_VOICES.includes(voice) ? FEMALE_VOICES : MALE_VOICES).map((id) => (
            <option key={id} value={id}>{VOICES[id]}</option>
          ))}
        </select>
        {wide && (
          <p className="mt-3 text-xs text-slate-400">
            Prefer your <b>own voice</b>? Record it in the &ldquo;Use my own voice&rdquo; section.
          </p>
        )}
      </div>
      </div>
    </aside>
  );
}

function StepHeading({ n, title, center = false }: { n: number; title: string; center?: boolean }) {
  return (
    <h2 className={`flex items-center gap-3 text-lg font-semibold ${center ? "justify-center" : ""}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-fuchsia-400 text-sm font-bold text-slate-950">
        {n}
      </span>
      {title}
    </h2>
  );
}
