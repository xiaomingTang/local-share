interface Window {
  electronAPI: {
    addContextMenu: () => Promise<{ success: boolean; error?: string }>;
    removeContextMenu: () => Promise<{ success: boolean; error?: string }>;
    shareFolder: (folderPath: string) => Promise<any>;
    stopServer: () => Promise<{ success: boolean }>;
    getServerStatus: () => Promise<any>;
    onServerStarted?: (callback: (event: any, serverInfo: any) => void) => void;
  };
}

class LocalShareRenderer {
  private elements: {
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
    };

    this.bindEvents();
    this.checkServerStatus();
    this.setupIpcListeners();
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
      window.electronAPI.onServerStarted((_, serverInfo: any) => {
        if (serverInfo) {
          this.showServerStatus(serverInfo);
        }
      });
    }
  }

  private showServerStatus(serverInfo: any): void {
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
