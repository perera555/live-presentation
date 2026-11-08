import { createHmac } from "node:crypto";

// Signs a Zoom Meeting SDK join token (JWT, HS256). The SDK secret never leaves the server.
// https://developers.zoom.us/docs/meeting-sdk/auth/
function b64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export async function POST(request: Request) {
  const key = process.env.ZOOM_SDK_KEY;
  const secret = process.env.ZOOM_SDK_SECRET;
  if (!key || !secret) {
    return Response.json(
      { error: "Zoom inside the app isn't set up yet (ZOOM_SDK_KEY / ZOOM_SDK_SECRET missing)." },
      { status: 503 },
    );
  }
  const body = await request.json().catch(() => null);
  const meetingNumber = String(body?.meetingNumber ?? "").replace(/\D/g, "");
  if (meetingNumber.length < 9 || meetingNumber.length > 12) {
    return Response.json({ error: "Enter a valid Zoom meeting ID." }, { status: 400 });
  }

  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2;
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ appKey: key, sdkKey: key, mn: meetingNumber, role: 0, iat, exp, tokenExp: exp }),
  );
  const signature = b64url(createHmac("sha256", secret).update(`${header}.${payload}`).digest());
  return Response.json({ signature: `${header}.${payload}.${signature}` });
}
