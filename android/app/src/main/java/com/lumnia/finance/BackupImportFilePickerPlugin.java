package com.lumnia.finance;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

@CapacitorPlugin(name = "BackupImportFilePicker", requestCodes = { BackupImportFilePickerPlugin.PICK_BACKUP_FILE })
public class BackupImportFilePickerPlugin extends Plugin {
    static final int PICK_BACKUP_FILE = 9184;
    private static final int MAX_FILE_BYTES = 20 * 1024 * 1024;

    @PluginMethod
    public void pickBackupFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {
            "application/json",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, PICK_BACKUP_FILE);
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != PICK_BACKUP_FILE) return;
        PluginCall call = getSavedCall();
        if (call == null) return;
        if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("Seleção de arquivo cancelada.");
            return;
        }

        try {
            Uri uri = data.getData();
            getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            byte[] content = readFile(uri);
            JSObject result = new JSObject();
            result.put("name", getDisplayName(uri));
            result.put("mimeType", getContext().getContentResolver().getType(uri));
            result.put("data", Base64.encodeToString(content, Base64.NO_WRAP));
            result.put("size", content.length);
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Não foi possível ler o arquivo selecionado.", exception);
        }
    }

    private byte[] readFile(Uri uri) throws Exception {
        try (InputStream input = getContext().getContentResolver().openInputStream(uri); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (input == null) throw new IllegalStateException("Arquivo indisponível.");
            byte[] buffer = new byte[8192];
            int total = 0;
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > MAX_FILE_BYTES) throw new IllegalArgumentException("O arquivo excede o limite de 20 MB.");
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }

    private String getDisplayName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) return cursor.getString(index);
            }
        }
        return "backup-lumnia";
    }
}
