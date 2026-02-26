import { app, BrowserWindow, session } from 'electron';
import path from 'path';
import { initDatabase, closeDatabase } from './database';
import { registerIpcHandlers } from './ipc';

/**
 * ── ARCHITECTURAL OVERVIEW: MAIN ENTRY POINT ──
 * This is the "Brain" of the application. It runs in Node.js and:
 * 1. Manages the system-level lifecycle (boot, shutdown).
 * 2. Creates the browser window for the UI.
 * 3. Initializes the database and IPC communication.
 * 4. Enforces strict security policies (CSP, Navigation locks).
 */

// SINGLE INSTANCE LOCK: Prevents multiple copies of the app from running at once.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // macOS specific: makes the title bar look integrated
    trafficLightPosition: { x: 16, y: 16 },
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Injects the secure bridge
      contextIsolation: true, // SECURITY: Critical for protecting the main process
      nodeIntegration: false, // SECURITY: Prevents UI from using Node.js directly
      sandbox: true, // SECURITY: Restricts renderer to a minimal environment
    },
  });

  /**
   * CONTENT SECURITY POLICY (CSP)
   * This is a critical security layer that defines which resources the app can load.
   * It prevents "Cross-Site Scripting" (XSS) attacks.
   *
   * HOW CSP WORKS:
   * Think of CSP as a bouncer with a guest list. Every resource (script, image,
   * stylesheet, font, network request) must match a rule or it gets blocked.
   *
   * Each directive controls one resource type:
   *   default-src  → Fallback for anything not covered by a specific directive
   *   script-src   → Which scripts can execute (most critical for XSS defense)
   *   style-src    → Which stylesheets can load ('unsafe-inline' = allows style="...")
   *   img-src      → Which images can load ('data:' = allows base64-encoded images)
   *   font-src     → Which fonts can load
   *   connect-src  → Which URLs fetch/XHR/WebSocket can talk to
   *
   * 'self' means "only from our own app's origin" — no third-party CDNs, no external servers.
   *
   * WHY TWO POLICIES:
   * - Production: Strict lockdown. Only our own bundled code runs.
   * - Development: Vite's hot-reload needs WebSocket (ws:) and inline scripts,
   *   so we allow those, but we STILL block injected scripts from RSS content.
   */
  const prodCsp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self';";
  const devCsp = "default-src 'self' http://localhost:5173; script-src 'self' 'unsafe-inline' http://localhost:5173; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws://localhost:5173 http://localhost:5173;";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [isDev ? devCsp : prodCsp],
      },
    });
  });

  // Load the appropriate content based on environment
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173'); // Vite dev server
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * APP LIFECYCLE: Initialization
 */
app.on('ready', () => {
  initDatabase();        // Boot the SQLite engine
  registerIpcHandlers(); // Setup communication channels
  createWindow();        // Show the UI
});

/**
 * APP LIFECYCLE: Shutdown
 */
app.on('window-all-closed', () => {
  closeDatabase(); // Ensure SQLite closes gracefully to prevent corruption
  app.quit();
});

// If the user tries to open a second instance, focus the existing window instead.
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

/**
 * SECURITY GUARDRAILS
 * We disable all in-app navigation to ensure external websites never load 
 * inside our trusted environment.
 */
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    // Only allow navigation within our own app origin. The broad 'file://'
    // check was replaced to prevent navigating to arbitrary local files.
    const allowed = isDev
      ? url.startsWith('http://localhost:5173')
      : url.startsWith(`file://${app.getAppPath()}`);
    if (!allowed) event.preventDefault();
  });

  // Block any attempt to open a new window via window.open()
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
