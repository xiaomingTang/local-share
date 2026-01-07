import * as path from "path";
import { execSync } from "child_process";
import iconv from "iconv-lite";
import { formatError } from "../error/utils";

export class RegistryManager {
  private readonly contextMenuKey =
    "HKEY_CLASSES_ROOT\\Directory\\shell\\ShareFolder";
  private readonly commandKey =
    "HKEY_CLASSES_ROOT\\Directory\\shell\\ShareFolder\\command";

  public async addContextMenu(): Promise<void> {
    if (process.platform !== "win32") {
      throw new Error("右键菜单功能仅支持 Windows 系统");
    }

    try {
      // 检查是否有管理员权限
      await this.checkAdminRights();

      // 获取当前应用程序的路径
      const appPath = process.execPath;
      const iconPath = path.join(
        path.dirname(appPath),
        "assets",
        "folder-share.ico"
      );

      // 使用 reg.exe 命令添加注册表项
      this.execRegCommand(
        `add "${this.contextMenuKey}" /ve /d "共享此文件夹" /f`
      );
      this.execRegCommand(
        `add "${this.contextMenuKey}" /v Icon /d "${iconPath}" /f`
      );

      const command = `"${appPath}" --share "%1"`;
      this.execRegCommand(`add "${this.commandKey}" /ve /d "${command}" /f`);
    } catch (e) {
      const error = formatError(e);
      throw new Error(`添加右键菜单失败: ${error.message}`);
    }
  }

  public async removeContextMenu(): Promise<void> {
    if (process.platform !== "win32") {
      throw new Error("右键菜单功能仅支持 Windows 系统");
    }

    try {
      // 检查是否有管理员权限
      await this.checkAdminRights();

      // 使用 reg.exe 命令删除注册表项
      this.execRegCommand(`delete "${this.contextMenuKey}" /f`);
    } catch (e) {
      const error = formatError(e);
      throw new Error(`移除右键菜单失败: ${error.message}`);
    }
  }

  public async checkContextMenuExists(): Promise<boolean> {
    if (process.platform !== "win32") {
      return false;
    }

    try {
      this.execRegCommand(`query "${this.contextMenuKey}"`);
      return true;
    } catch (error) {
      return false;
    }
  }

  // 执行 reg.exe 命令并正确处理编码
  private execRegCommand(args: string): string {
    try {
      const result = execSync(`reg ${args}`, {
        encoding: "buffer",
        stdio: ["pipe", "pipe", "pipe"],
      });

      // 尝试将 GBK 编码的输出转换为 UTF-8
      return iconv.decode(result, "gbk");
    } catch (error: any) {
      // 处理错误输出的编码
      let errorMessage = "";

      if (error.stderr && Buffer.isBuffer(error.stderr)) {
        // 从 GBK 解码错误信息
        errorMessage = iconv.decode(error.stderr, "gbk");
      } else if (error.stdout && Buffer.isBuffer(error.stdout)) {
        errorMessage = iconv.decode(error.stdout, "gbk");
      } else if (error.message) {
        errorMessage = error.message;
      }
      throw new Error(errorMessage || "注册表操作失败");
    }
  }

  // 检查管理员权限的方法
  private async checkAdminRights(): Promise<void> {
    try {
      this.execRegCommand('query "HKEY_CLASSES_ROOT\\Directory\\shell"');
    } catch (error: any) {
      throw new Error("需要管理员权限，请以管理员身份运行程序");
    }
  }
}
