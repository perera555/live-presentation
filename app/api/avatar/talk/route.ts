import { didConfigured, didFetch } from "@/lib/did";
import { VOICES } from "@/lib/types";

export const maxDuration = 60;

// Starts rendering a talking-head video of the uploaded photo saying `text`.
export async function POST(request: Request) {
  if (!didConfigured()) {
    return Response.json({ error: "DID_API_KEY not set", fallback: true }, { status: 503 });
  }
  const body = await request.json().catch(() => null);
  const sourceUrl = String(body?.sourceUrl ?? "");
  const text = String(body?.text ?? "").trim().slice(0, 3000);
  const voice = String(body?.voice ?? "");
  if (!sourceUrl || !text) {
    return Response.json({ error: "Missing photo or script." }, { status: 400 });
  }
  const voiceId = voice in VOICES ? voice : "en-US-JennyNeural";

  try {
    const data = await didFetch("/talks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source_url: sourceUrl,
        script: {
          type: "text",
          input: text,
          provider: { type: "microsoft", voice_id: voiceId },
        },
        config: { stitch: true, result_format: "mp4" },
      }),
    });
    return Response.json({ id: data.id });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
