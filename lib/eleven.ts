const EL_BASE = "https://api.elevenlabs.io/v1";

export function elevenConfigured() {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

function key() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("Server is missing ELEVENLABS_API_KEY.");
  return k;
}

async function errorMessage(res: Response) {
  const data = await res.json().catch(() => ({}));
  const d = data?.detail;
  return (typeof d === "string" ? d : d?.message) || `Voice service error (${res.status})`;
}

/** Creates an instant voice clone from one or more audio samples. */
export async function cloneVoice(name: string, files: File[]) {
  const form = new FormData();
  form.append("name", name);
  form.append("description", "Presenter's own voice, recorded with consent in Live Presentation Studio");
  form.append("remove_background_noise", "true");
  for (const f of files) form.append("files", f, f.name || "sample.wav");
  const res = await fetch(`${EL_BASE}/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": key() },
    body: form,
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  const data = await res.json();
  return data.voice_id as string;
}

/** Speaks `text` in the given voice and returns an MP3 response. */
export async function speak(voiceId: string, text: string) {
  const res = await fetch(
    `${EL_BASE}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key(), "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true },
      }),
    },
  );
  if (!res.ok || !res.body) throw new Error(await errorMessage(res));
  return res;
}

export function isValidVoiceId(id: string) {
  return /^[A-Za-z0-9]{10,40}$/.test(id);
}
