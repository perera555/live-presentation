const DID_BASE = "https://api.d-id.com";

export function didConfigured() {
  return Boolean(process.env.DID_API_KEY);
}

export async function didFetch(path: string, init: RequestInit = {}) {
  const key = process.env.DID_API_KEY;
  if (!key) throw new Error("Server is missing DID_API_KEY.");
  const res = await fetch(`${DID_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${key}`,
      accept: "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data?.description || data?.message || data?.kind || `D-ID request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

/** Only allow proxying video files that D-ID produced. */
export function isAllowedVideoUrl(raw: string) {
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      (url.hostname.endsWith(".d-id.com") || url.hostname.endsWith(".amazonaws.com"))
    );
  } catch {
    return false;
  }
}
