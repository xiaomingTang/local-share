import { execSync } from "child_process";
import { formatError } from "../error/utils";
import { p } from "./file";
import { app } from "electron";
import * as path from "path";

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
      const electronExePath = process.execPath;
      // Explorer 只能使用文件系统中的图标，不能直接从 asar 内读取。
      // 打包时我们将图标放到 resources 下（见 build.extraResources），
      // 因此运行时选择正确的路径：打包后使用 process.resourcesPath，否则使用开发源码路径。
      const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, "assets", "folder-share.ico")
        : p("assets/folder-share.ico");

      // 使用 reg.exe 命令添加注册表项
      this.execRegCommand(
        `add "${this.contextMenuKey}" /ve /d "共享此文件夹" /f`
      );
      this.execRegCommand(
        `add "${this.contextMenuKey}" /v Icon /d "${iconPath}" /f`
      );

      // 开发模式下 process.execPath 指向 electron.exe，需要额外传入 appPath
      const command = app.isPackaged
        ? `"${electronExePath}" --share "%1"`
        : `"${electronExePath}" "${app.getAppPath()}" --share "%1"`;
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
      // 通过 cmd 设置 code page 为 UTF-8，确保 reg.exe 的输出就是 UTF-8
      // 注意：这里必须用 cmd.exe 执行 chcp，否则不会影响 reg.exe 的输出编码
      return execSync(`cmd /d /s /c "chcp 65001 >nul & reg ${args}"`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error: any) {
      // cmd 已切到 UTF-8，这里按字符串取 stderr/stdout
      const errorMessage =
        (typeof error?.stderr === "string" && error.stderr.trim()) ||
        (typeof error?.stdout === "string" && error.stdout.trim()) ||
        error?.message ||
        "";
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
