package com.lumnia.finance;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;

import androidx.annotation.Nullable;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        registerPlugin(BankNotificationCapturePlugin.class);
        registerPlugin(SystemBarsPlugin.class);
        registerPlugin(BackupImportFilePickerPlugin.class);
        PendingBankTransactionStore.saveFromIntent(this, getIntent());
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.parseColor("#191527"));
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView())
            .setAppearanceLightStatusBars(false);

        ViewCompat.setOnApplyWindowInsetsListener(getBridge().getWebView(), (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            int topBreathingRoom = Math.round(24 * getResources().getDisplayMetrics().density);
            view.setPadding(insets.left, insets.top + topBreathingRoom, insets.right, insets.bottom);
            return windowInsets;
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        PendingBankTransactionStore.saveFromIntent(this, intent);
    }
}
