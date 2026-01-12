export interface ServerInfo {
  url: string;
  port: number;
  localIP: string;
  qrCode: string;
  sharedFolder: string;
}

declare global {
  type FuncsFromMain = {
    checkContextMenuExists: (data?: void) => Promise<{ exists: boolean }>;
    setContextMenuEnabled: (enabled: boolean) => Promise<{ exists: boolean }>;
    getAutoLaunchStatus: (
      data?: void
    ) => Promise<{ supported: boolean; enabled: boolean }>;
    setAutoLaunchEnabled: (
      enabled: boolean
    ) => Promise<{ supported: boolean; enabled: boolean }>;
    shareFolder: (folderPath: string) => Promise<ServerInfo>;
    openFolderInExplorer: (folderPath: string) => Promise<void>;
    copyToClipboard: (text: string) => Promise<void>;
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
    serverStopped: (data?: void) => Promise<void>;
  };
}
