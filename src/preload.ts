/* 由于 preload 运行在沙箱中，不能 import 包，所以复制粘贴到这里了 */

import { contextBridge, ipcRenderer } from "electron";

const MESSENGER_EVENT_NAME = "__remote-messenger-event__";
const MESSENGER_KEY = "__remote_messenger__";
const KEYOF_GET_ID = "__get-webcontents-id__";

contextBridge.exposeInMainWorld(MESSENGER_KEY, {
  postMessage: (data: any) => {
    ipcRenderer.postMessage(MESSENGER_EVENT_NAME, data);
  },
  getId: () => ipcRenderer.invoke(KEYOF_GET_ID),
  on: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => listener(...args));
  },
});
