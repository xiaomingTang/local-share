import { contextBridge, ipcRenderer } from "electron";

const electronAPI = {
  // 添加右键菜单
  addContextMenu: () => ipcRenderer.invoke("add-context-menu"),

  // 移除右键菜单
  removeContextMenu: () => ipcRenderer.invoke("remove-context-menu"),

  // 开始文件夹共享
  shareFolder: (folderPath: string) =>
    ipcRenderer.invoke("share-folder", folderPath),

  // 停止服务器
  stopServer: () => ipcRenderer.invoke("stop-server"),

  // 获取服务器状态
  getServerStatus: () => ipcRenderer.invoke("get-server-status"),
  // 查询是否通过命令行 --share 启动
  getCommandlineShare: () => ipcRenderer.invoke("get-commandline-share"),
  // 主进程通知服务器已启动（用于命令行 --share 场景）
  onServerStarted: (callback: (event: any, serverInfo: any) => void) =>
    ipcRenderer.on("server-started", callback),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
