import type { Slide } from "./types";

export const THEME = {
  bgFrom: "#0f172a",
  bgTo: "#1e3a8a",
  accent: "#38bdf8",
  text: "#f8fafc",
  muted: "#cbd5e1",
};

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws one slide onto a canvas. Leaves the right ~30% free for the presenter video. */
export function drawSlide(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  index: number,
  total: number,
  deckTitle: string,
  w: number,
  h: number,
) {
  const s = w / 1920;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, THEME.bgFrom);
  g.addColorStop(1, THEME.bgTo);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // accent bar
  ctx.fillStyle = THEME.accent;
  ctx.fillRect(110 * s, 120 * s, 120 * s, 10 * s);

  const textWidth = w * 0.6;
  ctx.textBaseline = "top";
  ctx.fillStyle = THEME.text;
  ctx.font = `700 ${84 * s}px system-ui, -apple-system, Segoe UI, sans-serif`;
  let y = 170 * s;
  for (const line of wrap(ctx, `${slide.emoji}  ${slide.title}`, textWidth)) {
    ctx.fillText(line, 110 * s, y);
    y += 100 * s;
  }
  y += 40 * s;

  ctx.font = `400 ${46 * s}px system-ui, -apple-system, Segoe UI, sans-serif`;
  for (const b of slide.bullets) {
    const lines = wrap(ctx, b, textWidth - 60 * s);
    ctx.fillStyle = THEME.accent;
    ctx.beginPath();
    ctx.arc(125 * s, y + 26 * s, 10 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = THEME.muted;
    for (const line of lines) {
      ctx.fillText(line, 165 * s, y);
      y += 60 * s;
    }
    y += 24 * s;
  }

  ctx.fillStyle = "rgba(248,250,252,0.55)";
  ctx.font = `500 ${30 * s}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.fillText(deckTitle, 110 * s, h - 90 * s);
  const pg = `${index + 1} / ${total}`;
  ctx.fillText(pg, w - 110 * s - ctx.measureText(pg).width, h - 90 * s);
}

/** Draws a video/image "cover"-cropped into a rounded rectangle. */
export function drawPresenter(
  ctx: CanvasRenderingContext2D,
  media: HTMLVideoElement | HTMLImageElement,
  w: number,
  h: number,
) {
  const s = w / 1920;
  const bw = 520 * s;
  const bh = 640 * s;
  const x = w - bw - 90 * s;
  const y = 150 * s;
  const mw = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
  const mh = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
  if (!mw || !mh) return;
  const scale = Math.max(bw / mw, bh / mh);
  const sw = bw / scale;
  const sh = bh / scale;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, bw, bh, 36 * s);
  ctx.clip();
  ctx.drawImage(media, (mw - sw) / 2, (mh - sh) / 2, sw, sh, x, y, bw, bh);
  ctx.restore();
  ctx.strokeStyle = "rgba(56,189,248,0.8)";
  ctx.lineWidth = 6 * s;
  ctx.beginPath();
  ctx.roundRect(x, y, bw, bh, 36 * s);
  ctx.stroke();
}
