"use client";

/** Max seconds of voice sample to send (keeps upload under ~3.5 MB as 22 kHz mono WAV). */
export const MAX_SAMPLE_SECONDS = 80;

/**
 * Decodes any browser-supported audio (webm/opus, mp4/aac, mp3, wav, m4a…)
 * and re-encodes it as 22.05 kHz mono 16-bit WAV.
 */
export async function toWav(blob: Blob, rate = 22050): Promise<File> {
  const ac = new AudioContext();
  const decoded = await ac.decodeAudioData(await blob.arrayBuffer());
  await ac.close();
  const seconds = Math.min(decoded.duration, MAX_SAMPLE_SECONDS);
  const off = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  const pcm = rendered.getChannelData(0);

  // normalise quiet recordings
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
  const gain = peak > 0 && peak < 0.5 ? 0.9 / peak : 1;

  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i] * gain));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new File([buf], "voice-sample.wav", { type: "audio/wav" });
}

export async function speakCloned(voiceId: string, text: string): Promise<HTMLAudioElement> {
  const res = await fetch("/api/voice/speak", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ voiceId, text }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not speak in your voice");
  }
  const url = URL.createObjectURL(await res.blob());
  const audio = new Audio(url);
  audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
  return audio;
}
