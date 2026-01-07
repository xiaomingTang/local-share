import * as path from "path";

export function p(...args: string[]): string {
  return path.join(__dirname, "../../", ...args);
}
