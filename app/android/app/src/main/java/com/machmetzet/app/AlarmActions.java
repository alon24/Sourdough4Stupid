package com.machmetzet.app;

import android.app.NotificationManager;
import android.content.Context;
import org.json.JSONObject;

/** What the alarm buttons do. The plan itself lives in the web app, so each action is also queued for it. */
final class AlarmActions {
    private AlarmActions() {}

    static void handle(Context ctx, String id, String action, int minutes) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.cancel(id.hashCode());
        AlarmStore store = new AlarmStore(ctx);
        long now = System.currentTimeMillis();
        if ("done".equals(action)) {
            store.remove(id);
            store.addEvent(id, "done", 0, now);
            return;
        }
        JSONObject a = store.get(id);
        String title = a == null ? "" : a.optString("title");
        String note = a == null ? "" : a.optString("note");
        AlarmScheduler.set(ctx, id, now + minutes * 60_000L, title, note);
        store.addEvent(id, action, minutes, now);
    }
}
