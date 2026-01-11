import { formatError } from "../error/utils";
import { p } from "./fs-utils";
import { app } from "electron";
import * as path from "path";
import {
  execRegCommandSync,
  runRegCommandsWithElevation,
} from "./command-runner";

const CONTEXT_MENU_KEY = "HKEY_CLASSES_ROOT\\Directory\\shell\\ShareFolder";
const COMMAND_KEY = "HKEY_CLASSES_ROOT\\Directory\\shell\\ShareFolder\\command";
const CONTEXT_MENU_KEY_BACKGROUND =
  "HKEY_CLASSES_ROOT\\Directory\\Background\\shell\\ShareFolder";
const COMMAND_KEY_BACKGROUND =
  "HKEY_CLASSES_ROOT\\Directory\\Background\\shell\\ShareFolder\\command";

function ensurePlatformSupported(): void {
  if (process.platform !== "win32") {
    throw new Error("注册表操作仅支持 Windows 系统");
  }
}

export async function addContextMenu(): Promise<void> {
  ensurePlatformSupported();

  try {
    const electronExePath = process.execPath;
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, "assets", "folder-share.ico")
      : p("assets/folder-share.ico");

    const command = app.isPackaged
      ? `"${electronExePath}" --share "%1"`
      : `"${electronExePath}" "${app.getAppPath()}" --share "%1"`;
    const commandBackground = app.isPackaged
      ? `"${electronExePath}" --share "%V"`
      : `"${electronExePath}" "${app.getAppPath()}" --share "%V"`;

    const cmds = [
      `add "${CONTEXT_MENU_KEY}" /ve /d "共享此文件夹" /f`,
      `add "${CONTEXT_MENU_KEY}" /v Icon /d "${iconPath}" /f`,
      `add "${COMMAND_KEY}" /ve /d "${command}" /f`,
      `add "${CONTEXT_MENU_KEY_BACKGROUND}" /ve /d "共享此文件夹" /f`,
      `add "${CONTEXT_MENU_KEY_BACKGROUND}" /v Icon /d "${iconPath}" /f`,
      `add "${COMMAND_KEY_BACKGROUND}" /ve /d "${commandBackground}" /f`,
    ];

    await runRegCommandsWithElevation(cmds);
  } catch (e) {
    const error = formatError(e);
    throw new Error(`添加右键菜单失败：${error.message}`);
  }
}

export async function removeContextMenu(): Promise<void> {
  ensurePlatformSupported();

  try {
    const cmds = [
      `delete "${CONTEXT_MENU_KEY}" /f`,
      `delete "${CONTEXT_MENU_KEY_BACKGROUND}" /f`,
    ];
    await runRegCommandsWithElevation(cmds);
  } catch (e) {
    const error = formatError(e);
    throw new Error(`移除右键菜单失败：${error.message}`);
  }
}

export async function checkContextMenuExists(): Promise<boolean> {
  ensurePlatformSupported();

  try {
    try {
      execRegCommandSync(`query "${CONTEXT_MENU_KEY}"`);
      return true;
    } catch {
      execRegCommandSync(`query "${CONTEXT_MENU_KEY_BACKGROUND}"`);
      return true;
    }
  } catch (error) {
    return false;
  }
}
