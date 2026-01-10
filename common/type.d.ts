export interface ServerInfo {
  url: string;
  port: number;
  localIP: string;
  qrCode: string;
  sharedFolder: string;
}

declare global {
  type FuncsFromMain = {
    addContextMenu: (data?: void) => Promise<void>;
    removeContextMenu: (data?: void) => Promise<void>;
    shareFolder: (folderPath: string) => Promise<ServerInfo>;
    stopServer: (data?: void) => Promise<void>;
    getServerStatus: (data?: void) => Promise<{
      isRunning: boolean;
      serverInfo: ServerInfo | null;
    }>;
    getCommandlineShare: (
      data?: void
    ) => Promise<{ commandLineShare: boolean }>;
  };

  type FuncsFromRenderer = {
    serverStarted: (serverInfo: ServerInfo) => Promise<void>;
  };
}
