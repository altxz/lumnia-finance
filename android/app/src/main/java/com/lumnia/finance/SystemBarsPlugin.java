package com.lumnia.finance;

import android.graphics.Color;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemBars")
public class SystemBarsPlugin extends Plugin {
    private static final String DARK_BACKGROUND = "#0F1014";
    private static final String LIGHT_BACKGROUND = "#F6F7F9";

    @PluginMethod
    public void setTheme(PluginCall call) {
        boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));

        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            int background = Color.parseColor(dark ? DARK_BACKGROUND : LIGHT_BACKGROUND);
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
                window,
                window.getDecorView()
            );

            window.setStatusBarColor(background);
            window.setNavigationBarColor(background);
            controller.setAppearanceLightStatusBars(!dark);
            controller.setAppearanceLightNavigationBars(!dark);
            call.resolve();
        });
    }
}
