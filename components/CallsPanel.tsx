"use client";

import { useCallback, useState } from "react";
import ContactBar from "./ContactBar";
import DeviceCheck from "./DeviceCheck";
import ZoomRoom from "./ZoomRoom";

/** Passcode typed in, or taken from a pasted invite link (?pwd=…). */
function passcodeFor(input: string, passcode: string) {
  return passcode.trim() || input.match(/[?&]pwd=([^&]+)/)?.[1] || "";
}

function zoomUrl(input: string, passcode: string) {
  const v = input.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v; // full invite link
  const id = v.replace(/\D/g, "");
  if (id.length < 9) return "";
  return `https://zoom.us/j/${id}${passcode.trim() ? `?pwd=${encodeURIComponent(passcode.trim())}` : ""}`;
}

/** Zoom's web client (runs inside a window, no Zoom install needed). */
function zoomWebUrl(input: string, passcode: string) {
  const v = input.trim();
  const id = (v.match(/\/j\/(\d+)/)?.[1] ?? v).replace(/\D/g, "");
  if (id.length < 9) return "";
  const pwd = passcode.trim() || v.match(/[?&]pwd=([^&]+)/)?.[1] || "";
  return `https://app.zoom.us/wc/join/${id}${pwd ? `?pwd=${encodeURIComponent(pwd)}` : ""}`;
}

function open(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Opens a side window next to the app, so you can multitask (desktop app: a window inside the app). */
function openWindow(url: string, name: string) {
  const w = Math.min(1100, screen.availWidth);
  const h = Math.min(820, screen.availHeight);
  const left = Math.max(0, screen.availWidth - w);
  window.open(url, name, `popup,noopener,width=${w},height=${h},left=${left},top=0`);
}

/**
 * One-click launchers for Zoom and WhatsApp. Calls run in the official Zoom / WhatsApp apps;
 * present by sharing this window's screen.
 */
export default function CallsPanel({ title }: { title?: string }) {
  const [meeting, setMeeting] = useState("");
  const [passcode, setPasscode] = useState("");
  const [phone, setPhone] = useState("");
  const [yourName, setYourName] = useState("");
  const [inCall, setInCall] = useState(false);
  const endCall = useCallback(() => setInCall(false), []);
  const meetingDigits = (meeting.match(/\/j\/(\d+)/)?.[1] ?? meeting).replace(/\D/g, "");
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
          Use your own WhatsApp and Zoom right next to your presentation. Each opens in its own window, so you can
          multitask. To present in a call, use <b>Share screen</b> and pick this window.
        </p>
      </div>

      <ContactBar />

      <div className="mb-6">
        <DeviceCheck />
      </div>

      <div className="grid gap-4">
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
          <input className="input" value={yourName} onChange={(e) => setYourName(e.target.value)}
            placeholder="Your name (shown in the meeting)" />
          {inCall ? (
            <ZoomRoom meetingId={meetingDigits} passcode={passcodeFor(meeting, passcode)} name={yourName}
              onEnd={endCall} />
          ) : (
            <button type="button" className="w-full rounded-xl bg-[#2D8CFF] px-3 py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
              disabled={meetingDigits.length < 9} onClick={() => setInCall(true)}>
              🎥 Join inside this app
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost text-sm" disabled={!joinUrl} onClick={() => open(joinUrl)}>
              Open in Zoom app
            </button>
            <button type="button" className="btn-ghost text-sm" disabled={!zoomWebUrl(meeting, passcode)}
              onClick={() => openWindow(zoomWebUrl(meeting, passcode), "zoom")}>
              Separate window
            </button>
          </div>
        </div>

        {/* WhatsApp */}
        <div className="space-y-3 rounded-2xl border border-[#25D366]/40 bg-[#25D366]/10 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#25D366] text-lg text-white">✆</span>
            <h3 className="font-semibold">WhatsApp</h3>
          </div>
          <button type="button" className="w-full rounded-xl bg-[#25D366] px-3 py-2.5 font-semibold text-slate-950 transition hover:brightness-110"
            onClick={() => openWindow("https://web.whatsapp.com/", "whatsapp")}>
            Open my WhatsApp (here)
          </button>
          <details className="rounded-lg bg-black/20 px-3 py-2 text-xs text-slate-300">
            <summary className="cursor-pointer font-medium text-[#25D366]">How to connect your own WhatsApp</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Click <b>Open my WhatsApp</b>. A QR code appears.</li>
              <li>On your phone: WhatsApp → <b>Settings</b> (or ⋮) → <b>Linked devices</b> → <b>Link a device</b>.</li>
              <li>Scan the QR code. Your chats appear here. In the desktop app you stay signed in.</li>
            </ol>
          </details>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone with country code, e.g. +94 77 123 4567" inputMode="tel" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost text-sm"
              disabled={waNumber.length < 8} onClick={() => openWindow(waUrl, "whatsapp")}>
              Message number
            </button>
            <button type="button" className="btn-ghost text-sm"
              onClick={() => openWindow(`https://wa.me/?text=${encodeURIComponent(`${message}\n${appUrl}`)}`, "whatsapp")}>
              Share link
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
