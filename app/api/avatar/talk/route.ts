import { didConfigured, didFetch } from "@/lib/did";
import { isValidVoiceId, speak } from "@/lib/eleven";
import { VOICES } from "@/lib/types";

export const maxDuration = 60;

// Starts rendering a talking-head video of the uploaded photo saying `text`.
// With `clonedVoiceId`, the speech is generated in the presenter's own cloned voice.
export async function POST(request: Request) {
  if (!didConfigured()) {
    return Response.json({ error: "DID_API_KEY not set", fallback: true }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  const sourceUrl = String(body?.sourceUrl ?? "");
  const text = String(body?.text ?? "").trim().slice(0, 3000);
  const voice = String(body?.voice ?? "");
  const clonedVoiceId = String(body?.clonedVoiceId ?? "");
  if (!sourceUrl || !text) {
    return Response.json({ error: "Missing photo or script." }, { status: 400 });
  }

  try {
    let script: Record<string, unknown>;
    if (clonedVoiceId) {
      if (!isValidVoiceId(clonedVoiceId)) throw new Error("Invalid voice id.");
      // 1) speak the script in the presenter's own voice, 2) hand the audio to D-ID for lip-sync
      const audio = await (await speak(clonedVoiceId, text)).blob();
      const form = new FormData();
      form.append("audio", new File([audio], "speech.mp3", { type: "audio/mpeg" }));
      const uploaded = await didFetch("/audios", { method: "POST", body: form });
      script = { type: "audio", audio_url: uploaded.url };
    } else {
      const voiceId = voice in VOICES ? voice : "en-US-JennyNeural";
      script = { type: "text", input: text, provider: { type: "microsoft", voice_id: voiceId } };
    }

    const data = await didFetch("/talks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source_url: sourceUrl,
        script,
        config: { stitch: true, result_format: "mp4" },
      }),
    });
    return Response.json({ id: data.id });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
