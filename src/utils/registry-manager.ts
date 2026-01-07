import { default as winreg } from "winreg";
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
      // 获取当前应用程序的路径
      const appPath = process.execPath;
      const iconPath = path.join(
        path.dirname(appPath),
        "assets",
        "folder-share.ico"
      );

      // 创建主键
      const menuReg = new winreg({
        hive: winreg.HKCR,
        key: "\\Directory\\shell\\ShareFolder",
      });

      await this.setRegistryValue(menuReg, "", "共享此文件夹");
      await this.setRegistryValue(menuReg, "Icon", iconPath);

      // 创建命令键
      const commandReg = new winreg({
        hive: winreg.HKCR,
        key: "\\Directory\\shell\\ShareFolder\\command",
      });

      const command = `"${appPath}" --share "%1"`;
      await this.setRegistryValue(commandReg, "", command);

      console.log("右键菜单添加成功");
    } catch (error) {
      throw new Error(`添加右键菜单失败: ${(error as Error).message}`);
    }
  }

  public async removeContextMenu(): Promise<void> {
    if (process.platform !== "win32") {
      throw new Error("右键菜单功能仅支持 Windows 系统");
    }

    try {
      const menuReg = new winreg({
        hive: winreg.HKCR,
        key: "\\Directory\\shell\\ShareFolder",
      });

      await this.deleteRegistryKey(menuReg);
      console.log("右键菜单移除成功");
    } catch (error) {
      throw new Error(`移除右键菜单失败: ${(error as Error).message}`);
    }
  }

  public async checkContextMenuExists(): Promise<boolean> {
    if (process.platform !== "win32") {
      return false;
    }

    try {
      const menuReg = new winreg({
        hive: winreg.HKCR,
        key: "\\Directory\\shell\\ShareFolder",
      });

      return new Promise((resolve) => {
        menuReg.keyExists((err, exists) => {
          resolve(exists);
        });
      });
    } catch (error) {
      return false;
    }
  }

  private setRegistryValue(
    regKey: winreg.Registry,
    name: string,
    value: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      regKey.set(name, winreg.REG_SZ, value, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private deleteRegistryKey(regKey: winreg.Registry): Promise<void> {
    return new Promise((resolve, reject) => {
      // 首先删除子键
      regKey.keys((err, keys) => {
        if (!err && keys) {
          const deletePromises = keys.map((key) => {
            return new Promise<void>((subResolve, subReject) => {
              key.destroy((subErr) => {
                if (subErr) subReject(subErr);
                else subResolve();
              });
            });
          });

          Promise.all(deletePromises)
            .then(() => {
              // 删除主键
              regKey.destroy((mainErr) => {
                if (mainErr) reject(mainErr);
                else resolve();
              });
            })
            .catch(reject);
        } else {
          // 没有子键，直接删除主键
          regKey.destroy((mainErr) => {
            if (mainErr) reject(mainErr);
            else resolve();
          });
        }
      });
    });
  }
}
