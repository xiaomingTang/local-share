import { app, BrowserWindow, ipcMain, Menu, Tray } from "electron";
import { p } from "./utils/fs-utils";
import { WebServer } from "./server/web-server";
import { addContextMenu, removeContextMenu } from "./utils/registry-manager";
import { remote } from "./remote";

class LocalShareApp {
  private mainWindow: BrowserWindow | null = null;
  private webServer: WebServer | null = null;
  private tray: Tray | null = null;
  private commandLineShare: boolean = false;

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
      width: app.isPackaged ? 400 : 1000,
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
    const appVersion = app.getVersion();
    this.mainWindow.webContents.setUserAgent(`${ua} LocalShare/${appVersion}`);

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
    remote.register("addContextMenu", async () => addContextMenu());

    // 移除右键菜单
    remote.register("removeContextMenu", async () => removeContextMenu());

    // 开始文件夹共享
    remote.register("shareFolder", async (folderPath: string) => {
      if (!this.webServer) {
        this.webServer = new WebServer();
      }

      const serverInfo = await this.webServer.startServer(folderPath);

      // 更新托盘图标状态
      this.updateTrayStatus(true);

      return serverInfo;
    });

    // 停止服务器
    remote.register("stopServer", async () => {
      this.stopWebServer();
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

    // 标记应用是通过命令行 --share 启动的
    this.commandLineShare = true;

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
