package com.lifeos.app;
import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.*;

@CapacitorPlugin(name = "MedicineReminders", permissions = {
    @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
})
public class MedicineRemindersPlugin extends Plugin {
    @PluginMethod public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("notifications", MedicineAlarmStore.allowed(getContext()));
        result.put("exact", MedicineAlarmStore.exact(getContext()));
        result.put("error", MedicineAlarmStore.prefs(getContext()).getString("schedule_error", ""));
        call.resolve(result);
    }
    @PluginMethod public void enable(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED)
            requestPermissionForAlias("notifications", call, "permissionResult");
        else status(call);
    }
    @PermissionCallback private void permissionResult(PluginCall call) { status(call); }
    @PluginMethod public void openAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 31) getActivity().startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
            Uri.parse("package:" + getContext().getPackageName())));
        call.resolve();
    }
    @PluginMethod public void openNotificationSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        getActivity().startActivity(i); call.resolve();
    }
    @PluginMethod public void configure(PluginCall call) {
        try { MedicineAlarmStore.configure(getContext(), call.getData()); status(call); }
        catch (Exception e) { call.reject("Unable to save device reminders", e); }
    }
    @PluginMethod public void record(PluginCall call) {
        try { MedicineAlarmStore.record(getContext(), call.getData()); call.resolve(); }
        catch (Exception e) { call.reject("Unable to record action", e); }
    }
    @PluginMethod public void queue(PluginCall call) {
        JSObject data = new JSObject();
        data.put("actions", MedicineAlarmStore.array(MedicineAlarmStore.prefs(getContext()).getString("queue", "[]")));
        call.resolve(data);
    }
    @PluginMethod public void acknowledge(PluginCall call) {
        try { MedicineAlarmStore.acknowledge(getContext(), call.getArray("ids", new JSArray()), call.getArray("doses", new JSArray())); call.resolve(); }
        catch (Exception e) { call.reject("Unable to sync action journal", e); }
    }
    @PluginMethod public void clear(PluginCall call) { MedicineAlarmStore.clear(getContext()); call.resolve(); }
    @PluginMethod public void test(PluginCall call) { MedicineAlarmStore.show(getContext(), new JSONObject(), true); status(call); }
    @PluginMethod public void consumeOpen(PluginCall call) {
        boolean open = getActivity().getIntent().getBooleanExtra("medicine_reminder", false);
        getActivity().getIntent().removeExtra("medicine_reminder");
        JSObject result = new JSObject(); result.put("open", open); call.resolve(result);
    }
    @Override protected void handleOnNewIntent(Intent intent) {
        getActivity().setIntent(intent);
        if (intent.getBooleanExtra("medicine_reminder", false)) notifyListeners("openReminder", new JSObject(), true);
    }
    @Override protected void handleOnResume() { MedicineAlarmStore.reconcile(getContext()); }
}
