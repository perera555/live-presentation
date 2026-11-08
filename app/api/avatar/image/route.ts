import { didConfigured, didFetch } from "@/lib/did";

export const maxDuration = 60;

// Uploads the presenter's photo to D-ID and returns a hosted URL for it.
export async function POST(request: Request) {
  if (!didConfigured()) {
    return Response.json({ error: "DID_API_KEY not set", fallback: true }, { status: 503 });
  }
  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File)) {
    return Response.json({ error: "No image uploaded." }, { status: 400 });
  }
  if (file.size > 4 * 1024 * 1024) {
    return Response.json({ error: "Photo must be under 4 MB." }, { status: 413 });
  }
  const upstream = new FormData();
  upstream.append("image", file, file.name || "photo.jpg");
  try {
    const data = await didFetch("/images", { method: "POST", body: upstream });
    return Response.json({ url: data.url });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
