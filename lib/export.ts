"use client";

import type { Deck, SlideVideo } from "./types";
import { drawPresenter, drawSlide } from "./render";

export function proxyUrl(url: string, name?: string) {
  const q = new URLSearchParams({ url });
  if (name) q.set("name", name);
  return `/api/avatar/proxy?${q}`;
}

function pickMime() {
  const candidates = [
    "video/mp4;codecs=avc1.640028,mp4a.40.2",
    "video/mp4;codecs=avc1,mp4a",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

/**
 * Plays every slide's presenter video in real time, composites it with the
 * slide at 1920x1080 and records the result (MP4 where the browser supports it).
 */
export async function exportFullVideo(
  deck: Deck,
  videos: SlideVideo[],
  onProgress: (slide: number) => void,
): Promise<{ blob: Blob; ext: string }> {
  const W = 1920;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.preload = "auto";

  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  audioCtx.createMediaElementSource(video).connect(dest);

  const stream = canvas.captureStream(30);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

  const mimeType = pickMime();
  const recorder = new MediaRecorder(stream, {
    mimeType: mimeType || undefined,
    videoBitsPerSecond: 12_000_000,
    audioBitsPerSecond: 192_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (recorder.onstop = () => r()));

  let raf = 0;
  let current = 0;
  const loop = () => {
    drawSlide(ctx, deck.slides[current], current, deck.slides.length, deck.title, W, H);
    if (video.readyState >= 2) drawPresenter(ctx, video, W, H);
    raf = requestAnimationFrame(loop);
  };

  await audioCtx.resume();
  recorder.start(1000);
  loop();

  for (let i = 0; i < deck.slides.length; i++) {
    current = i;
    onProgress(i);
    const v = videos[i];
    if (v?.url) {
      video.src = proxyUrl(v.url);
      await new Promise<void>((res, rej) => {
        video.oncanplay = () => res();
        video.onerror = () => rej(new Error(`Slide ${i + 1} video failed to load (it may have expired — regenerate it).`));
      });
      await video.play();
      await new Promise<void>((res) => (video.onended = () => res()));
      await new Promise((r) => setTimeout(r, 600));
    } else {
      await new Promise((r) => setTimeout(r, 4000));
    }
  }

  cancelAnimationFrame(raf);
  recorder.stop();
  await stopped;
  await audioCtx.close();
  const type = recorder.mimeType || mimeType || "video/webm";
  return { blob: new Blob(chunks, { type }), ext: type.includes("mp4") ? "mp4" : "webm" };
}

export async function exportPptx(deck: Deck, photo?: string) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = deck.title;

  const cover = pptx.addSlide();
  cover.background = { color: "0F172A" };
  cover.addText(deck.title, { x: 0.7, y: 2.2, w: 9, h: 1.4, fontSize: 44, bold: true, color: "F8FAFC" });
  cover.addText(deck.subtitle, { x: 0.7, y: 3.7, w: 9, h: 0.8, fontSize: 22, color: "38BDF8" });
  if (photo) cover.addImage({ data: photo, x: 10.0, y: 1.5, w: 2.8, h: 3.5, sizing: { type: "cover", w: 2.8, h: 3.5 } });

  deck.slides.forEach((s) => {
    const sl = pptx.addSlide();
    sl.background = { color: "0F172A" };
    sl.addShape(pptx.ShapeType.rect, { x: 0.7, y: 0.6, w: 1, h: 0.08, fill: { color: "38BDF8" } });
    sl.addText(`${s.emoji}  ${s.title}`, { x: 0.7, y: 0.8, w: 11.9, h: 1.1, fontSize: 34, bold: true, color: "F8FAFC" });
    sl.addText(
      s.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
      { x: 0.9, y: 2.1, w: 11.5, h: 4.6, fontSize: 22, color: "CBD5E1", paraSpaceAfter: 12, valign: "top" },
    );
    sl.addNotes(s.script);
  });

  await pptx.writeFile({ fileName: `${safeName(deck.title)}.pptx` });
}

export function safeName(s: string) {
  return s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "presentation";
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** Shrinks the uploaded photo to a JPEG data URL (max 1024px) to keep uploads small. */
export async function resizePhoto(file: File, max = 1024): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.92);
}

export async function dataUrlToFile(dataUrl: string, name: string) {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: blob.type });
}
