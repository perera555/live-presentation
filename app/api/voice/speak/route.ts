import { elevenConfigured, isValidVoiceId, speak } from "@/lib/eleven";

export const maxDuration = 60;

// Text-to-speech in the presenter's cloned voice (used for previews and voice-over mode).
export async function POST(request: Request) {
  if (!elevenConfigured()) {
    return Response.json({ error: "ELEVENLABS_API_KEY missing" }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  const voiceId = String(body?.voiceId ?? "");
  const text = String(body?.text ?? "").trim().slice(0, 3000);
  if (!isValidVoiceId(voiceId) || !text) {
    return Response.json({ error: "Missing voice or text." }, { status: 400 });
  }
  try {
    const upstream = await speak(voiceId, text);
    return new Response(upstream.body, {
      headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=3600" },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
