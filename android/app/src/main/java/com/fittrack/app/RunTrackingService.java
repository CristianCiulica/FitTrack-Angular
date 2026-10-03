package com.fittrack.app;

import android.app.Service;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSObject;
import org.json.JSONArray;
import java.time.Instant;

/** GPS and checkpoints live outside the WebView, including when the screen locks. */
public class RunTrackingService extends Service implements LocationListener {
    private static RunTrackingService active;
    private static final String CHANNEL = "fittrack_run";
    private static final int NOTIFICATION = 4101;
    private LocationManager locations;
    private JSObject session;
    private String uid = "";
    private Location anchor;
    private long startedElapsed;
    private int baseDuration;
    private boolean discard;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable checkpoint = new Runnable() {
        @Override public void run() { persist(); handler.postDelayed(this, 5000); }
    };

    public static void clear(Context context, String owner) {
        if (active != null && active.uid.equals(owner)) {
            active.discard = true;
            context.stopService(new Intent(context, RunTrackingService.class));
        }
        context.getSharedPreferences("fittrack_runs", 0).edit().remove(owner).commit();
    }
    public static String owner() { return active == null ? "" : active.uid; }
    public static JSObject snapshot(Context context, String owner) throws Exception {
        JSObject result = new JSObject();
        boolean isActive = active != null && active.uid.equals(owner);
        result.put("active", isActive);
        if (isActive) {
            active.updateMetrics();
            result.put("session", new JSObject(active.session.toString()));
        } else {
            String raw = context.getSharedPreferences("fittrack_runs", 0).getString(owner, null);
            if (raw != null) result.put("session", new JSObject(raw));
        }
        return result;
    }
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || !intent.hasExtra("session")) { stopSelf(); return START_NOT_STICKY; }
        try {
            if (locations != null) locations.removeUpdates(this);
            handler.removeCallbacks(checkpoint);
            session = new JSObject(intent.getStringExtra("session"));
            uid = session.getString("userId");
            baseDuration = session.optInt("durationSeconds");
            startedElapsed = android.os.SystemClock.elapsedRealtime();
            anchor = null;
            active = this;
            NotificationManager notifications = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= 26) notifications.createNotificationChannel(new NotificationChannel(CHANNEL, "Active run", NotificationManager.IMPORTANCE_LOW));
            Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pending = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification notification = new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_run_notification).setContentTitle("FitTrack · Run in progress")
                .setContentText("Recording your route. Tap to return to your run.")
                .setContentIntent(pending).setOngoing(true).setOnlyAlertOnce(true).build();
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            else startForeground(NOTIFICATION, notification);
            locations = (LocationManager) getSystemService(LOCATION_SERVICE);
            boolean provider = false;
            for (String name : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
                if (locations.isProviderEnabled(name)) {
                    locations.requestLocationUpdates(name, 1000, 0, this, Looper.getMainLooper()); provider = true;
                }
            }
            if (!provider) throw new IllegalStateException("Enable location services before starting a run.");
            persist(); handler.postDelayed(checkpoint, 5000);
        } catch (Exception error) {
            if (session != null) { session.put("trackingError", error.getMessage()); persist(); }
            stopSelf();
        }
        // A killed service leaves its durable checkpoint; resume requires the user
        // to reopen the app. Android force-stop cannot be bypassed by an application.
        return START_NOT_STICKY;
    }
    @Override public void onLocationChanged(Location location) {
        if (session == null || !location.hasAccuracy() || location.getAccuracy() > 50 || location.getTime() < System.currentTimeMillis() - 30000) return;
        try {
            JSONArray route = session.optJSONArray("route");
            if (route == null) route = new JSONArray();
            if (anchor != null) {
                double seconds = (location.getTime() - anchor.getTime()) / 1000.0;
                double distance = anchor.distanceTo(location);
                if (seconds <= 0) return;
                if (seconds > 60) { anchor = location; persist(); return; }
                if (!RunTrackingMath.acceptSegment(distance, seconds, location.getAccuracy())) return;
                session.put("distanceMeters", session.optDouble("distanceMeters") + distance);
            }
            anchor = new Location(location);
            route.put(new JSONArray().put(location.getLatitude()).put(location.getLongitude()));
            // Keep a bounded full-session route, preserving its first/latest point.
            if (route.length() > 5000) {
                JSONArray compact = new JSONArray();
                for (int i = 0; i < route.length() - 1; i += 2) compact.put(route.get(i));
                compact.put(route.get(route.length() - 1)); route = compact;
            }
            session.put("route", route); session.put("gpsAccuracy", location.getAccuracy());
            persist();
        } catch (Exception error) { session.put("trackingError", "Could not record a GPS position."); }
    }
    private void persist() {
        if (discard || session == null || uid.isEmpty()) return;
        try {
            updateMetrics();
            getSharedPreferences("fittrack_runs", 0).edit().putString(uid, session.toString()).commit();
        } catch (Exception ignored) { /* Retain the previous durable checkpoint. */ }
    }
    private void updateMetrics() {
        if (session == null) return;
        int duration = Math.min(604800, baseDuration + (int)((android.os.SystemClock.elapsedRealtime() - startedElapsed) / 1000));
        double distance = session.optDouble("distanceMeters");
        session.put("durationSeconds", duration);
        session.put("endedAt", Instant.now().toString());
        session.put("steps", (int)(distance / 1.2));
        session.put("averageSpeedKmh", duration > 0 ? distance / duration * 3.6 : 0);
        session.put("calories", distance / 1000 * 60);
    }
    @Override public void onDestroy() {
        persist(); handler.removeCallbacks(checkpoint);
        if (locations != null) {
            try { locations.removeUpdates(this); } catch (SecurityException ignored) { /* Permission was revoked. */ }
        }
        if (active == this) active = null;
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }
    @Override public void onProviderDisabled(String provider) {
        if (session != null) { session.put("trackingError", "Location services are disabled. Enable them to continue recording."); persist(); }
    }
    @Override public void onProviderEnabled(String provider) { if (session != null) session.remove("trackingError"); }
    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
}
