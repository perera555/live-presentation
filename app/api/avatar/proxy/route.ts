import { isAllowedVideoUrl } from "@/lib/did";

export const maxDuration = 60;

// Streams a generated D-ID video through our origin so the browser can draw it
// onto a canvas (for MP4 export) and download it with a proper filename.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url") ?? "";
  const name = (searchParams.get("name") ?? "").replace(/[^\w.-]/g, "_");
  if (!isAllowedVideoUrl(url)) {
    return new Response("URL not allowed", { status: 400 });
  }
  const upstream = await fetch(url, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return new Response("Video not available (it may have expired)", { status: 502 });
  }
  const headers = new Headers({
    "content-type": upstream.headers.get("content-type") ?? "video/mp4",
    "cache-control": "private, max-age=3600",
  });
  const len = upstream.headers.get("content-length");
  if (len) headers.set("content-length", len);
  if (name) headers.set("content-disposition", `attachment; filename="${name}"`);
  return new Response(upstream.body, { headers });
}
