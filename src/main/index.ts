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

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  
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
      sandbox: false, // Required for 'better-sqlite3' to function in this specific setup
    },
  });

  /**
   * CONTENT SECURITY POLICY (CSP)
   * This is a critical security layer that defines which resources the app can load.
   * It prevents "Cross-Site Scripting" (XSS) attacks.
   */
  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self';"
          ],
        },
      });
    });
  }

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
    // Only allow internal app navigation
    if (!url.startsWith('http://localhost:5173') && !url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  // Block any attempt to open a new window via window.open()
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
