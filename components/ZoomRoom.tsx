"use client";

import { useEffect, useState } from "react";

/**
 * Zoom meeting embedded inside the app (Zoom Meeting SDK, loaded in /zoom-meeting.html).
 * Your camera and microphone are used by the meeting directly.
 */
export default function ZoomRoom({
  meetingId,
  passcode,
  name,
  onEnd,
}: {
  meetingId: string;
  passcode: string;
  name: string;
  onEnd: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // free the camera/mic so Zoom can use them
    window.dispatchEvent(new Event("lp-release-media"));
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.source !== "lp-zoom") return;
      if (e.data.type === "left") onEnd();
      if (e.data.type === "error") setError(String(e.data.detail || "Zoom error"));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onEnd]);

  const src = `/zoom-meeting.html#${new URLSearchParams({ m: meetingId, p: passcode, n: name || "Guest" })}`;

  return (
    <div className={expanded
      ? "fixed inset-0 z-50 flex flex-col bg-black/90 p-2 backdrop-blur sm:p-4"
      : "space-y-2"}>
      <div className="flex items-center justify-between gap-2 pb-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Zoom meeting · in this app
        </span>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setExpanded((x) => !x)}>
            {expanded ? "⤡ Shrink to panel" : "⤢ Expand"}
          </button>
          <button type="button" className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
            onClick={onEnd}>
            Leave
          </button>
        </div>
      </div>
      <iframe
        title="Zoom meeting"
        src={src}
        allow="camera; microphone; display-capture; fullscreen; autoplay; clipboard-write"
        className={`w-full rounded-xl border border-white/10 bg-[#1a1a1a] ${expanded ? "flex-1" : "aspect-[4/3]"}`}
      />
      {error && <p className="pt-2 text-center text-sm text-red-300">{error}</p>}
    </div>
  );
}
