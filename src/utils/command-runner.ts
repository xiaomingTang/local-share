import { execSync, spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// 同步执行 reg.exe 命令并返回输出，遇到错误抛出
export function execRegCommandSync(args: string): string {
  try {
    return execSync(`cmd /d /s /c "chcp 65001 >nul & reg ${args}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error: any) {
    const errorMessage =
      (typeof error?.stderr === "string" && error.stderr.trim()) ||
      (typeof error?.stdout === "string" && error.stdout.trim()) ||
      error?.message ||
      "";
    throw new Error(errorMessage || "注册表操作失败");
  }
}

// 在提升权限的 PowerShell 中一次性执行多条 reg 命令（避免多次弹 UAC）
export function execRegCommandsElevated(argsArray: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(
      os.tmpdir(),
      `localshare-reg-${Date.now()}-${Math.floor(Math.random() * 10000)}.ps1`
    );
    // 将每条命令写成独立行，并以 UTF-16 LE（带 BOM）编码保存，PowerShell 默认更可靠地识别该编码，避免中文乱码
    const psContent = argsArray.map((a) => `reg ${a}`).join(os.EOL);
    try {
      // 写入 UTF-16 LE BOM + 内容（PowerShell 对脚本文件通常期望 UTF-16 LE）
      const contentBuf = Buffer.concat([
        Buffer.from([0xff, 0xfe]),
        Buffer.from(psContent, "utf16le"),
      ]);
      fs.writeFileSync(tmpFile, contentBuf);

      const safePath = tmpFile.replace(/'/g, "''");
      const startCmd = `Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${safePath}' -Verb RunAs -Wait`;

      const child = spawn("powershell", ["-NoProfile", "-Command", startCmd], {
        stdio: "inherit",
      });

      child.on("error", (err) => {
        try {
          if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        } catch {}
        reject(err);
      });

      child.on("close", (code) => {
        try {
          if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        } catch {}
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`elevated process exit code ${code}`));
        }
      });
    } catch (error) {
      try {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      } catch {}
      reject(error);
    }
  });
}

// 入参为 commands 字符串数组，先尝试用普通用户执行，
// 一旦遇到某条执行失败，则以管理员权限一次性执行该失败命令及其后的所有命令
export async function runRegCommandsWithElevation(
  commands: string[]
): Promise<void> {
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    try {
      execRegCommandSync(cmd);
    } catch (err) {
      const remaining = commands.slice(i);
      await execRegCommandsElevated(remaining);
      return;
    }
  }
}
