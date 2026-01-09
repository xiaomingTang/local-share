export interface ServerInfo {
  url: string;
  port: number;
  localIP: string;
  qrCode: string;
  sharedFolder: string;
}

export interface ElectronAPI {
  addContextMenu: () => Promise<{ success: boolean; error?: string }>;
  removeContextMenu: () => Promise<{ success: boolean; error?: string }>;
  shareFolder: (folderPath: string) => Promise<
    | ({
        success: true;
      } & ServerInfo)
    | { success: false; error: string }
  >;
  stopServer: () => Promise<{ success: boolean }>;
  getServerStatus: () => Promise<{
    isRunning: boolean;
    serverInfo: ServerInfo | null;
  }>;
  getCommandlineShare: () => Promise<{ commandLineShare: boolean }>;
  onServerStarted?: (
    callback: (
      event: Electron.IpcRendererEvent,
      serverInfo: ServerInfo | null
    ) => void
  ) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
