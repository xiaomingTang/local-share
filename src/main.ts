import { app, BrowserWindow, ipcMain, Menu, Tray } from "electron";
import { p } from "./utils/file";
import { WebServer } from "./server/web-server";
import { RegistryManager } from "./utils/registry-manager";

class LocalShareApp {
  private mainWindow: BrowserWindow | null = null;
  private webServer: WebServer | null = null;
  private tray: Tray | null = null;
  private registryManager: RegistryManager;

  constructor() {
    // 设置进程编码为UTF-8
    if (process.platform === "win32") {
      if (process.stdout && process.stdout.setEncoding) {
        process.stdout.setEncoding("utf8");
      }
      if (process.stderr && process.stderr.setEncoding) {
        process.stderr.setEncoding("utf8");
      }
    }

    this.registryManager = new RegistryManager();
    this.initializeApp();
  }

  private async initializeApp() {
    // wsl 下渲染加速有问题，禁用硬件加速
    app.disableHardwareAcceleration();

    app.whenReady().then(() => {
      this.createWindow();
      this.setupTray();
      this.setupIPC();
      this.handleCommandLineShare();
    });

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
  }

  private createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 400,
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

    const ua = this.mainWindow.webContents.getUserAgent();
    this.mainWindow.webContents.setUserAgent(`${ua} LocalShare/1.0.0`);

    this.mainWindow.loadFile(p("renderer/index.html"));

    // 仅在开发环境下打开开发者工具
    if (!app.isPackaged) {
      this.mainWindow.webContents.openDevTools();
    }

    // 隐藏菜单栏
    this.mainWindow.setMenu(null);
  }

  private setupTray() {
    const iconPath = p("assets/tray-icon.png");

    // 检查图标文件是否存在
    if (!require("fs").existsSync(iconPath)) {
      console.log("托盘图标文件不存在，跳过托盘创建");
      return;
    }

    try {
      this.tray = new Tray(iconPath);

      const contextMenu = Menu.buildFromTemplate([
        {
          label: "显示主窗口",
          click: () => {
            if (this.mainWindow) {
              this.mainWindow.show();
              this.mainWindow.focus();
            }
          },
        },
        { type: "separator" },
        {
          label: "退出",
          click: () => {
            this.stopWebServer();
            app.quit();
          },
        },
      ]);

      this.tray.setToolTip("LocalShare");
      this.tray.setContextMenu(contextMenu);

      this.tray.on("double-click", () => {
        if (this.mainWindow) {
          this.mainWindow.show();
          this.mainWindow.focus();
        }
      });
    } catch (error) {
      console.error("创建托盘失败:", (error as Error).message);
    }
  }

  private setupIPC() {
    // 添加右键菜单
    ipcMain.handle("add-context-menu", async () => {
      try {
        await this.registryManager.addContextMenu();
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // 移除右键菜单
    ipcMain.handle("remove-context-menu", async () => {
      try {
        await this.registryManager.removeContextMenu();
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // 开始文件夹共享
    ipcMain.handle("share-folder", async (event, folderPath: string) => {
      try {
        if (!this.webServer) {
          this.webServer = new WebServer();
        }

        const serverInfo = await this.webServer.startServer(folderPath);

        // 更新托盘图标状态
        this.updateTrayStatus(true);

        return { success: true, ...serverInfo };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // 停止服务器
    ipcMain.handle("stop-server", () => {
      this.stopWebServer();
      return { success: true };
    });

    // 获取服务器状态
    ipcMain.handle("get-server-status", () => {
      return {
        isRunning: this.webServer?.isRunning() || false,
        serverInfo: this.webServer?.getServerInfo() || null,
      };
    });
  }

  private stopWebServer() {
    if (this.webServer) {
      this.webServer.stopServer();
      this.webServer = null;
      this.updateTrayStatus(false);
    }
  }

  private updateTrayStatus(isServerRunning: boolean) {
    if (this.tray) {
      const iconPath = isServerRunning
        ? p("assets/tray-icon-active.png")
        : p("assets/tray-icon.png");

      this.tray.setImage(iconPath);
      this.tray.setToolTip(
        isServerRunning ? "LocalShare - 服务运行中" : "LocalShare"
      );
    }
  }

  // 处理从命令行传入的 --share <folderPath>
  private async handleCommandLineShare() {
    const args = process.argv;
    const shareIndex = args.indexOf("--share");
    if (shareIndex === -1 || !args[shareIndex + 1]) {
      return;
    }

    const folderPath = args[shareIndex + 1];

    try {
      if (!this.webServer) {
        this.webServer = new WebServer();
      }

      const serverInfo = await this.webServer.startServer(folderPath);
      this.updateTrayStatus(true);

      // 将主窗口显示到前台，方便查看二维码
      if (this.mainWindow) {
        this.mainWindow.show();
        this.mainWindow.focus();
      }

      // 发送状态到渲染进程（若需要立即更新）
      if (this.mainWindow) {
        this.mainWindow.webContents.send("server-started", serverInfo);
      }
    } catch (error) {
      console.error("命令行分享启动失败:", error);
    }
  }
}

// 启动应用
new LocalShareApp();
