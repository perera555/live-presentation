// Desktop shell for Live Presentation Studio (Windows + macOS).
// It opens the deployed web app in its own window, so the desktop app is always up to date.
const { app, BrowserWindow, shell, session, Menu } = require("electron");
const pkg = require("./package.json");

const APP_URL = process.env.LP_APP_URL || pkg.appUrl;
const APP_ORIGIN = new URL(APP_URL).origin;

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

  // Allow microphone (voice recording) and fullscreen for our own site only.
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    const fromApp = (details.requestingUrl || wc.getURL()).startsWith(APP_ORIGIN);
    callback(fromApp && ["media", "fullscreen", "clipboard-sanitized-write"].includes(permission));
  });

  // Open external links in the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_ORIGIN)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(APP_ORIGIN)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  win.webContents.on("did-fail-load", () => {
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
