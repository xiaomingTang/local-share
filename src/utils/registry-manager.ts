import { formatError } from "../error/utils";
import { p } from "./file";
import { app } from "electron";
import * as path from "path";
import {
  execRegCommandSync,
  runRegCommandsWithElevation,
} from "./command-runner";

export class RegistryManager {
  private readonly contextMenuKey =
    "HKEY_CLASSES_ROOT\\Directory\\shell\\ShareFolder";
  private readonly commandKey =
    "HKEY_CLASSES_ROOT\\Directory\\shell\\ShareFolder\\command";

  ensurePlatformSupported(): void {
    if (process.platform !== "win32") {
      throw new Error("注册表操作仅支持 Windows 系统");
    }
  }

  public async addContextMenu(): Promise<void> {
    this.ensurePlatformSupported();

    try {
      // 获取当前应用程序的路径
      const electronExePath = process.execPath;
      // Explorer 只能使用文件系统中的图标，不能直接从 asar 内读取。
      // 打包时我们将图标放到 resources 下（见 build.extraResources），
      // 因此运行时选择正确的路径：打包后使用 process.resourcesPath，否则使用开发源码路径。
      const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, "assets", "folder-share.ico")
        : p("assets/folder-share.ico");

      // 开发模式下 process.execPath 指向 electron.exe，需要额外传入 appPath
      const command = app.isPackaged
        ? `"${electronExePath}" --share "%1"`
        : `"${electronExePath}" "${app.getAppPath()}" --share "%1"`;

      const cmds = [
        `add "${this.contextMenuKey}" /ve /d "共享此文件夹" /f`,
        `add "${this.contextMenuKey}" /v Icon /d "${iconPath}" /f`,
        `add "${this.commandKey}" /ve /d "${command}" /f`,
      ];

      await runRegCommandsWithElevation(cmds);
    } catch (e) {
      const error = formatError(e);
      throw new Error(`添加右键菜单失败：${error.message}`);
    }
  }

  public async removeContextMenu(): Promise<void> {
    this.ensurePlatformSupported();

    try {
      const cmd = `delete "${this.contextMenuKey}" /f`;
      await runRegCommandsWithElevation([cmd]);
    } catch (e) {
      const error = formatError(e);
      throw new Error(`移除右键菜单失败：${error.message}`);
    }
  }

  public async checkContextMenuExists(): Promise<boolean> {
    this.ensurePlatformSupported();

    try {
      execRegCommandSync(`query "${this.contextMenuKey}"`);
      return true;
    } catch (error) {
      return false;
    }
  }
}
