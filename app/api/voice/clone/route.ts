import { cloneVoice, elevenConfigured } from "@/lib/eleven";

export const maxDuration = 60;

// Receives the presenter's recorded voice sample(s) and creates their voice clone.
export async function POST(request: Request) {
  if (!elevenConfigured()) {
    return Response.json(
      { error: "Voice cloning is not set up on this server (ELEVENLABS_API_KEY missing)." },
      { status: 503 },
    );
  }
  const form = await request.formData();
  if (form.get("consent") !== "yes") {
    return Response.json({ error: "Please confirm this is your own voice." }, { status: 400 });
  }
  const name = String(form.get("name") || "My voice").slice(0, 60);
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) {
    return Response.json({ error: "No voice recording received." }, { status: 400 });
  }
  try {
    const voiceId = await cloneVoice(name, files);
    return Response.json({ voiceId });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
