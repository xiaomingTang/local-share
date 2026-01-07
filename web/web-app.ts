class WebFileManager {
  private currentPath: string = "";
  private elements: {
    fileList: HTMLElement;
    currentPath: HTMLElement;
    dropZone: HTMLElement;
    fileInput: HTMLInputElement;
    uploadProgress: HTMLElement;
    progressFill: HTMLElement;
    progressText: HTMLElement;
    previewModal: HTMLElement;
    previewTitle: HTMLElement;
    previewContent: HTMLElement;
    downloadBtn: HTMLElement;
    notification: HTMLElement;
  };

  constructor() {
    this.elements = {
      fileList: document.getElementById("fileList")!,
      currentPath: document.getElementById("currentPath")!,
      dropZone: document.getElementById("dropZone")!,
      fileInput: document.getElementById("fileInput")! as HTMLInputElement,
      uploadProgress: document.getElementById("uploadProgress")!,
      progressFill: document.getElementById("progressFill")!,
      progressText: document.getElementById("progressText")!,
      previewModal: document.getElementById("previewModal")!,
      previewTitle: document.getElementById("previewTitle")!,
      previewContent: document.getElementById("previewContent")!,
      downloadBtn: document.getElementById("downloadBtn")!,
      notification: document.getElementById("notification")!,
    };

    this.bindEvents();
    this.loadFiles();
  }

  private bindEvents(): void {
    // 文件拖拽上传
    this.elements.dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.elements.dropZone.classList.add("drag-over");
    });

    this.elements.dropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      this.elements.dropZone.classList.remove("drag-over");
    });

    this.elements.dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      this.elements.dropZone.classList.remove("drag-over");
      const files = Array.from(e.dataTransfer?.files || []);
      this.uploadFiles(files);
    });

    // 文件选择上传
    this.elements.fileInput.addEventListener("change", (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      this.uploadFiles(files);
    });
  }

  private async loadFiles(path: string = ""): Promise<void> {
    try {
      this.elements.fileList.innerHTML = '<div class="loading">加载中...</div>';

      const response = await fetch(
        `/api/files?path=${encodeURIComponent(path)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "加载文件失败");
      }

      this.currentPath = path;
      this.elements.currentPath.textContent = path || "/";
      this.renderFileList(data);
    } catch (error) {
      this.elements.fileList.innerHTML = '<div class="loading">加载失败</div>';
      this.showNotification("加载文件列表失败", "error");
    }
  }

  private renderFileList(data: any): void {
    const { items, parentPath } = data;
    let html = "";

    // 添加返回上级目录按钮
    if (parentPath !== null) {
      html += `
                <div class="file-item" onclick="fileManager.loadFiles('${
                  parentPath || ""
                }')">
                    <div class="file-icon">📁</div>
                    <div class="file-info">
                        <div class="file-name">.. 返回上级目录</div>
                    </div>
                </div>
            `;
    }

    // 渲染文件和文件夹
    for (const item of items) {
      const icon = this.getFileIcon(item);
      const size = item.type === "file" ? this.formatFileSize(item.size) : "";
      const date = new Date(item.modified).toLocaleDateString();

      html += `
                <div class="file-item">
                    <div class="file-icon ${this.getFileIconClass(
                      item
                    )}">${icon}</div>
                    <div class="file-info">
                        <div class="file-name">${this.escapeHtml(
                          item.name
                        )}</div>
                        <div class="file-details">${size} • ${date}</div>
                    </div>
                    <div class="file-actions">
                        ${
                          item.type === "directory"
                            ? `<button class="btn btn-primary btn-small" onclick="fileManager.openFolder('${this.escapeHtml(
                                item.name
                              )}')">打开</button>`
                            : `
                                ${
                                  this.canPreview(item)
                                    ? `<button class="btn btn-secondary btn-small" onclick="fileManager.previewFile('${this.escapeHtml(
                                        item.name
                                      )}')">预览</button>`
                                    : ""
                                }
                                <button class="btn btn-primary btn-small" onclick="fileManager.downloadFile('${this.escapeHtml(
                                  item.name
                                )}')">下载</button>
                            `
                        }
                    </div>
                </div>
            `;
    }

    if (items.length === 0) {
      html = '<div class="loading">此文件夹为空</div>';
    }

    this.elements.fileList.innerHTML = html;
  }

  private getFileIcon(item: any): string {
    if (item.type === "directory") return "📁";

    const ext = item.extension || "";
    const iconMap: { [key: string]: string } = {
      // 图片
      ".jpg": "🖼️",
      ".jpeg": "🖼️",
      ".png": "🖼️",
      ".gif": "🖼️",
      ".bmp": "🖼️",
      ".svg": "🖼️",
      // 视频
      ".mp4": "🎬",
      ".avi": "🎬",
      ".mkv": "🎬",
      ".mov": "🎬",
      ".wmv": "🎬",
      ".flv": "🎬",
      // 音频
      ".mp3": "🎵",
      ".wav": "🎵",
      ".flac": "🎵",
      ".aac": "🎵",
      ".ogg": "🎵",
      // 文档
      ".pdf": "📄",
      ".doc": "📝",
      ".docx": "📝",
      ".txt": "📝",
      ".rtf": "📝",
      ".xls": "📊",
      ".xlsx": "📊",
      ".ppt": "📽️",
      ".pptx": "📽️",
      // 压缩包
      ".zip": "📦",
      ".rar": "📦",
      ".7z": "📦",
      ".tar": "📦",
      ".gz": "📦",
      // 代码
      ".js": "💻",
      ".ts": "💻",
      ".html": "💻",
      ".css": "💻",
      ".py": "💻",
      ".java": "💻",
      ".cpp": "💻",
      ".c": "💻",
      ".php": "💻",
      ".rb": "💻",
      ".go": "💻",
    };

    return iconMap[ext] || "📄";
  }

  private getFileIconClass(item: any): string {
    if (item.type === "directory") return "folder";

    const ext = item.extension || "";
    if ([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg"].includes(ext))
      return "image";
    if ([".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv"].includes(ext))
      return "video";
    if ([".mp3", ".wav", ".flac", ".aac", ".ogg"].includes(ext)) return "audio";
    if (
      [
        ".pdf",
        ".doc",
        ".docx",
        ".txt",
        ".rtf",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
      ].includes(ext)
    )
      return "document";
    if ([".zip", ".rar", ".7z", ".tar", ".gz"].includes(ext)) return "archive";
    if (
      [
        ".js",
        ".ts",
        ".html",
        ".css",
        ".py",
        ".java",
        ".cpp",
        ".c",
        ".php",
        ".rb",
        ".go",
      ].includes(ext)
    )
      return "code";

    return "default";
  }

  private canPreview(item: any): boolean {
    if (item.type === "directory") return false;

    const ext = item.extension || "";
    const previewableExts = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".svg",
      ".txt",
      ".md",
      ".json",
      ".html",
      ".css",
      ".js",
      ".ts",
      ".xml",
      ".csv",
      ".log",
    ];

    return previewableExts.includes(ext) && item.size < 10 * 1024 * 1024; // 10MB 限制
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  public openFolder(folderName: string): void {
    const newPath = this.currentPath
      ? `${this.currentPath}/${folderName}`
      : folderName;
    this.loadFiles(newPath);
  }

  public async previewFile(fileName: string): Promise<void> {
    try {
      const filePath = this.currentPath
        ? `${this.currentPath}/${fileName}`
        : fileName;
      const response = await fetch(
        `/api/preview?path=${encodeURIComponent(filePath)}`
      );

      if (!response.ok) {
        throw new Error("预览失败");
      }

      const contentType = response.headers.get("content-type") || "";
      const fileExt = fileName.split(".").pop()?.toLowerCase() || "";

      this.elements.previewTitle.textContent = fileName;

      if (contentType.startsWith("image/")) {
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        this.elements.previewContent.innerHTML = `<img src="${imageUrl}" class="preview-image" alt="${fileName}">`;
      } else {
        const text = await response.text();
        this.elements.previewContent.innerHTML = `<div class="preview-text">${this.escapeHtml(
          text
        )}</div>`;
      }

      // 设置下载按钮
      this.elements.downloadBtn.onclick = () => this.downloadFile(fileName);

      this.elements.previewModal.style.display = "flex";
    } catch (error) {
      this.showNotification("预览文件失败", "error");
    }
  }

  public downloadFile(fileName: string): void {
    const filePath = this.currentPath
      ? `${this.currentPath}/${fileName}`
      : fileName;
    const downloadUrl = `/api/download?path=${encodeURIComponent(filePath)}`;

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private async uploadFiles(files: File[]): Promise<void> {
    if (files.length === 0) return;

    const formData = new FormData();
    formData.append("path", this.currentPath);

    for (const file of files) {
      formData.append("files", file);
    }

    try {
      this.elements.uploadProgress.style.display = "block";
      this.elements.progressText.textContent = "准备上传...";

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percent = (e.loaded / e.total) * 100;
          this.elements.progressFill.style.width = `${percent}%`;
          this.elements.progressText.textContent = `上传中... ${Math.round(
            percent
          )}%`;
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          this.showNotification(response.message, "success");
          this.loadFiles(this.currentPath); // 刷新文件列表
        } else {
          throw new Error("上传失败");
        }

        this.elements.uploadProgress.style.display = "none";
        this.elements.fileInput.value = ""; // 重置文件选择
      });

      xhr.addEventListener("error", () => {
        this.showNotification("上传文件失败", "error");
        this.elements.uploadProgress.style.display = "none";
      });

      xhr.open("POST", "/api/upload");
      xhr.send(formData);
    } catch (error) {
      this.showNotification("上传文件失败", "error");
      this.elements.uploadProgress.style.display = "none";
    }
  }

  private showNotification(
    message: string,
    type: "success" | "error" | "info"
  ): void {
    this.elements.notification.textContent = message;
    this.elements.notification.className = `notification ${type}`;
    this.elements.notification.style.display = "block";

    setTimeout(() => {
      this.elements.notification.style.display = "none";
    }, 3000);
  }
}

// 全局函数
function closePreview(): void {
  document.getElementById("previewModal")!.style.display = "none";
}

// 初始化
let fileManager: WebFileManager;
document.addEventListener("DOMContentLoaded", () => {
  fileManager = new WebFileManager();
});
