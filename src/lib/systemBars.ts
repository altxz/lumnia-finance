import { Capacitor, registerPlugin } from "@capacitor/core";

interface SystemBarsPlugin {
  setTheme(options: { dark: boolean }): Promise<void>;
}

const SystemBars = registerPlugin<SystemBarsPlugin>("SystemBars");

async function syncSystemBars(dark: boolean) {
  if (!Capacitor.isNativePlatform()) return;
  await SystemBars.setTheme({ dark });
}

export { syncSystemBars };
