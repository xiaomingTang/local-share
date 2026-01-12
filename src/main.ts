import { app, BrowserWindow, shell, clipboard } from "electron";
import { p } from "./utils/fs-utils";
import type { WebServer } from "./server/web-server";

let remoteModulePromise: Promise<typeof import("./remote")> | null = null;

async function getRemote() {
  if (!remoteModulePromise) {
    remoteModulePromise = import("./remote");
  }
  const remoteModule = await remoteModulePromise;
  return remoteModule.remote;
}

class LocalShareApp {
  private mainWindow: BrowserWindow | null = null;
  private webServer: WebServer | null = null;
  private commandLineShare: boolean = false;

  constructor() {
    this.initializeApp();
  }

  private async initializeApp() {
    // 设置进程编码为UTF-8
    if (process.platform === "win32") {
      if (process.stdout && process.stdout.setEncoding) {
        process.stdout.setEncoding("utf8");
      }
      if (process.stderr && process.stderr.setEncoding) {
        process.stderr.setEncoding("utf8");
      }
    }

    // 应用生命周期事件
    app.on("window-all-closed", () => {
      this.stopWebServer();
      if (process.platform !== "darwin") {
        app.quit();
      }
    });
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    void this.setupIPC();

    await app.whenReady();
    this.createWindow();

    void this.handleCommandLineShare();
  }

  private createWindow() {
    this.mainWindow = new BrowserWindow({
      width: app.isPackaged ? 420 : 1000,
      height: 600,
      resizable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: p("src/preload.js"),
        // webSecurity: false,
        // experimentalFeatures: false,
        defaultEncoding: "utf8",
      },
      icon: p("assets/icon.png"),
    });

    this.mainWindow.loadFile(p("renderer/index.html"));

    // 仅在开发环境下打开开发者工具
    if (!app.isPackaged) {
      this.mainWindow.webContents.openDevTools();
    }

    // 隐藏菜单栏
    this.mainWindow.setMenu(null);

    // 关闭主窗口时停止服务
    this.mainWindow.on("close", () => {
      this.stopWebServer();
    });
  }

  private async setupIPC() {
    const remote = await getRemote();

    // 检测右键菜单是否已存在
    remote.register("checkContextMenuExists", async () => {
      const { checkContextMenuExists } = await import(
        "./utils/registry-manager"
      );
      const exists = await checkContextMenuExists();
      return { exists };
    });

    // 通过开关启用/禁用右键菜单（内部根据当前状态决定是否执行）
    remote.register("setContextMenuEnabled", async (enabled: boolean) => {
      const { addContextMenu, removeContextMenu, checkContextMenuExists } =
        await import("./utils/registry-manager");

      const exists = await checkContextMenuExists();
      if (enabled) {
        if (!exists) {
          await addContextMenu();
        }
      } else {
        if (exists) {
          await removeContextMenu();
        }
      }

      return { exists: await checkContextMenuExists() };
    });

    // 开始文件夹共享
    remote.register("shareFolder", async (folderPath: string) => {
      if (!this.webServer) {
        const { WebServer } = await import("./server/web-server");
        this.webServer = new WebServer();
      }

      const serverInfo = await this.webServer.startServer(folderPath);

      return serverInfo;
    });

    // 停止服务器
    remote.register("stopServer", async () => {
      this.stopWebServer();
    });

    // 在资源管理器中打开共享文件夹
    remote.register("openFolderInExplorer", async (folderPath: string) => {
      const trimmed = folderPath?.trim();
      if (!trimmed || trimmed === "-") return;

      const fs = await import("fs");
      const path = await import("path");

      const resolvedPath = path.resolve(trimmed);
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`文件夹不存在：${resolvedPath}`);
      }

      const stat = fs.statSync(resolvedPath);
      if (!stat.isDirectory()) {
        throw new Error(`不是文件夹：${resolvedPath}`);
      }

      const err = await shell.openPath(resolvedPath);
      if (err) {
        throw new Error(err);
      }
    });

    // 写入剪贴板（用于点击复制访问地址等）
    remote.register("copyToClipboard", async (text: string) => {
      const trimmed = text?.trim();
      if (!trimmed || trimmed === "-") return;
      clipboard.writeText(trimmed);
    });

    // 获取服务器状态
    remote.register("getServerStatus", async () => ({
      isRunning: this.webServer?.isRunning() || false,
      serverInfo: this.webServer?.getServerInfo() || null,
    }));

    // 查询应用是否通过命令行 --share 启动
    remote.register("getCommandlineShare", async () => ({
      commandLineShare: this.commandLineShare,
    }));
  }

  private stopWebServer() {
    if (this.webServer) {
      this.webServer.stopServer();
      this.webServer = null;
    }
  }

  // 处理从命令行传入的 --share <folderPath>
  private async handleCommandLineShare() {
    const args = process.argv;
    const shareIndex = args.indexOf("--share");
    if (shareIndex === -1 || !args[shareIndex + 1]) {
      return;
    }

    // 标记应用是通过命令行 --share 启动的
    this.commandLineShare = true;

    const folderPath = args[shareIndex + 1];

    try {
      const remote = await getRemote();

      if (!this.webServer) {
        const { WebServer } = await import("./server/web-server");
        this.webServer = new WebServer();
      }

      const serverInfo = await this.webServer.startServer(folderPath);

      // 将主窗口显示到前台，方便查看二维码
      if (this.mainWindow) {
        this.mainWindow.show();
        this.mainWindow.focus();
      }

      // 发送状态到渲染进程（若需要立即更新）
      if (this.mainWindow) {
        this.mainWindow.webContents.send("server-started", serverInfo);
        remote._.serverStarted(serverInfo, {
          targetDeviceId: this.mainWindow.webContents.id.toString(),
        });
      }
    } catch (error) {
      console.error("命令行分享启动失败:", error);
    }
  }
}

// 启动应用
new LocalShareApp();
