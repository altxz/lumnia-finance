import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.lumnia.finance",
  appName: "Lumnia",
  webDir: "dist",
  bundledWebRuntime: false,
  android: {
    backgroundColor: "#5447BC",
  },
};

export default config;
