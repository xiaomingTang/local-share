import { ServerInfo } from "../common/type";
import { toError } from "../src/error/utils";
import { remote, waitUntilRemoteReady } from "./remote";

class LocalShareRenderer {
  // MUI-like ExpandLess SVG (up chevron)
  private readonly EXPAND_LESS_SVG = `
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path fill="currentColor" d="M12 8.59L16.59 13.17 18 11.76 12 5.76 6 11.76 7.41 13.17z"></path>
    </svg>
  `;
  private elements: {
    contextPanel?: HTMLElement;
    contextPanelHeader?: HTMLElement;
    contextToggleBtn?: HTMLButtonElement;
    addContextMenu: HTMLButtonElement;
    removeContextMenu: HTMLButtonElement;
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
      addContextMenu: document.getElementById(
        "addContextMenu"
      ) as HTMLButtonElement,
      removeContextMenu: document.getElementById(
        "removeContextMenu"
      ) as HTMLButtonElement,
      serverStatus: document.getElementById("serverStatus") as HTMLElement,
      statusText: document.getElementById("statusText") as HTMLElement,
      sharedFolder: document.getElementById("sharedFolder") as HTMLElement,
      serverUrl: document.getElementById("serverUrl") as HTMLElement,
      qrCode: document.getElementById("qrCode") as HTMLImageElement,
      stopServer: document.getElementById("stopServer") as HTMLButtonElement,
      notification: document.getElementById("notification") as HTMLElement,
      contextPanel: document.getElementById("contextPanel") as HTMLElement,
      contextPanelHeader: document.getElementById(
        "contextPanelHeader"
      ) as HTMLElement,
      contextToggleBtn: document.getElementById(
        "contextToggleBtn"
      ) as HTMLButtonElement,
    };

    this.init();
  }

  private async init() {
    await waitUntilRemoteReady();
    this.initializeContextPanel();
    this.bindEvents();
    this.checkServerStatus();
    this.setupIpcListeners();
  }

  private async initializeContextPanel(): Promise<void> {
    try {
      // 如果 preload 中暴露了 getCommandlineShare，则查询
      const resp = await remote._.getCommandlineShare();

      const content = document.getElementById("contextContent");
      const toggle = this.elements.contextToggleBtn;

      if (!resp.commandLineShare) {
        // 不支持折叠，始终展开并隐藏切换按钮
        if (toggle) {
          toggle.style.display = "none";
        }
        if (content) {
          content.classList.remove("collapsed");
        }
        return;
      }

      // 显示折叠按钮，面板默认折叠
      if (toggle) {
        toggle.style.display = "inline-flex";
        toggle.textContent = "⚙"; // 设置图标表示可展开
        toggle.setAttribute("aria-expanded", "false");
      }
      if (content) {
        content.classList.add("collapsed");
      }
      // 点击切换
      toggle?.addEventListener("click", () => {
        const isCollapsed = content?.classList.contains("collapsed");
        if (isCollapsed) {
          content?.classList.remove("collapsed");
          // 使用 MUI 风格的向上箭头 SVG
          toggle!.innerHTML = this.EXPAND_LESS_SVG;
          toggle!.setAttribute("aria-expanded", "true");
        } else {
          content?.classList.add("collapsed");
          toggle!.textContent = "⚙";
          toggle!.setAttribute("aria-expanded", "false");
        }
      });
    } catch (error) {
      console.warn("无法查询 commandLineShare 状态，默认展开面板：", error);
      const toggle = this.elements.contextToggleBtn;
      const content = document.getElementById("contextContent");
      if (toggle) toggle.style.display = "none";
      if (content) content.classList.remove("collapsed");
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

    // 添加右键菜单
    this.elements.addContextMenu.addEventListener("click", async () => {
      try {
        this.elements.addContextMenu.disabled = true;
        this.elements.addContextMenu.textContent = "添加中...";

        await remote._.addContextMenu();

        this.showNotification("添加右键菜单成功！", "success");
      } catch (error) {
        const e = toError(error);
        this.showNotification(`添加失败：${e.message}`, "error");
      } finally {
        this.elements.addContextMenu.disabled = false;
        this.elements.addContextMenu.textContent = "添加到文件夹右键菜单";
      }
    });

    // 移除右键菜单
    this.elements.removeContextMenu.addEventListener("click", async () => {
      try {
        this.elements.removeContextMenu.disabled = true;
        this.elements.removeContextMenu.textContent = "移除中...";

        await remote._.removeContextMenu();
        this.showNotification("移除右键菜单成功！", "info");
      } catch (error) {
        const e = toError(error);
        this.showNotification(`移除失败：${e.message}`, "error");
      } finally {
        this.elements.removeContextMenu.disabled = false;
        this.elements.removeContextMenu.textContent = "移除文件夹右键菜单";
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
