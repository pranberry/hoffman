import { contextBridge, ipcRenderer } from 'electron';

// Expose a strict, typed API to the renderer process.
// No raw Node or Electron APIs are leaked — only these specific IPC calls.

const api = {
  // Folders
  folders: {
    list: () => ipcRenderer.invoke('folders:list'),
    create: (name: string) => ipcRenderer.invoke('folders:create', name),
    rename: (id: number, name: string) => ipcRenderer.invoke('folders:rename', id, name),
    delete: (id: number) => ipcRenderer.invoke('folders:delete', id),
  },

  // Settings
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    list: () => ipcRenderer.invoke('settings:list'),
  },

  // Feeds
  feeds: {
    list: () => ipcRenderer.invoke('feeds:list'),
    add: (url: string, folderId: number | null) => ipcRenderer.invoke('feeds:add', url, folderId),
    remove: (id: number) => ipcRenderer.invoke('feeds:remove', id),
    rename: (id: number, title: string) => ipcRenderer.invoke('feeds:rename', id, title),
    updateUrl: (id: number, url: string) => ipcRenderer.invoke('feeds:updateUrl', id, url),
    move: (id: number, folderId: number | null) => ipcRenderer.invoke('feeds:move', id, folderId),
    refresh: (feedId?: number) => ipcRenderer.invoke('feeds:refresh', feedId),
  },

  // Articles
  articles: {
    list: (feedId?: number, folderId?: number) => ipcRenderer.invoke('articles:list', feedId, folderId),
    get: (id: number) => ipcRenderer.invoke('articles:get', id),
    markRead: (id: number, isRead: boolean) => ipcRenderer.invoke('articles:markRead', id, isRead),
    markAllRead: (feedId?: number) => ipcRenderer.invoke('articles:markAllRead', feedId),
    toggleStar: (id: number) => ipcRenderer.invoke('articles:toggleStar', id),
    starred: () => ipcRenderer.invoke('articles:starred'),
  },

  // Stocks
  stocks: {
    watchlist: () => ipcRenderer.invoke('stocks:watchlist'),
    add: (symbol: string) => ipcRenderer.invoke('stocks:add', symbol),
    validate: (symbol: string) => ipcRenderer.invoke('stocks:validate', symbol),
    remove: (id: number) => ipcRenderer.invoke('stocks:remove', id),
    quotes: () => ipcRenderer.invoke('stocks:quotes'),
    detail: (symbol: string) => ipcRenderer.invoke('stocks:detail', symbol),
    reorder: (ids: number[]) => ipcRenderer.invoke('stocks:reorder', ids),
  },

  // Backup & Restore
  backup: {
    export: () => ipcRenderer.invoke('backup:export'),
    import: () => ipcRenderer.invoke('backup:import'),
  },

  // Shell
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronApi = typeof api;
