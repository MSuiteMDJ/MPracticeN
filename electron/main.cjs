const { app, BrowserWindow, shell } = require('electron');
const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const BACKEND_PORT = process.env.PORT || '3003';
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

// Project root: in dev this is the repo root; when packaged it is the folder
// that contains the application executable. All local data is written to a
// single `data` folder next to the application root so the install is portable.
const projectRoot = app.isPackaged
  ? path.dirname(app.getPath('exe'))
  : path.resolve(__dirname, '..');

const dataDir = process.env.DATA_DIR || path.join(projectRoot, 'data');
fs.mkdirSync(dataDir, { recursive: true });

let backendProcess = null;
let mainWindow = null;

function startBackend() {
  const backendEntry = app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'src', 'server.js')
    : path.join(__dirname, '..', 'backend', 'src', 'server.js');

  // In a packaged build there is no system Node, so run the backend with
  // Electron's bundled Node runtime (native modules are rebuilt for Electron's
  // ABI at package time). In development we use the system Node so the same
  // native modules work for both `pnpm dev:backend` and the Electron shell.
  const forkOptions = {
    env: {
      ...process.env,
      NODE_ENV: app.isPackaged ? 'production' : (process.env.NODE_ENV || 'development'),
      SERVE_FRONTEND: 'true',
      PORT: BACKEND_PORT,
      DATA_DIR: dataDir,
    },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  };

  if (app.isPackaged) {
    forkOptions.env.ELECTRON_RUN_AS_NODE = '1';
  } else {
    forkOptions.execPath = process.env.BACKEND_NODE_PATH || 'node';
  }

  backendProcess = fork(backendEntry, [], forkOptions);

  backendProcess.on('exit', (code) => {
    console.log(`[arcanus] backend exited with code ${code}`);
    backendProcess = null;
  });
}

function waitForBackend(timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const ping = () => {
      const req = http.get(`${BACKEND_URL}/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
      req.setTimeout(2000, () => req.destroy());
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error('Backend did not become ready in time'));
      }
      setTimeout(ping, 400);
    };
    ping();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0b0f19',
    title: 'Arcanus Practice',
    icon: path.join(__dirname, '..', 'public', 'arcanus-logo.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open external links in the user's browser, not inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  try {
    await waitForBackend();
    await mainWindow.loadURL(BACKEND_URL);
  } catch (err) {
    await mainWindow.loadURL(
      'data:text/html,' +
        encodeURIComponent(
          `<body style="font-family:sans-serif;background:#0b0f19;color:#fff;padding:2rem">
           <h1>Arcanus Practice failed to start</h1><pre>${String(err)}</pre></body>`
        )
    );
  }

  mainWindow.show();
}

app.whenReady().then(async () => {
  startBackend();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  if (backendProcess) backendProcess.kill();
});
