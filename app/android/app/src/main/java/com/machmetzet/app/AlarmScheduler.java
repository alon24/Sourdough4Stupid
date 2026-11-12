package com.machmetzet.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

/** Sets and cancels real alarm-clock alarms (they show the alarm icon and fire in Doze). */
final class AlarmScheduler {
    private AlarmScheduler() {}

    private static PendingIntent fire(Context ctx, String id) {
        Intent i = new Intent(ctx, AlarmReceiver.class).setAction("com.machmetzet.app.FIRE").putExtra("id", id);
        return PendingIntent.getBroadcast(ctx, id.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void set(Context ctx, String id, long at, String title, String note) {
        new AlarmStore(ctx).put(id, at, title, note);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        Intent show = new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent showPi = PendingIntent.getActivity(ctx, 0, show, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, showPi), fire(ctx, id));
    }

    static void cancel(Context ctx, String id) {
        new AlarmStore(ctx).remove(id);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        am.cancel(fire(ctx, id));
    }

    /** Re-create every stored alarm that is still in the future (after reboot or update). */
    static void restoreAll(Context ctx) {
        AlarmStore store = new AlarmStore(ctx);
        long now = System.currentTimeMillis();
        for (String id : store.ids()) {
            org.json.JSONObject a = store.get(id);
            if (a == null) continue;
            long at = a.optLong("at");
            if (at > now) set(ctx, id, at, a.optString("title"), a.optString("note"));
            else store.remove(id);
        }
    }
}
