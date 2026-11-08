"use client";

import { useState } from "react";

function zoomUrl(input: string, passcode: string) {
  const v = input.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v; // full invite link
  const id = v.replace(/\D/g, "");
  if (id.length < 9) return "";
  return `https://zoom.us/j/${id}${passcode.trim() ? `?pwd=${encodeURIComponent(passcode.trim())}` : ""}`;
}

function open(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * One-click launchers for Zoom and WhatsApp. Calls run in the official Zoom / WhatsApp apps;
 * present by sharing this window's screen.
 */
export default function CallsPanel({ title }: { title?: string }) {
  const [meeting, setMeeting] = useState("");
  const [passcode, setPasscode] = useState("");
  const [phone, setPhone] = useState("");
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const message = title?.trim()
    ? `Hi! Here is my presentation "${title.trim()}".`
    : "Hi! I'm ready for our call.";

  const joinUrl = zoomUrl(meeting, passcode);
  const waNumber = phone.replace(/\D/g, "");
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(`${message}\n${appUrl}`)}`;

  return (
    <section className="card">
      <div className="mb-5 flex flex-col items-center gap-1 text-center">
        <h2 className="text-lg font-semibold">📞 Calls &amp; interviews</h2>
        <p className="text-sm text-slate-400">
          Join a Zoom call or message on WhatsApp in one click. To present, use <b>Share screen</b> in the call and
          pick this window.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Zoom */}
        <div className="space-y-3 rounded-2xl border border-[#2D8CFF]/40 bg-[#2D8CFF]/10 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2D8CFF] text-lg font-black text-white">Z</span>
            <h3 className="font-semibold">Zoom</h3>
          </div>
          <input className="input" value={meeting} onChange={(e) => setMeeting(e.target.value)}
            placeholder="Meeting link or ID, e.g. 845 1234 5678" inputMode="text" />
          <input className="input" value={passcode} onChange={(e) => setPasscode(e.target.value)}
            placeholder="Passcode (if any)" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="rounded-xl bg-[#2D8CFF] px-3 py-2.5 font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
              disabled={!joinUrl} onClick={() => open(joinUrl)}>
              Join meeting
            </button>
            <button type="button" className="btn-ghost" onClick={() => open("https://zoom.us/start/videomeeting")}>
              New meeting
            </button>
          </div>
        </div>

        {/* WhatsApp */}
        <div className="space-y-3 rounded-2xl border border-[#25D366]/40 bg-[#25D366]/10 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#25D366] text-lg text-white">✆</span>
            <h3 className="font-semibold">WhatsApp</h3>
          </div>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone with country code, e.g. +94 77 123 4567" inputMode="tel" />
          <p className="text-xs text-slate-400">
            Opens the chat with a message ready to send. Tap the 📞 or 🎥 icon in WhatsApp to call.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="rounded-xl bg-[#25D366] px-3 py-2.5 font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-40"
              disabled={waNumber.length < 8} onClick={() => open(waUrl)}>
              Open chat
            </button>
            <button type="button" className="btn-ghost"
              onClick={() => open(`https://wa.me/?text=${encodeURIComponent(`${message}\n${appUrl}`)}`)}>
              Share link
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
