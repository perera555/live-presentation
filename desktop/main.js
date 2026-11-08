// Desktop shell for Live Presentation Studio (Windows + macOS).
// It opens the deployed web app in its own window, so the desktop app is always up to date.
// WhatsApp Web and Zoom's web client open as separate windows *inside* the app, so you can multitask.
const { app, BrowserWindow, shell, session, Menu } = require("electron");
const pkg = require("./package.json");

const APP_URL = process.env.LP_APP_URL || pkg.appUrl;
const APP_ORIGIN = new URL(APP_URL).origin;

// Sites that open inside the app (in their own window) instead of the external browser.
const IN_APP_SITES = [
  { match: (h) => h === "web.whatsapp.com" || h === "wa.me" || h === "api.whatsapp.com", partition: "persist:whatsapp", title: "WhatsApp" },
  { match: (h) => h === "zoom.us" || h.endsWith(".zoom.us"), partition: "persist:zoom", title: "Zoom" },
];

function inAppSite(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    return IN_APP_SITES.find((s) => s.match(u.hostname)) || null;
  } catch {
    return null;
  }
}

// WhatsApp Web and Zoom only support normal browsers, so present a plain Chrome user agent to them.
function chromeUserAgent() {
  return session.defaultSession
    .getUserAgent()
    .replace(/\s?Electron\/\S+/, "")
    .replace(/\s?live-presentation-desktop\/\S+/, "");
}

const siteWindows = new Map();

function openSiteWindow(url, site) {
  const existing = siteWindows.get(site.partition);
  if (existing && !existing.isDestroyed()) {
    existing.loadURL(url, { userAgent: chromeUserAgent() });
    existing.focus();
    return;
  }
  const ses = session.fromPartition(site.partition);
  ses.setUserAgent(chromeUserAgent());
  // Camera, microphone, notifications and screen sharing for calls.
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(["media", "notifications", "fullscreen", "display-capture", "clipboard-sanitized-write"].includes(permission));
  });
  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    title: site.title,
    autoHideMenuBar: true,
    backgroundColor: "#111b21",
    webPreferences: { partition: site.partition, contextIsolation: true, sandbox: true },
  });
  // Links clicked inside WhatsApp/Zoom that go elsewhere open in the normal browser.
  win.webContents.setWindowOpenHandler(({ url: next }) => {
    if (inAppSite(next)) return { action: "allow" };
    shell.openExternal(next);
    return { action: "deny" };
  });
  win.loadURL(url, { userAgent: chromeUserAgent() });
  siteWindows.set(site.partition, win);
  win.on("closed", () => siteWindows.delete(site.partition));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#070b16",
    title: "Live Presentation Studio",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });

  // Allow camera/microphone (voice recording, camera check) and fullscreen for our own site only.
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    const fromApp = (details.requestingUrl || wc.getURL()).startsWith(APP_ORIGIN);
    callback(fromApp && ["media", "fullscreen", "clipboard-sanitized-write"].includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((wc, permission, origin) => {
    return origin === APP_ORIGIN && ["media", "fullscreen"].includes(permission);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    const site = inAppSite(url);
    if (site) {
      openSiteWindow(url, site);
      return { action: "deny" };
    }
    if (!url.startsWith(APP_ORIGIN)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith(APP_ORIGIN)) return;
    e.preventDefault();
    const site = inAppSite(url);
    if (site) openSiteWindow(url, site);
    else shell.openExternal(url);
  });

  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = navigation aborted (normal)
    win.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(
          `<body style="background:#070b16;color:#e2e8f0;font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0">
            <div style="text-align:center"><h2>No internet connection</h2>
            <p>Live Presentation Studio needs the internet to create slides and videos.</p>
            <button onclick="location.href='${APP_URL}'" style="padding:10px 20px;border-radius:8px;border:0;background:#38bdf8;font-weight:600">Try again</button></div></body>`,
        ),
    );
  });

  win.loadURL(APP_URL);
}

if (process.platform === "darwin") {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "viewMenu" }, { role: "windowMenu" }]),
  );
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
