"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Dev = { id: string; label: string };

/** Webcam + microphone check for interviews and calls: preview, device pickers, level meter, test recording. */
export default function DeviceCheck() {
  const [on, setOn] = useState(false);
  const [cams, setCams] = useState<Dev[]>([]);
  const [mics, setMics] = useState<Dev[]>([]);
  const [camId, setCamId] = useState("");
  const [micId, setMicId] = useState("");
  const [muted, setMuted] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [level, setLevel] = useState(0);
  const [testing, setTesting] = useState(0);
  const [testUrl, setTestUrl] = useState("");
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);

  const stopAll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const startStream = useCallback(async (cam: string, mic: string) => {
    stopAll();
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cam ? { deviceId: { exact: cam }, width: { ideal: 1280 }, height: { ideal: 720 } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: mic ? { deviceId: { exact: mic }, echoCancellation: true, noiseSuppression: true } : { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      // device lists (labels are only available after permission is granted)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const label = (d: MediaDeviceInfo, n: number, kind: string) => d.label || `${kind} ${n + 1}`;
      setCams(devices.filter((d) => d.kind === "videoinput").map((d, n) => ({ id: d.deviceId, label: label(d, n, "Camera") })));
      setMics(devices.filter((d) => d.kind === "audioinput").map((d, n) => ({ id: d.deviceId, label: label(d, n, "Microphone") })));
      setCamId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? cam);
      setMicId(stream.getAudioTracks()[0]?.getSettings().deviceId ?? mic);

      // mic level meter
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setOn(true);
    } catch {
      setOn(false);
      setError("Couldn't open the camera or microphone. Allow access in your browser, and close other apps (like Zoom) that might be using the camera.");
    }
  }, [stopAll]);

  useEffect(() => stopAll, [stopAll]);

  // Automatically detect cameras/mics; start straight away if access was already allowed.
  const [found, setFound] = useState<{ cams: number; mics: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function detect() {
      const devices = await navigator.mediaDevices?.enumerateDevices?.().catch(() => []) ?? [];
      if (cancelled) return;
      setFound({
        cams: devices.filter((d) => d.kind === "videoinput").length,
        mics: devices.filter((d) => d.kind === "audioinput").length,
      });
      try {
        const [cam, mic] = await Promise.all([
          navigator.permissions.query({ name: "camera" as PermissionName }),
          navigator.permissions.query({ name: "microphone" as PermissionName }),
        ]);
        if (!cancelled && cam.state === "granted" && mic.state === "granted" && !streamRef.current) {
          startStream("", "");
        }
      } catch {
        /* Permissions API not supported (e.g. some Safari versions); wait for the button */
      }
    }
    detect();

    // Plugged in / unplugged a webcam or headset → refresh, and recover if the active device vanished.
    const onChange = async () => {
      await detect();
      const tracks = streamRef.current?.getTracks() ?? [];
      if (tracks.some((t) => t.readyState === "ended")) startStream("", "");
      else if (streamRef.current) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const label = (d: MediaDeviceInfo, n: number, kind: string) => d.label || `${kind} ${n + 1}`;
        setCams(devices.filter((d) => d.kind === "videoinput").map((d, n) => ({ id: d.deviceId, label: label(d, n, "Camera") })));
        setMics(devices.filter((d) => d.kind === "audioinput").map((d, n) => ({ id: d.deviceId, label: label(d, n, "Microphone") })));
      }
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", onChange);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.("devicechange", onChange);
    };
  }, [startStream]);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, [muted]);

  function testRecord() {
    const stream = streamRef.current;
    if (!stream) return;
    if (testUrl) URL.revokeObjectURL(testUrl);
    setTestUrl("");
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => setTestUrl(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })));
    rec.start();
    setTesting(10);
    let left = 10;
    const id = setInterval(() => {
      left -= 1;
      setTesting(left);
      if (left <= 0) {
        clearInterval(id);
        rec.stop();
      }
    }, 1000);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <h3 className="font-semibold">🎥 Your camera &amp; 🎙 mic</h3>
        <p className="text-xs text-slate-400">Check how you look and sound before an interview or call.</p>
        {found && (
          <p className={`mt-1 rounded-full px-3 py-0.5 text-xs font-medium ${
            found.cams && found.mics ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"}`}>
            {found.cams ? `✓ ${found.cams} camera${found.cams > 1 ? "s" : ""}` : "⚠ No camera found"}
            {"  ·  "}
            {found.mics ? `✓ ${found.mics} microphone${found.mics > 1 ? "s" : ""}` : "⚠ No microphone found"}
            {" detected"}
          </p>
        )}
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[1fr_260px]">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
          {testUrl ? (
            <video src={testUrl} controls playsInline className="h-full w-full object-contain" />
          ) : (
            <video ref={videoRef} autoPlay muted playsInline
              className={`h-full w-full object-cover ${mirror ? "-scale-x-100" : ""} ${on ? "" : "hidden"}`} />
          )}
          {!on && !testUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
              <span className="text-4xl">📷</span>
              <button type="button" className="btn-primary" onClick={() => startStream("", "")}>
                Turn on camera &amp; mic
              </button>
            </div>
          )}
          {testing > 0 && (
            <span className="absolute top-2 right-2 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold">● Test {testing}s</span>
          )}
          {on && muted && (
            <span className="absolute top-2 left-2 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-slate-950">Mic muted</span>
          )}
        </div>

        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="label">Camera</span>
            <select className="input" value={camId} disabled={!on}
              onChange={(e) => startStream(e.target.value, micId)}>
              {cams.length === 0 && <option value="">Turn on to choose</option>}
              {cams.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Microphone</span>
            <select className="input" value={micId} disabled={!on}
              onChange={(e) => startStream(camId, e.target.value)}>
              {mics.length === 0 && <option value="">Turn on to choose</option>}
              {mics.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </label>
          <div>
            <span className="label">Mic level</span>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full rounded-full transition-[width] duration-75 ${level > 0.85 ? "bg-red-400" : "bg-emerald-400"}`}
                style={{ width: `${Math.round((muted ? 0 : level) * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">Speak normally: the bar should move into the middle.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost" disabled={!on} onClick={() => setMuted((m) => !m)}>
              {muted ? "🔇 Unmute" : "🎙 Mute"}
            </button>
            <button type="button" className="btn-ghost" disabled={!on} onClick={() => setMirror((m) => !m)}>
              ⇋ Mirror
            </button>
            <button type="button" className="btn-secondary col-span-2" disabled={!on || testing > 0} onClick={testRecord}>
              {testUrl ? "↺ Test again (10s)" : "⏺ 10-second test recording"}
            </button>
            {testUrl && (
              <button type="button" className="btn-ghost col-span-2" onClick={() => { URL.revokeObjectURL(testUrl); setTestUrl(""); }}>
                Back to live camera
              </button>
            )}
            {on && (
              <button type="button" className="btn-ghost col-span-2" onClick={() => { stopAll(); setOn(false); }}>
                Turn off
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-center text-sm text-red-300">{error}</p>}
      <p className="text-center text-xs text-slate-500">
        Interview tips: camera at eye level · light in front of you, not behind · quiet room · look at the lens when you speak.
        Turn this off before joining Zoom so Zoom can use the camera.
      </p>
    </div>
  );
}
