package com.fittrack.app;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "FitTrackRun", permissions = {
    @Permission(alias = "location", strings = {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}),
    @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
})
public class RunTrackingPlugin extends Plugin {
    @PluginMethod public void start(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationResult");
            return;
        }
        requestNotifications(call);
    }
    @PermissionCallback private void locationResult(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Location permission is required to record a run."); return;
        }
        requestNotifications(call);
    }
    private void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationResult");
            return;
        }
        begin(call);
    }
    @PermissionCallback private void notificationResult(PluginCall call) { begin(call); }
    private void begin(PluginCall call) {
        JSObject session = call.getObject("session");
        if (session == null || session.optString("userId").isEmpty()) {
            call.reject("A signed-in runner is required."); return;
        }
        try {
            Intent intent = new Intent(getContext(), RunTrackingService.class);
            intent.putExtra("session", session.toString());
            ContextCompat.startForegroundService(getContext(), intent);
            call.resolve();
        } catch (Exception error) { call.reject("Could not start run tracking.", error); }
    }
    @PluginMethod public void snapshot(PluginCall call) {
        try { call.resolve(RunTrackingService.snapshot(getContext(), call.getString("owner", ""))); }
        catch (Exception error) { call.reject("Could not recover the run.", error); }
    }
    @PluginMethod public void stop(PluginCall call) {
        try {
            JSObject result = RunTrackingService.snapshot(getContext(), call.getString("owner", ""));
            if (call.getString("owner", "").equals(RunTrackingService.owner())) getContext().stopService(new Intent(getContext(), RunTrackingService.class));
            call.resolve(result);
        } catch (Exception error) { call.reject("Could not stop tracking.", error); }
    }
    @PluginMethod public void clear(PluginCall call) {
        String owner = call.getString("owner", "");
        RunTrackingService.clear(getContext(), owner);
        call.resolve();
    }
}
