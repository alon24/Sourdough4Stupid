package com.machmetzet.app;

import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Bridge between the web app's plan and the phone's alarm clock. */
@CapacitorPlugin(name = "Alarms")
public class AlarmsPlugin extends Plugin {

    /** ops: [{op:'set', id, at, title, note?} | {op:'cancel', id}] */
    @PluginMethod
    public void apply(PluginCall call) {
        JSArray ops = call.getArray("ops");
        if (ops == null) {
            call.reject("ops missing");
            return;
        }
        Context ctx = getContext();
        try {
            for (int i = 0; i < ops.length(); i++) {
                JSONObject o = ops.getJSONObject(i);
                String id = o.getString("id");
                if ("cancel".equals(o.getString("op"))) {
                    AlarmScheduler.cancel(ctx, id);
                } else {
                    AlarmScheduler.set(ctx, id, o.getLong("at"), o.optString("title"), o.optString("note", ""));
                }
            }
            call.resolve();
        } catch (JSONException e) {
            call.reject("bad ops", e);
        }
    }

    /** Actions taken on the alarm screen since the last call: [{id, action, minutes, at}] */
    @PluginMethod
    public void takeEvents(PluginCall call) {
        JSObject r = new JSObject();
        JSONArray events = new AlarmStore(getContext()).takeEvents();
        r.put("events", events);
        call.resolve(r);
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        boolean notif = androidx.core.app.NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        boolean full = true;
        if (Build.VERSION.SDK_INT >= 34) {
            full = ((android.app.NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE)).canUseFullScreenIntent();
        }
        r.put("notifications", notif);
        r.put("fullScreen", full);
        call.resolve(r);
    }

    /** Open the system screen where the user can allow what is missing. */
    @PluginMethod
    public void openSettings(PluginCall call) {
        String what = call.getString("what", "notifications");
        Intent i;
        if ("fullScreen".equals(what) && Build.VERSION.SDK_INT >= 34) {
            i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + getContext().getPackageName()));
        } else if ("battery".equals(what)) {
            i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
        } else {
            i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** Ring in a few seconds, to check that everything works. */
    @PluginMethod
    public void test(PluginCall call) {
        AlarmScheduler.set(getContext(), "test", System.currentTimeMillis() + 5000, "בדיקת שעון", "אם אתה רואה את זה, השעונים עובדים");
        call.resolve();
    }
}
