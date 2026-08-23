package com.lumnia.finance;

import android.Manifest;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import org.json.JSONObject;

@CapacitorPlugin(
    name = "BankNotificationCapture",
    permissions = @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
)
public class BankNotificationCapturePlugin extends Plugin {
    @PluginMethod
    public void isEnabled(PluginCall call) {
        NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        ComponentName component = new ComponentName(getContext(), BankNotificationListenerService.class);
        JSObject result = new JSObject();
        result.put("enabled", Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1
            ? manager.isNotificationListenerAccessGranted(component)
            : Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners")
                .contains(getContext().getPackageName()));
        call.resolve(result);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || getPermissionState("notifications") == PermissionState.GRANTED) {
            call.resolve();
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void getPendingTransaction(PluginCall call) {
        JSONObject pending = PendingBankTransactionStore.consume(getContext());
        JSObject result = new JSObject();
        result.put("transaction", pending == null ? null : pending);
        call.resolve(result);
    }
}
