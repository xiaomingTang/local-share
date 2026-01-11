import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

interface DirectoryItem {
  name: string;
  type: "file" | "directory";
  size: number;
  modified: string;
  extension: string | null;
}

export async function getDirectoryItems(
  dirPath: string
): Promise<DirectoryItem[]> {
  const readdir = promisify(fs.readdir);
  const stat = promisify(fs.stat);

  const items = await readdir(dirPath);
  const result: DirectoryItem[] = [];

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
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}
export function p(...args: string[]): string {
  return path.join(__dirname, "../../", ...args);
}
