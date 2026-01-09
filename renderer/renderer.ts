import { ServerInfo } from "../common/type";

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

    this.initializeContextPanel();
    this.bindEvents();
    this.checkServerStatus();
    this.setupIpcListeners();
  }

  private async initializeContextPanel(): Promise<void> {
    try {
      // 如果 preload 中暴露了 getCommandlineShare，则查询
      const resp = await window.electronAPI.getCommandlineShare();
      const hasCommandLineShare = resp && resp.commandLineShare;

      const content = document.getElementById("contextContent");
      const toggle = this.elements.contextToggleBtn;

      if (hasCommandLineShare) {
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
      } else {
        // 不支持折叠，始终展开并隐藏切换按钮
        if (toggle) {
          toggle.style.display = "none";
        }
        if (content) {
          content.classList.remove("collapsed");
        }
      }
    } catch (error) {
      console.warn("无法查询 commandLineShare 状态，默认展开面板：", error);
      const toggle = this.elements.contextToggleBtn;
      const content = document.getElementById("contextContent");
      if (toggle) toggle.style.display = "none";
      if (content) content.classList.remove("collapsed");
    }
  }

  private bindEvents(): void {
    // 添加右键菜单
    this.elements.addContextMenu.addEventListener("click", async () => {
      try {
        this.elements.addContextMenu.disabled = true;
        this.elements.addContextMenu.textContent = "添加中...";

        const result = await window.electronAPI.addContextMenu();

        if (result.success) {
          this.showNotification("添加右键菜单成功！", "success");
        } else {
          this.showNotification(`添加失败: ${result.error}`, "error");
        }
      } catch (error) {
        this.showNotification("添加失败: 网络错误", "error");
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

        const result = await window.electronAPI.removeContextMenu();

        if (result.success) {
          this.showNotification("移除右键菜单成功！", "info");
        } else {
          this.showNotification(`移除失败: ${result.error}`, "error");
        }
      } catch (error) {
        this.showNotification("移除失败: 网络错误", "error");
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

        const result = await window.electronAPI.stopServer();

        if (result.success) {
          this.showNotification("服务已停止", "info");
          this.hideServerStatus();
        }
      } catch (error) {
        this.showNotification("停止服务失败", "error");
      } finally {
        this.elements.stopServer.disabled = false;
        this.elements.stopServer.textContent = "停止服务";
      }
    });
  }

  private async checkServerStatus(): Promise<void> {
    try {
      const status = await window.electronAPI.getServerStatus();

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
    if (window.electronAPI.onServerStarted) {
      window.electronAPI.onServerStarted((_, serverInfo) => {
        if (serverInfo) {
          this.showServerStatus(serverInfo);
        }
      });
    }
  }

  private showServerStatus(serverInfo: ServerInfo): void {
    this.elements.serverStatus.style.display = "block";

    this.elements.sharedFolder.textContent = serverInfo.sharedFolder;
    this.elements.serverUrl.textContent = serverInfo.url;

    // 显示二维码（如果有的话）
    if (serverInfo.qrCode) {
      this.elements.qrCode.src = serverInfo.qrCode;
      this.elements.qrCode.style.display = "block";
    }
  }

  private hideServerStatus(): void {
    this.elements.serverStatus.style.display = "none";

    this.elements.sharedFolder.textContent = "-";
    this.elements.serverUrl.textContent = "-";
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
