import { Remote } from "@zimi/remote/dist/remote";
import { getMessenger } from "@zimi/remote/dist/adaptors/electron/messenger";
import { createElectronRendererAdaptor } from "@zimi/remote/dist/adaptors/electron/renderer";

const adaptor = createElectronRendererAdaptor();

export const remote = new Remote<FuncsFromRenderer, FuncsFromMain>(adaptor, {
  deviceId: "renderer",
});

export async function waitUntilRemoteReady() {
  remote.deviceId = await getMessenger().getId();
}
