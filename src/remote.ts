import {
  Remote,
  createElectronMainAdaptor,
  initMessengerInMain,
} from "@zimi/remote";

initMessengerInMain();

const adaptor = createElectronMainAdaptor();

export const remote = new Remote<FuncsFromMain, FuncsFromRenderer>(adaptor, {
  deviceId: "main",
});
