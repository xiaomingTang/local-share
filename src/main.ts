import { app, BrowserWindow, shell, clipboard, Menu, Tray } from "electron";
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
  private tray: Tray | null = null;
  private isQuitting: boolean = false;

  private getLoginItemSettingsOptions(): { path?: string; args?: string[] } {
    if (process.platform !== "win32") return {};

    // Windows 下 get/setLoginItemSettings 需要使用一致的 path/args 才能正确读取到
    // 对应那一条“启动项”。开发态通常是 electron.exe 启动，需要把 app path 作为第一个参数。
    const path = process.execPath;
    const args = app.isPackaged
      ? ["--autostart"]
      : [app.getAppPath(), "--autostart"];

    return { path, args };
  }

  constructor() {
    this.initializeApp();
  }

  private isAutoStartLaunch(args: string[] = process.argv): boolean {
    return args.includes("--autostart");
  }

  private getShareFolderFromArgs(args: string[]): string | null {
    // 仅支持：--share=<folder>
    const inlineArg = args.find((a) => a.startsWith("--share="));
    if (!inlineArg) return null;

    const value = inlineArg.slice("--share=".length).trim();
    return value ? value.replace(/^"|"$/g, "") : null;
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
    app.on("before-quit", () => {
      this.isQuitting = true;
    });

    // 常驻后台：窗口关闭不退出；仅托盘“退出”才真正退出
    app.on("window-all-closed", () => {
      if (this.isQuitting) {
        this.stopWebServer();
        if (process.platform !== "darwin") {
          app.quit();
        }
      }
    });
    app.on("activate", () => {
      this.showMainWindow();
    });

    void this.setupIPC();

    await app.whenReady();

    this.setupTray();

    // 启动时处理 --share；未带 share 时，根据是否 --autostart 决定是否弹出窗口
    const handledShare = await this.handleShareArgs(process.argv);
    if (!handledShare && !this.isAutoStartLaunch(process.argv)) {
      this.showMainWindow();
    }
  }

  private ensureMainWindow(show: boolean = true) {
    if (this.mainWindow) {
      if (show) {
        this.mainWindow.show();
        this.mainWindow.focus();
      }
      return;
    }

    this.mainWindow = new BrowserWindow({
      width: app.isPackaged ? 420 : 1000,
      height: 600,
      resizable: true,
      show,
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

    this.mainWindow.on("close", (evt) => {
      if (this.isQuitting) return;
      evt.preventDefault();
      void this.handleWindowClose();
    });
  }

  private async handleWindowClose(): Promise<void> {
    await this.stopWebServer();
    this.mainWindow?.hide();
  }

  private showMainWindow() {
    this.ensureMainWindow(true);
  }

  private setupTray() {
    if (this.tray) return;

    const fs = require("fs") as typeof import("fs");
    const iconPath = p("assets/tray-icon.png");
    if (!fs.existsSync(iconPath)) {
      console.warn("托盘图标不存在：", iconPath);
      return;
    }

    this.tray = new Tray(iconPath);
    this.tray.setToolTip("LocalShare");

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "显示窗口",
        click: () => this.showMainWindow(),
      },
      {
        label: "隐藏窗口",
        click: () => this.mainWindow?.hide(),
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          this.isQuitting = true;
          this.stopWebServer();
          app.quit();
        },
      },
    ]);
    this.tray.setContextMenu(contextMenu);

    this.tray.on("click", () => {
      // 单击托盘：显示/聚焦窗口
      this.showMainWindow();
    });
  }

  private updateTrayStatus(isServerRunning: boolean) {
    if (!this.tray) return;
    const fs = require("fs") as typeof import("fs");
    const iconPath = isServerRunning
      ? p("assets/tray-icon-active.png")
      : p("assets/tray-icon.png");
    if (fs.existsSync(iconPath)) {
      this.tray.setImage(iconPath);
    }
    this.tray.setToolTip(
      isServerRunning ? "LocalShare - 服务运行中" : "LocalShare"
    );
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

    // 开机自启（Windows）：查询与开关
    remote.register("getAutoLaunchStatus", async () => {
      if (process.platform !== "win32" && process.platform !== "darwin") {
        return { supported: false, enabled: false };
      }

      if (process.platform === "win32") {
        const settings = app.getLoginItemSettings(
          this.getLoginItemSettingsOptions()
        );
        return { supported: true, enabled: !!settings.openAtLogin };
      }

      const settings = app.getLoginItemSettings();
      return { supported: true, enabled: !!settings.openAtLogin };
    });

    remote.register("setAutoLaunchEnabled", async (enabled: boolean) => {
      if (process.platform !== "win32" && process.platform !== "darwin") {
        return { supported: false, enabled: false };
      }

      if (process.platform === "win32") {
        app.setLoginItemSettings({
          openAtLogin: enabled,
          ...this.getLoginItemSettingsOptions(),
        });
      } else {
        // macOS：尽量静默
        app.setLoginItemSettings({
          openAtLogin: enabled,
          openAsHidden: true,
        });
      }

      const settings =
        process.platform === "win32"
          ? app.getLoginItemSettings(this.getLoginItemSettingsOptions())
          : app.getLoginItemSettings();
      return { supported: true, enabled: !!settings.openAtLogin };
    });

    // 开始文件夹共享
    remote.register("shareFolder", async (folderPath: string) => {
      if (!this.webServer) {
        const { WebServer } = await import("./server/web-server");
        this.webServer = new WebServer();
      }

      const serverInfo = await this.webServer.startServer(folderPath);

      this.updateTrayStatus(true);

      return serverInfo;
    });

    // 停止服务器
    remote.register("stopServer", async () => {
      await this.stopWebServer();
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

  private async stopWebServer(): Promise<void> {
    const server = this.webServer;
    if (!server) return;

    // 先置空，避免重入重复 stop
    this.webServer = null;

    await server.stopServer();
    this.updateTrayStatus(false);
    await this.notifyRendererServerStopped();
  }

  private async notifyRendererServerStopped(): Promise<void> {
    try {
      if (!this.mainWindow) return;
      const wc = this.mainWindow.webContents;
      const remote = await getRemote();

      const send = () => {
        remote._.serverStopped(undefined, {
          targetDeviceId: wc.id.toString(),
        });
      };

      if (wc.isLoading()) {
        wc.once("did-finish-load", send);
      } else {
        send();
      }
    } catch (error) {
      console.warn("通知渲染进程服务已停止失败:", error);
    }
  }

  // 处理 argv 里的 --share=<folderPath>，返回是否处理了 share
  private async handleShareArgs(args: string[]): Promise<boolean> {
    const folderPath = this.getShareFolderFromArgs(args);
    if (!folderPath) return false;

    this.commandLineShare = true;

    try {
      const remote = await getRemote();

      // 确保窗口可用并前置（需要显示二维码/地址）
      this.showMainWindow();

      if (!this.webServer) {
        const { WebServer } = await import("./server/web-server");
        this.webServer = new WebServer();
      }

      const serverInfo = await this.webServer.startServer(folderPath);

      this.updateTrayStatus(true);

      // 发送状态到渲染进程（窗口可能仍在加载）
      if (this.mainWindow) {
        const wc = this.mainWindow.webContents;
        const send = () => {
          wc.send("server-started", serverInfo);
          remote._.serverStarted(serverInfo, {
            targetDeviceId: wc.id.toString(),
          });
        };

        if (wc.isLoading()) {
          wc.once("did-finish-load", send);
        } else {
          send();
        }
      }
    } catch (error) {
      console.error("命令行分享启动失败:", error);
      return true;
    }

    return true;
  }

  public async onSecondInstance(argv: string[]) {
    await app.whenReady();
    this.setupTray();
    const handled = await this.handleShareArgs(argv);
    if (!handled) {
      this.showMainWindow();
    }
  }
}

// 单实例：第二次启动转发到已有实例
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  const localShareApp = new LocalShareApp();
  app.on("second-instance", (_event, argv) => {
    void localShareApp.onSecondInstance(argv);
  });
}
