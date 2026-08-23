import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.lumnia.finance",
  appName: "Lumnia",
  webDir: "dist",
  bundledWebRuntime: false,
  android: {
    backgroundColor: "#F8F4FA",
  },
};

export default config;
