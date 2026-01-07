import { default as express } from "express";
import { default as multer } from "multer";
import * as path from "path";
import * as fs from "fs";
import { promisify } from "util";
import * as qrcode from "qrcode";
import { networkInterfaces } from "os";
import { p } from "../utils/file";

export class WebServer {
  private app: express.Application;
  private server: any = null;
  private port: number = 0;
  private sharedFolderPath: string = "";
  private localIP: string = "";
  private qrCodeDataURL: string = "";

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.static(p("web")));

    // 文件上传配置 (Multer v2)
    // 直接写入共享目录（不使用 temp/ 目录）
    const upload = multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          try {
            const targetPath = (req.body?.path as string) || "";
            const uploadPath = path.resolve(
              path.join(this.sharedFolderPath, targetPath)
            );
            const sharedRoot = path.resolve(this.sharedFolderPath);

            // 安全检查：确保不会写到共享文件夹之外
            if (!uploadPath.startsWith(sharedRoot)) {
              cb(new Error("无权限上传到此路径"), "");
              return;
            }

            fs.mkdirSync(uploadPath, { recursive: true });
            cb(null, uploadPath);
          } catch (e) {
            cb(e as Error, "");
          }
        },
        filename: (req, file, cb) => {
          // 保持原始文件名
          cb(null, file.originalname);
        },
      }),
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB 限制
      },
    });

    // 文件上传路由中间件
    this.setupUploadRoute(upload);
  }

  private setupRoutes(): void {
    // 主页面
    this.app.get("/", (req, res) => {
      res.sendFile(p("web/index.html"));
    });

    // 获取文件夹内容
    this.app.get("/api/files", async (req, res) => {
      try {
        const subPath = (req.query.path as string) || "";
        const sharedRoot = path.resolve(this.sharedFolderPath);
        const fullPath = path.resolve(path.join(sharedRoot, subPath));

        // 安全检查：确保不会访问到共享文件夹之外的内容（需要边界判断，避免前缀欺骗）
        if (
          !(
            fullPath === sharedRoot ||
            fullPath.startsWith(sharedRoot + path.sep)
          )
        ) {
          return res.status(403).json({ error: "无权限访问此路径" });
        }

        // 路径不存在 / 不是文件夹
        if (!fs.existsSync(fullPath)) {
          return res.status(404).json({ error: "路径不存在" });
        }
        const stat = fs.statSync(fullPath);
        if (!stat.isDirectory()) {
          return res.status(404).json({ error: "路径不存在" });
        }

        const items = await this.getDirectoryItems(fullPath);
        const rootName = path.basename(sharedRoot) || sharedRoot || "根目录";
        res.json({
          items,
          rootName,
          currentPath: subPath,
          parentPath: subPath ? path.dirname(subPath) : null,
        });
      } catch (error) {
        res.status(500).json({ error: "读取文件夹失败" });
      }
    });

    // 文件下载/预览
    this.app.get("/api/download", (req, res) => {
      const filePath = req.query.path as string;
      if (!filePath) {
        return res.status(400).json({ error: "缺少文件路径参数" });
      }

      const fullPath = path.join(this.sharedFolderPath, filePath);

      // 安全检查
      if (!fullPath.startsWith(this.sharedFolderPath)) {
        return res.status(403).json({ error: "无权限访问此文件" });
      }

      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "文件不存在" });
      }

      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        return res.status(400).json({ error: "无法下载文件夹" });
      }

      // 设置响应头
      const fileName = path.basename(fullPath);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(fileName)}"`
      );

      // 发送文件
      res.sendFile(fullPath);
    });

    // 文件预览（用于图片、文本等）
    this.app.get("/api/preview", (req, res) => {
      const filePath = req.query.path as string;
      if (!filePath) {
        return res.status(400).json({ error: "缺少文件路径参数" });
      }

      const fullPath = path.join(this.sharedFolderPath, filePath);

      // 安全检查
      if (!fullPath.startsWith(this.sharedFolderPath)) {
        return res.status(403).json({ error: "无权限访问此文件" });
      }

      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "文件不存在" });
      }

      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        return res.status(400).json({ error: "无法预览文件夹" });
      }

      // 根据文件扩展名设置 MIME 类型
      const ext = path.extname(fullPath).toLowerCase();
      const mimeTypes: { [key: string]: string } = {
        ".ico": "image/jpeg",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".json": "application/json",
        ".html": "text/html",
        ".xml": "application/xml",
        ".yml": "text/yaml",
        ".yaml": "text/yaml",
        ".css": "text/css",
        ".js": "application/javascript",
      };

      const mimeType = mimeTypes[ext] || "application/octet-stream";
      res.setHeader("Content-Type", mimeType);

      res.sendFile(fullPath);
    });

    // 文件上传路由在 setupUploadRoute 中单独处理
  }

  private setupUploadRoute(upload: multer.Multer): void {
    // 文件上传
    this.app.post("/api/upload", upload.array("files"), async (req, res) => {
      try {
        const targetPath = req.body.path || "";
        const uploadPath = path.resolve(
          path.join(this.sharedFolderPath, targetPath)
        );
        const sharedRoot = path.resolve(this.sharedFolderPath);

        // 安全检查
        if (!uploadPath.startsWith(sharedRoot)) {
          return res.status(403).json({ error: "无权限上传到此路径" });
        }

        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          return res.status(400).json({ error: "没有上传文件" });
        }

        const results = [];
        for (const file of files) {
          // 理论上 diskStorage 已经直接写入 uploadPath。
          // 但如果 multipart 字段顺序导致 req.body.path 为空，可能会落到共享根目录，这里做一次兜底移动。
          const targetFilePath = path.join(uploadPath, file.originalname!);
          if (path.resolve(file.path) !== path.resolve(targetFilePath)) {
            await fs.promises.mkdir(path.dirname(targetFilePath), {
              recursive: true,
            });
            await fs.promises.rename(file.path, targetFilePath);
          }

          results.push({
            name: file.originalname,
            size: file.size,
            path: path.relative(this.sharedFolderPath, targetFilePath),
          });
        }

        res.json({
          success: true,
          message: `成功上传 ${files.length} 个文件`,
          files: results,
        });
      } catch (error) {
        res.status(500).json({ error: "上传文件失败" });
      }
    });
  }

  private async getDirectoryItems(dirPath: string): Promise<any[]> {
    const readdir = promisify(fs.readdir);
    const stat = promisify(fs.stat);

    const items = await readdir(dirPath);
    const result = [];

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stats = await stat(fullPath);

      result.push({
        name: item,
        type: stats.isDirectory() ? "directory" : "file",
        size: stats.isFile() ? stats.size : 0,
        modified: stats.mtime.toISOString(),
        extension: stats.isFile() ? path.extname(item).toLowerCase() : null,
      });
    }

    return result.sort((a, b) => {
      // 文件夹排在前面
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      // 然后按名称排序
      return a.name.localeCompare(b.name);
    });
  }

  private getLocalIP(): string {
    const nets = networkInterfaces();
    const candidates: Array<{ name: string; address: string; score: number }> =
      [];

    const isIgnoredInterface = (name: string) =>
      /wsl|vEthernet|hyper-v|docker|vmware|virtualbox|loopback|tailscale|zerotier/i.test(
        name
      );

    const scoreIp = (ip: string) => {
      if (ip.startsWith("192.168.")) return 30;
      if (ip.startsWith("10.")) return 20;
      // 172.16.0.0/12
      if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 10;
      // 169.254.x.x (APIPA) 直接忽略
      if (ip.startsWith("169.254.")) return -100;
      return 0;
    };

    for (const name of Object.keys(nets)) {
      if (isIgnoredInterface(name)) continue;

      for (const net of nets[name]!) {
        if (net.family !== "IPv4" || net.internal) continue;
        const score = scoreIp(net.address);
        if (score < 0) continue;
        candidates.push({ name, address: net.address, score });
      }
    }

    // 如果全被过滤了，再退一步：不忽略网卡名，只按 IP 范围挑
    if (candidates.length === 0) {
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]!) {
          if (net.family !== "IPv4" || net.internal) continue;
          const score = scoreIp(net.address);
          if (score < 0) continue;
          candidates.push({ name, address: net.address, score });
        }
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.address || "localhost";
  }

  private getAvailablePort(): Promise<number> {
    return new Promise((resolve) => {
      const server = require("net").createServer();
      server.listen(0, () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });
    });
  }

  public async startServer(folderPath: string): Promise<any> {
    if (this.server) {
      await this.stopServer();
    }

    this.sharedFolderPath = folderPath;
    this.localIP = this.getLocalIP();
    this.port = await this.getAvailablePort();

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        const url = `http://${this.localIP}:${this.port}`;

        // 生成二维码
        qrcode.toDataURL(
          url,
          {
            margin: 0,
          },
          (err, qrCodeDataURL) => {
            if (err) {
              reject(err);
              return;
            }

            this.qrCodeDataURL = qrCodeDataURL;

            resolve({
              url,
              port: this.port,
              localIP: this.localIP,
              qrCode: qrCodeDataURL,
              sharedFolder: folderPath,
            });
          }
        );
      });

      this.server.on("error", (err: any) => {
        reject(err);
      });
    });
  }

  public stopServer(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          this.port = 0;
          this.sharedFolderPath = "";
          this.qrCodeDataURL = "";
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public isRunning(): boolean {
    return this.server !== null;
  }

  public getServerInfo(): any {
    if (!this.isRunning()) {
      return null;
    }

    return {
      url: `http://${this.localIP}:${this.port}`,
      port: this.port,
      localIP: this.localIP,
      sharedFolder: this.sharedFolderPath,
      qrCode: this.qrCodeDataURL,
    };
  }
}
