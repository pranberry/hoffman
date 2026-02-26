import { contextBridge, ipcRenderer } from 'electron';

/**
 * ── ARCHITECTURAL OVERVIEW: THE BRIDGE (PRELOAD) ──
 * Electron's security model (Context Isolation) prevents the Renderer (UI) 
 * from accessing powerful Node.js APIs directly.
 * 
 * This Preload script acts as a secure airlock. It:
 * 1. Runs in a privileged environment with access to Node.js.
 * 2. Exposes a selective, sanitized API to the UI via 'contextBridge'.
 * 3. Prevents the UI from sending arbitrary IPC messages or accessing 'require()'.
 */

const api = {
  // Folders management IPC wrappers
  folders: {
    list: () => ipcRenderer.invoke('folders:list'),
    create: (name: string) => ipcRenderer.invoke('folders:create', name),
    rename: (id: number, name: string) => ipcRenderer.invoke('folders:rename', id, name),
    delete: (id: number) => ipcRenderer.invoke('folders:delete', id),
  },

  // Global settings access
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    list: () => ipcRenderer.invoke('settings:list'),
  },

  // RSS Feed management and polling
  feeds: {
    list: () => ipcRenderer.invoke('feeds:list'),
    add: (url: string, folderId: number | null) => ipcRenderer.invoke('feeds:add', url, folderId),
    remove: (id: number) => ipcRenderer.invoke('feeds:remove', id),
    rename: (id: number, title: string) => ipcRenderer.invoke('feeds:rename', id, title),
    updateUrl: (id: number, url: string) => ipcRenderer.invoke('feeds:updateUrl', id, url),
    move: (id: number, folderId: number | null) => ipcRenderer.invoke('feeds:move', id, folderId),
    reorder: (ids: number[]) => ipcRenderer.invoke('feeds:reorder', ids),
    refresh: (feedId?: number) => ipcRenderer.invoke('feeds:refresh', feedId),
  },

  // Article reading state
  articles: {
    list: (feedId?: number, folderId?: number) => ipcRenderer.invoke('articles:list', feedId, folderId),
    get: (id: number) => ipcRenderer.invoke('articles:get', id),
    markRead: (id: number, isRead: boolean) => ipcRenderer.invoke('articles:markRead', id, isRead),
    markAllRead: (feedId?: number) => ipcRenderer.invoke('articles:markAllRead', feedId),
    toggleStar: (id: number) => ipcRenderer.invoke('articles:toggleStar', id),
    starred: () => ipcRenderer.invoke('articles:starred'),
  },

  // Financial market data
  stocks: {
    watchlist: () => ipcRenderer.invoke('stocks:watchlist'),
    add: (symbol: string) => ipcRenderer.invoke('stocks:add', symbol),
    validate: (symbol: string) => ipcRenderer.invoke('stocks:validate', symbol),
    remove: (id: number) => ipcRenderer.invoke('stocks:remove', id),
    quotes: () => ipcRenderer.invoke('stocks:quotes'),
    detail: (symbol: string) => ipcRenderer.invoke('stocks:detail', symbol),
    reorder: (ids: number[]) => ipcRenderer.invoke('stocks:reorder', ids),
  },

  // System filesystem operations
  backup: {
    export: () => ipcRenderer.invoke('backup:export'),
    import: () => ipcRenderer.invoke('backup:import'),
  },

  // Secure external link opening (prevents navigating the app itself)
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
};

/**
 * Exposes the 'api' object as 'window.api' in the Renderer process.
 * This is the ONLY way the UI can talk to the backend.
 */
contextBridge.exposeInMainWorld('api', api);

export type ElectronApi = typeof api;
