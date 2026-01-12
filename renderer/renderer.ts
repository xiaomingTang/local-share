import { ServerInfo } from "../common/type";
import { toError } from "../src/error/utils";
import { remote, waitUntilRemoteReady } from "./remote";

class LocalShareRenderer {
  private elements: {
    contextMenuStatus: HTMLElement;
    autoLaunchStatus: HTMLElement;
    serverStatus: HTMLElement;
    statusText: HTMLElement;
    sharedFolder: HTMLElement;
    serverUrl: HTMLElement;
    qrCode: HTMLImageElement;
    stopServer: HTMLButtonElement;
    notification: HTMLElement;
  };

  constructor() {
    this.elements = {
      contextMenuStatus: document.getElementById(
        "contextMenuStatus"
      ) as HTMLElement,
      autoLaunchStatus: document.getElementById(
        "autoLaunchStatus"
      ) as HTMLElement,
      serverStatus: document.getElementById("serverStatus") as HTMLElement,
      statusText: document.getElementById("statusText") as HTMLElement,
      sharedFolder: document.getElementById("sharedFolder") as HTMLElement,
      serverUrl: document.getElementById("serverUrl") as HTMLElement,
      qrCode: document.getElementById("qrCode") as HTMLImageElement,
      stopServer: document.getElementById("stopServer") as HTMLButtonElement,
      notification: document.getElementById("notification") as HTMLElement,
    };

    this.init();
  }

  private async init() {
    await waitUntilRemoteReady();
    this.bindEvents();
    void this.refreshContextMenuStatus();
    void this.refreshAutoLaunchStatus();
    this.checkServerStatus();
    this.setupIpcListeners();
  }

  private async refreshAutoLaunchStatus(): Promise<void> {
    try {
      const el = this.elements.autoLaunchStatus;
      el.textContent = "检测中...";
      el.setAttribute("title", "检测中...");
      el.classList.remove("clickable");
      el.classList.remove("underline");
      el.classList.remove("state-enabled", "state-disabled");
      el.classList.add("disabled");
      el.setAttribute("aria-disabled", "true");

      const status = await remote._.getAutoLaunchStatus();
      if (!status.supported) {
        el.textContent = "不支持";
        el.setAttribute("title", "当前系统不支持开机自启配置");
        el.classList.add("disabled");
        el.classList.remove("underline");
        el.classList.remove("clickable");
        el.setAttribute("aria-disabled", "true");
        return;
      }

      if (status.enabled) {
        el.textContent = "已启用";
        el.setAttribute("title", "点击关闭开机自启");
        el.classList.add("state-enabled");
        el.classList.remove("state-disabled");
      } else {
        el.textContent = "未启用";
        el.setAttribute("title", "点击启用开机自启");
        el.classList.add("state-disabled");
        el.classList.remove("state-enabled");
      }

      el.classList.add("clickable");
      el.classList.add("underline");
      el.classList.remove("disabled");
      el.setAttribute("aria-disabled", "false");
    } catch (error) {
      const e = toError(error);
      const el = this.elements.autoLaunchStatus;
      el.textContent = `检测失败：${e.message}`;
      el.setAttribute("title", "点击重新检测");
      el.classList.add("clickable");
      el.classList.remove("disabled");
      el.classList.remove("underline");
      el.classList.remove("state-enabled", "state-disabled");
      el.setAttribute("aria-disabled", "false");
    }
  }

  private async refreshContextMenuStatus(): Promise<void> {
    try {
      const el = this.elements.contextMenuStatus;
      el.textContent = "检测中...";
      el.setAttribute("title", "检测中...");
      el.classList.remove("clickable");
      el.classList.remove("underline");
      el.classList.remove("state-enabled", "state-disabled");
      el.classList.add("disabled");
      el.setAttribute("aria-disabled", "true");

      const resp = await remote._.checkContextMenuExists();
      if (resp.exists) {
        el.textContent = "已启用";
        el.setAttribute("title", "点击移除右键菜单");
        el.classList.add("state-enabled");
        el.classList.remove("state-disabled");
      } else {
        el.textContent = "未启用";
        el.setAttribute("title", "点击启用右键菜单");
        el.classList.add("state-disabled");
        el.classList.remove("state-enabled");
      }

      el.classList.add("clickable");
      el.classList.add("underline");
      el.classList.remove("disabled");
      el.setAttribute("aria-disabled", "false");
    } catch (error) {
      const e = toError(error);
      const el = this.elements.contextMenuStatus;
      el.textContent = `检测失败：${e.message}`;
      el.setAttribute("title", "点击重新检测");
      el.classList.add("clickable");
      el.classList.remove("disabled");
      el.classList.remove("underline");
      el.classList.remove("state-enabled", "state-disabled");
      el.setAttribute("aria-disabled", "false");
    } finally {
      // no-op
    }
  }

  private bindEvents(): void {
    // 访问地址：点击复制到剪贴板
    const copyServerUrl = async (): Promise<void> => {
      const url = this.elements.serverUrl.textContent?.trim();
      if (!url || url === "-") return;

      try {
        await remote._.copyToClipboard(url);
        this.showNotification("已复制访问地址", "success");
      } catch (error) {
        const e = toError(error);
        this.showNotification(`复制失败：${e.message}`, "error");
      }
    };

    this.elements.serverUrl.addEventListener("click", () => {
      void copyServerUrl();
    });
    this.elements.serverUrl.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        void copyServerUrl();
      }
    });

    // 共享文件夹路径：点击用资源管理器打开
    const openSharedFolder = async (): Promise<void> => {
      const folderPath = this.elements.sharedFolder.textContent?.trim();
      if (!folderPath || folderPath === "-") return;

      try {
        await remote._.openFolderInExplorer(folderPath);
      } catch (error) {
        const e = toError(error);
        this.showNotification(`打开文件夹失败：${e.message}`, "error");
      }
    };

    this.elements.sharedFolder.addEventListener("click", () => {
      void openSharedFolder();
    });
    this.elements.sharedFolder.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        void openSharedFolder();
      }
    });

    // 右键菜单开关（自动检测当前状态）
    // 右键菜单状态文本：点击即切换启用/移除
    const toggleContextMenu = async (): Promise<void> => {
      try {
        // 先尝试检测当前状态
        this.elements.contextMenuStatus.classList.remove(
          "state-enabled",
          "state-disabled"
        );
        this.elements.contextMenuStatus.textContent = "处理中...";
        this.elements.contextMenuStatus.setAttribute("title", "处理中...");
        this.elements.contextMenuStatus.classList.add("disabled");
        this.elements.contextMenuStatus.classList.remove("underline");
        this.elements.contextMenuStatus.setAttribute("aria-disabled", "true");

        const status = await remote._.checkContextMenuExists();
        const targetEnabled = !status.exists;

        await remote._.setContextMenuEnabled(targetEnabled);
        await this.refreshContextMenuStatus();
      } catch (error) {
        const e = toError(error);
        this.showNotification(`操作失败：${e.message}`, "error");
        await this.refreshContextMenuStatus();
      } finally {
        // no-op (refreshContextMenuStatus 会恢复可点击状态)
      }
    };

    this.elements.contextMenuStatus.addEventListener("click", () => {
      void toggleContextMenu();
    });
    this.elements.contextMenuStatus.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        void toggleContextMenu();
      }
    });

    // 开机自启：点击即切换启用/关闭
    const toggleAutoLaunch = async (): Promise<void> => {
      const el = this.elements.autoLaunchStatus;

      try {
        el.classList.remove("state-enabled", "state-disabled");
        el.textContent = "处理中...";
        el.setAttribute("title", "处理中...");
        el.classList.add("disabled");
        el.classList.remove("underline");
        el.setAttribute("aria-disabled", "true");

        const status = await remote._.getAutoLaunchStatus();
        if (!status.supported) {
          this.showNotification("当前系统不支持开机自启配置", "info");
          await this.refreshAutoLaunchStatus();
          return;
        }

        const targetEnabled = !status.enabled;
        await remote._.setAutoLaunchEnabled(targetEnabled);
        await this.refreshAutoLaunchStatus();
      } catch (error) {
        const e = toError(error);
        this.showNotification(`操作失败：${e.message}`, "error");
        await this.refreshAutoLaunchStatus();
      }
    };

    this.elements.autoLaunchStatus.addEventListener("click", () => {
      void toggleAutoLaunch();
    });
    this.elements.autoLaunchStatus.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        void toggleAutoLaunch();
      }
    });

    // 停止服务器
    this.elements.stopServer.addEventListener("click", async () => {
      try {
        this.elements.stopServer.disabled = true;
        this.elements.stopServer.textContent = "停止中...";

        await remote._.stopServer();
        this.showNotification("服务已停止", "info");
        this.hideServerStatus();
      } catch (error) {
        const e = toError(error);
        this.showNotification(`停止服务失败：${e.message}`, "error");
      } finally {
        this.elements.stopServer.disabled = false;
        this.elements.stopServer.textContent = "停止服务";
      }
    });
  }

  private async checkServerStatus(): Promise<void> {
    try {
      const status = await remote._.getServerStatus();

      if (status.isRunning && status.serverInfo) {
        this.showServerStatus(status.serverInfo);
      } else {
        this.hideServerStatus();
      }
    } catch (error) {
      console.error("检查服务器状态失败:", error);
    }
  }

  private setupIpcListeners(): void {
    remote.register("serverStarted", async (serverInfo) => {
      this.showServerStatus(serverInfo);
    });
  }

  private showServerStatus(serverInfo: ServerInfo): void {
    this.elements.serverStatus.style.display = "block";

    this.elements.sharedFolder.textContent = serverInfo.sharedFolder;
    this.elements.sharedFolder.classList.add("clickable");
    this.elements.serverUrl.textContent = serverInfo.url;
    this.elements.serverUrl.classList.add("clickable");

    // 显示二维码（如果有的话）
    if (serverInfo.qrCode) {
      this.elements.qrCode.src = serverInfo.qrCode;
      this.elements.qrCode.style.display = "block";
    }
  }

  private hideServerStatus(): void {
    this.elements.serverStatus.style.display = "none";

    this.elements.sharedFolder.textContent = "-";
    this.elements.sharedFolder.classList.remove("clickable");
    this.elements.serverUrl.textContent = "-";
    this.elements.serverUrl.classList.remove("clickable");
    this.elements.qrCode.style.display = "none";
  }

  private showNotification(
    message: string,
    type: "success" | "error" | "info"
  ): void {
    this.elements.notification.textContent = message;
    this.elements.notification.className = `notification ${type}`;
    this.elements.notification.style.display = "block";

    // 3秒后自动隐藏
    setTimeout(() => {
      this.elements.notification.style.display = "none";
    }, 3000);
  }
}

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", () => {
  new LocalShareRenderer();
});
