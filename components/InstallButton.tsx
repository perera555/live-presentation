"use client";

import { useEffect, useState } from "react";

const RELEASES = "https://github.com/perera555/live-presentation/releases/latest";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function InstallButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "mac" | "windows" | "android" | "other">("other");

  useEffect(() => {
    const ua = navigator.userAgent;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (/iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1)) setPlatform("ios");
    else if (/Android/.test(ua)) setPlatform("android");
    else if (/Mac/.test(ua)) setPlatform("mac");
    else if (/Win/.test(ua)) setPlatform("windows");
    if (window.matchMedia("(display-mode: standalone)").matches || navigator.userAgent.includes("Electron")) {
      setInstalled(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function installNow() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button className="btn-primary whitespace-nowrap" onClick={() => setOpen((o) => !o)}>
        ⬇ Install app
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] space-y-3 rounded-xl border border-white/15 bg-slate-900 p-4 text-sm shadow-2xl">
          {deferred && (
            <button className="btn-primary w-full" onClick={installNow}>
              Install on this {platform === "android" ? "phone" : "computer"}
            </button>
          )}

          {platform === "ios" && (
            <ol className="list-decimal space-y-1 pl-5 text-slate-300">
              <li>Open this page in <b>Safari</b></li>
              <li>Tap the <b>Share</b> button (square with ↑)</li>
              <li>Tap <b>Add to Home Screen</b> → <b>Add</b></li>
            </ol>
          )}

          {platform === "mac" && !deferred && (
            <p className="text-slate-300">
              In Safari: <b>File → Add to Dock</b>. In Chrome: click the install icon at the right of the address bar.
            </p>
          )}

          {(platform === "windows" || platform === "mac" || platform === "other") && (
            <div className="space-y-2 border-t border-white/10 pt-3">
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Desktop app</p>
              <a className="btn-secondary block text-center" href={RELEASES} target="_blank" rel="noreferrer">
                {platform === "mac" ? " Download for Mac (.dmg)" : platform === "windows" ? "⊞ Download for Windows (.exe)" : "Download for Windows / Mac"}
              </a>
              <a className="block text-center text-xs text-sky-300 hover:underline" href={RELEASES} target="_blank" rel="noreferrer">
                {platform === "mac" ? "Windows version" : platform === "windows" ? "Mac version" : "All downloads"}
              </a>
            </div>
          )}

          {platform === "android" && !deferred && (
            <p className="text-slate-300">In Chrome, tap <b>⋮ → Install app</b> (or Add to Home screen).</p>
          )}
        </div>
      )}
    </div>
  );
}
