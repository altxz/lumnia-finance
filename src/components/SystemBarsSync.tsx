import { useEffect } from "react";
import { useTheme } from "next-themes";

import { syncSystemBars } from "@/lib/systemBars";

function SystemBarsSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;
    void syncSystemBars(resolvedTheme === "dark");
  }, [resolvedTheme]);

  return null;
}

export { SystemBarsSync };
